import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { hasFeature } from "@/lib/entitlements";
import { z } from "zod";

// clientHour: the browser's local hour-of-day (0-23) at the moment of
// confirming, supplied by the client (see use-habits.ts's
// useConfirmCleanDay and day-confirmation-card.tsx's useConfirmationWindow,
// which already computes this exact value for the UI's own
// enable/disable logic). The server can't otherwise know the user's
// local time — no timezone is stored per-account anywhere in this app —
// and the confirmation window is explicitly meant to track the user's
// own evening, not a fixed UTC window, which would silently disagree
// with the UI in most timezones (including WAT, UTC+1). This isn't a
// security boundary (nothing sensitive is gated by it — it exists so the
// user doesn't casually confirm a day at 10 AM), so trusting the
// client's stated hour here is a reasonable, honest tradeoff: still
// strictly more enforcement than before (this route previously validated
// NO window at all), and Premium Plus bypasses it either way.
const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientHour: z.number().int().min(0).max(23),
});

function isWithinConfirmationWindow(clientHour: number): boolean {
  return clientHour >= 21 && clientHour <= 23;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const habit = await storage.getHabit(Number(id));
  if (!habit || habit.userId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof input>;
  try {
    body = input.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  if (body.date > today) {
    return NextResponse.json({ message: "Can't confirm a day that hasn't happened yet." }, { status: 400 });
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "flexible_confirmation") && !isWithinConfirmationWindow(body.clientHour)) {
    return NextResponse.json(
      {
        message: "Clean day confirmation is only available between 9:00 PM and midnight. Premium Plus lets you confirm anytime.",
        code: "OUTSIDE_CONFIRMATION_WINDOW",
      },
      { status: 403 },
    );
  }

  try {
    const result = await storage.confirmCleanDay(Number(id), body.date);
    return NextResponse.json({
      debt: result.debt,
      message: "Clean day confirmed",
    });
  } catch (error) {
    console.error("Error confirming clean day:", error);
    return NextResponse.json(
      { message: "Failed to confirm" },
      { status: 500 },
    );
  }
}
