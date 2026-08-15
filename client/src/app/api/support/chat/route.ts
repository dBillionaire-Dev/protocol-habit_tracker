import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/require-user";
import { generateChatReply, isAiConfigured, AiNotConfiguredError, type ChatMessage } from "@/lib/gemini";
import { z } from "zod";

const inputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20), // caps conversation length to bound cost/abuse per request
});

const SUPPORT_SYSTEM_PROMPT = `You are the support assistant for PROTOCOL, a discipline/habit-tracking app. Answer questions about how the app works, plainly and briefly (2-4 sentences unless more detail is genuinely needed).

How PROTOCOL works:
- Two protocol types: "Build" (a positive habit tracked against a daily target amount, e.g. 2 hours of coding) and "Avoid" (a habit to avoid entirely, tracked as clean or violated each day).
- Streaks: for Build, a streak is consecutive days marked completed. For Avoid, a streak grows each time the user explicitly confirms a clean day.
- Build penalties: if a Build protocol is missed, the next day's required amount increases (a stacking multiplier based on days since it was last completed) — separate from "debt".
- Build debt: some deployments track missed days as debt that can be partially repaid — ask the user to check their protocol card for specifics if unsure, since this may not be enabled everywhere.
- Avoid debt: each violation adds 1 to debt; confirming a clean day reduces it by 1.
- Daily confirmation window: there's a specific window each day (shown on the dashboard) during which the user confirms/logs their protocols.
- Missing a protocol: for Build, it's marked missed and the next day's requirement increases. For Avoid, a logged violation adds to that habit's debt.
- Plans: Free (3 protocols total), Pro, and Premium Plus (both unlimited protocols; Premium Plus adds AI features). Pricing is shown on the /pricing page — don't state specific numbers since they can change; direct the user there.
- Upgrading: from the profile menu, choose "Upgrade Plan" or visit /pricing.
- Cancelling: from the profile menu, "Manage Subscription" lets the user cancel; access continues until the current billing period ends.
- Exporting data: Pro/Premium Plus users can export their history as CSV from the /history page.
- Deleting an account: from the profile menu, "Delete Account" permanently removes the account and all its data — this cannot be undone.

Boundaries:
- You cannot see the user's actual account data (their specific habits, streaks, or billing status) — if they ask about their own account specifics, tell them to check the relevant page in the app, or use Email Support for anything account-specific.
- Do not make up features that don't exist. If you don't know something, say so and suggest Email Support.
- Keep responses focused on PROTOCOL. Politely decline unrelated requests.`;

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { message: "Live chat coming soon.", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  try {
    const reply = await generateChatReply({
      systemInstruction: SUPPORT_SYSTEM_PROMPT,
      messages: parsed.data.messages as ChatMessage[],
    });
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { message: "Live chat coming soon.", code: "AI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    console.error("Support chat request failed:", err);
    return NextResponse.json(
      { message: "Something went wrong. Try again shortly, or use Email Support below." },
      { status: 502 },
    );
  }
}
