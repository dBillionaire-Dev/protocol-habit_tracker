import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { getAnalyticsSummary } from "@/lib/analytics";
import { generateStructured, isAiConfigured, AiNotConfiguredError } from "@/lib/gemini";

interface AiInsightsResult {
  insights: string[];
  recommendations: string[];
}

// Premium Plus only. Sends ONLY aggregated, already-computed stats to
// Gemini — habit names (needed for the insights to be specific and
// useful) and numeric summaries. Never sends habitEvents.notes (free-text
// the user may have written) or any account/contact info.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create an account to access AI insights.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "ai_insights")) {
    return NextResponse.json(
      { message: "AI Discipline Insights is a Premium Plus feature.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  if (!isAiConfigured()) {
    // Per spec: build the real architecture, but never fake AI output
    // when no provider is configured.
    return NextResponse.json(
      { message: "AI features aren't configured yet.", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const summary = await getAnalyticsSummary(user.id, "90d");
  const habitBriefs = await storage.getHabitBriefs(user.id);

  if (summary.overallCompletionRate === null) {
    return NextResponse.json({
      insights: [],
      recommendations: [],
      message: "Not enough history yet to generate insights.",
    });
  }

  const prompt = `You are a discipline coach analyzing REAL aggregated data from a habit-tracking app. Do not invent numbers, dates, or facts not present below. Every sentence you write must be grounded in this data.

Data (last 90 days):
${JSON.stringify({ summary, habits: habitBriefs }, null, 2)}

Return JSON with exactly this shape:
{
  "insights": ["factual observation grounded in the data above", ...],
  "recommendations": ["actionable suggestion that cites a specific habit name, day, or percentage from the data", ...]
}

Rules:
- 2-4 insights, 1-3 recommendations.
- Every string must reference a specific number or fact from the data provided (a percentage, a habit name, a day of week, a streak length).
- Do NOT mention time-of-day patterns (morning/evening/before noon/after 6pm) — that data is not tracked and any such claim would be fabricated.
- Do NOT invent percentages, comparisons to "last month", or any fact not derivable from the JSON above.
- Keep each string under 25 words.
- If there isn't enough data to support a category, return fewer items rather than inventing content.`;

  try {
    const result = await generateStructured<AiInsightsResult>(prompt);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { message: err.message, code: "AI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    console.error("Gemini insights request failed:", err);
    return NextResponse.json(
      { message: "Failed to generate insights right now. Try again shortly.", code: "AI_ERROR" },
      { status: 502 },
    );
  }
}
