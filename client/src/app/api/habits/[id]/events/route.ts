import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({ notes: z.string().optional(), idempotencyKey: z.string().optional() });

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
    const body = input.parse(await request.json().catch(() => ({})));
    const event = await storage.logHabitEvent(Number(id), body.notes, body.idempotencyKey);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error logging event:", error);
    return NextResponse.json(
      { message: "Failed to log event" },
      { status: 500 },
    );
  }
}
