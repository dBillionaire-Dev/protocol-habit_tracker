import { NextRequest, NextResponse } from "next/server";
import { storage, DebtRepaymentError } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
  // Optional: repay some outstanding Build debt as part of the same
  // confirmation. Completing today's requirement does NOT implicitly
  // repay debt — this must be an explicit, separate choice (see
  // storage.completeDailyTask).
  debtRepayment: z.number().int().min(0).optional(),
});

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

  try {
    const body = input.parse(await request.json());
    const result = await storage.completeDailyTask(
      Number(id),
      body.date,
      body.completed,
      body.debtRepayment,
    );
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
