import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { insertHabitSchema } from "shared/schema";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const habits = await storage.getHabits(user.id);
    return NextResponse.json(habits);
  } catch (error) {
    console.error("Error fetching habits:", error);
    return NextResponse.json(
      { message: "Failed to fetch habits" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = insertHabitSchema.parse(body);
    const habit = await storage.createHabit(user.id, input);
    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message, field: error.errors[0].path.join(".") },
        { status: 400 },
      );
    }
    console.error("Error creating habit:", error);
    return NextResponse.json(
      { message: "Failed to create habit" },
      { status: 500 },
    );
  }
}
