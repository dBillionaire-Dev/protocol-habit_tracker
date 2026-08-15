import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { generateStructured, isAiConfigured, AiNotConfiguredError } from "@/lib/gemini";
import { z } from "zod";

const input = z.object({
  goal: z.string().min(3).max(500),
});

interface PlanSuggestion {
  name: string;
  type: "build" | "avoidance";
  baseTaskValue: number | null;
  unit: string | null;
  frequency: string;
  rationale: string;
}

// Premium Plus only. This ONLY returns suggestions — it never creates a
// habit itself. Per spec: "AI must NOT automatically create protocols."
// The client shows these, the user picks which ones they want, then the
// existing POST /api/habits route (already tested, already enforces the
// free-plan habit limit) creates each selected one individually.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create an account to use AI planning.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "ai_planning")) {
    return NextResponse.json(
      { message: "AI Protocol Planning is a Premium Plus feature.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { message: "AI features aren't configured yet.", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Please describe your goal." }, { status: 400 });
  }

  const prompt = `A user of a habit-tracking app called PROTOCOL wants help planning. Their goal, in their own words:
"${parsed.data.goal}"

Suggest a structured discipline plan using ONLY these two protocol types:
- "build": a positive habit tracked with a daily target amount (e.g. "Code" 2 hours/day, "Read" 20 pages/day)
- "avoidance": a habit to avoid entirely (e.g. "Social Media", "Junk Food") — no amount, just tracked as clean or violated each day

Return JSON with exactly this shape:
{
  "suggestions": [
    {
      "name": "short protocol name (2-4 words)",
      "type": "build" or "avoidance",
      "baseTaskValue": number (required for build, null for avoidance),
      "unit": short string like "hours"/"minutes"/"pages" (required for build, null for avoidance),
      "frequency": "short description, e.g. 'Daily' or 'Monday-Friday'",
      "rationale": "one sentence, under 20 words, explaining why this helps their stated goal"
    }
  ]
}

Suggest 2-5 protocols directly relevant to their stated goal. Do not suggest anything unrelated.`;

  try {
    const result = await generateStructured<{ suggestions: PlanSuggestion[] }>(prompt);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { message: err.message, code: "AI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    console.error("Gemini planning request failed:", err);
    return NextResponse.json(
      { message: "Failed to generate a plan right now. Try again shortly.", code: "AI_ERROR" },
      { status: 502 },
    );
  }
}
