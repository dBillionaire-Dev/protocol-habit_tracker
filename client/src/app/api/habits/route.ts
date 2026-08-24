import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { insertHabitSchema } from "shared/schema";
import { habitLimitFor, hasUnlimitedHabits } from "@/lib/entitlements";
import { qualifyReferralIfApplicable } from "@/lib/referrals";
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
    const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
    const habitCountBefore = await storage.countActiveHabits(user.id);

    if (!hasUnlimitedHabits(plan)) {
      const limit = habitLimitFor(plan)!;
      if (habitCountBefore >= limit) {
        return NextResponse.json(
          {
            message: `Free plan is limited to ${limit} protocols. Upgrade for unlimited.`,
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 402 },
        );
      }
    }

    const body = await request.json();
    const input = insertHabitSchema.parse(body);

    if (await storage.habitNameExists(user.id, input.name)) {
      return NextResponse.json(
        {
          message: `You already have a protocol named "${input.name}". Choose a different name, or edit the existing one instead.`,
          code: "DUPLICATE_HABIT_NAME",
        },
        { status: 409 },
      );
    }

    const habit = await storage.createHabit(user.id, input);

    // Referral qualification event: "creates first protocol" — only
    // check/fire on the user's actual first habit, not every creation.
    // Awaited (not fire-and-forget): a serverless function can terminate
    // right after the response is sent, which would silently kill an
    // un-awaited background task before it finishes.
    if (habitCountBefore === 0) {
      try {
        await qualifyReferralIfApplicable(user.id);
      } catch (err) {
        // Never let a referral-system hiccup block habit creation, which
        // already succeeded above — just log it for follow-up.
        console.error("Referral qualification check failed:", err);
      }
    }

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
