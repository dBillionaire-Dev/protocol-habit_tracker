import { NextRequest, NextResponse } from "next/server";
import { storage, DebtRepaymentError } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({
  amount: z.number().int().min(1),
});

// Lets a user repay outstanding Build-habit debt independently of
// completing today's requirement — e.g. today's protocol is already done,
// but they still want to chip away at old missed days. Reuses the exact
// same storage.repayBuildDebt logic that the combined complete+repay flow
// uses (see the complete/route.ts sibling), so there's one authoritative
// repayment path, not two.
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
  if (!habit) {
    return NextResponse.json({ message: "Habit not found" }, { status: 404 });
  }
  if (habit.userId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (habit.type !== "build") {
    return NextResponse.json(
      { message: "Debt repayment is only available for Build protocols." },
      { status: 400 },
    );
  }

  try {
    const body = input.parse(await request.json());
    const today = new Date().toISOString().split("T")[0];
    const debtSummary = await storage.repayBuildDebt(Number(id), user.id, body.amount, today);
    return NextResponse.json({ habitId: Number(id), ...debtSummary });
  } catch (error) {
    if (error instanceof DebtRepaymentError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Error repaying debt:", error);
    return NextResponse.json(
      { message: "Failed to record repayment" },
      { status: 500 },
    );
  }
}
