import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { FREE_PLAN_HABIT_LIMIT } from "shared/schema";

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.id === GUEST_USER_ID) {
    return NextResponse.json({
      plan: "free",
      status: null,
      habitCount: 0,
      habitLimit: FREE_PLAN_HABIT_LIMIT,
    });
  }

  const [sub, habitCount] = await Promise.all([
    storage.getSubscription(user.id),
    storage.countActiveHabits(user.id),
  ]);

  const isPro = sub?.plan === "pro" && sub.status === "active";

  return NextResponse.json({
    plan: isPro ? "pro" : "free",
    status: sub?.status ?? null,
    habitCount,
    habitLimit: isPro ? null : FREE_PLAN_HABIT_LIMIT,
  });
}
