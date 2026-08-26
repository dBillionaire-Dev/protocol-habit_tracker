import { NextRequest, NextResponse } from "next/server";
import { storage, DebtRepaymentError } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { hasFeature } from "@/lib/entitlements";
import { z } from "zod";

// clientHour: see api/habits/[id]/clean-day/route.ts for the full
// rationale — no per-user timezone is stored anywhere in this app, so
// the server trusts the browser's own local hour (already computed
// client-side for the UI's own window display) rather than guessing from
// server UTC and disagreeing with what the user sees on screen. Not a
// security boundary: nothing sensitive is gated by this check.
const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Raw units actually done today (e.g. 80 for "80 pushups"). Also used
  // for the "Missed" action, which sends 0. Both whether today counts as
  // complete AND how much outstanding debt this clears are derived from
  // this single number server-side — see storage.completeDailyTask.
  completedValue: z.number().int().min(0),
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
  if (habit.type !== "build") {
    return NextResponse.json(
      { message: "This confirmation flow is only for Build protocols." },
      { status: 400 },
    );
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

  // Same 9PM-midnight window as the Avoidance clean-day confirmation
  // (spec section 9's Premium Flexible Day Confirmation), enforced here
  // for consistency — this route previously had NO window check at all
  // server-side, only a disabled button client-side, for either the
  // "Execute Protocol" or "Missed" action, regardless of plan.
  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "flexible_confirmation") && !isWithinConfirmationWindow(body.clientHour)) {
    return NextResponse.json(
      {
        message: "This can only be confirmed between 9:00 PM and midnight. Premium Plus lets you confirm anytime.",
        code: "OUTSIDE_CONFIRMATION_WINDOW",
      },
      { status: 403 },
    );
  }

  try {
    const result = await storage.completeDailyTask(Number(id), body.date, body.completedValue);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DebtRepaymentError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Error completing task:", error);
    return NextResponse.json(
      { message: "Failed to complete task" },
      { status: 500 },
    );
  }
}
