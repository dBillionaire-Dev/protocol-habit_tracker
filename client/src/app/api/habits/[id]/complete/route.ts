import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
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
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      { message: "Failed to complete task" },
      { status: 500 },
    );
  }
}
