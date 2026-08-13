import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { habitLimitFor, effectivePlan } from "@/lib/entitlements";

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.id === GUEST_USER_ID) {
    return NextResponse.json({
      plan: "free" as const,
      billingInterval: null,
      status: null,
      habitCount: 0,
      habitLimit: habitLimitFor("free"),
      isSuperUser: false,
      realPlan: "free" as const,
      previewPlan: null,
    });
  }

  const [sub, habitCount] = await Promise.all([
    storage.getSubscription(user.id),
    storage.countActiveHabits(user.id),
  ]);

  const isActive = sub?.status === "active" && sub.plan !== "free";
  const realPlan = isActive ? sub.plan : "free";
  const plan = effectivePlan({
    realPlan,
    isSuperUser: user.isSuperUser,
    previewPlan: sub?.previewPlan ?? null,
  });

  return NextResponse.json({
    plan,
    billingInterval: isActive ? sub.billingInterval : null,
    status: sub?.status ?? null,
    habitCount,
    habitLimit: habitLimitFor(plan),
    isSuperUser: user.isSuperUser,
    realPlan,
    previewPlan: sub?.previewPlan ?? null,
  });
}
