import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { insertHabitSchema, FREE_PLAN_HABIT_LIMIT } from "shared/schema";
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
    const sub = await storage.getSubscription(user.id);
    const isPro = sub?.plan === "pro" && sub.status === "active";

    if (!isPro) {
      const habitCount = await storage.countActiveHabits(user.id);
      if (habitCount >= FREE_PLAN_HABIT_LIMIT) {
        return NextResponse.json(
          {
            message: `Free plan is limited to ${FREE_PLAN_HABIT_LIMIT} protocols. Upgrade to Pro for unlimited.`,
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 402 },
        );
      }
    }

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
