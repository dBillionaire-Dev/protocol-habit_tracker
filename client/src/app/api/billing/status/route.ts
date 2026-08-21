import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { habitLimitFor } from "@/lib/entitlements";
import { TRIAL_TYPES, TRIAL_CONFIG, type TrialType } from "shared/schema";

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
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      activeTrial: null,
      eligibleTrials: [],
    });
  }

  const [sub, habitCount, plan, activeTrial, trialHistory] = await Promise.all([
    storage.getSubscription(user.id),
    storage.countActiveHabits(user.id),
    // Single source of truth for effective plan (real plan + super-user
    // preview + referral bonus + active trial) — see
    // storage.getEffectivePlan / entitlements.effectivePlan. Previously
    // this route computed plan inline and left out both the referral
    // bonus and (now) trials; routing through the same helper every
    // other plan-gated place uses keeps this endpoint from silently
    // disagreeing with them again as more bonus types get added.
    storage.getEffectivePlan(user.id, user.isSuperUser),
    storage.getActiveTrial(user.id),
    storage.getTrialHistory(user.id),
  ]);

  const isCancelledGracePeriod =
    sub?.status === "cancelled" && !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now();
  const isActive = (sub?.status === "active" || isCancelledGracePeriod) && sub?.plan !== "free";
  const realPlan = isActive ? sub!.plan : "free";
  const usedTrialTypes = new Set(trialHistory.map((t) => t.trialType));

  // Which of the 3 trial types this user could still start: not already
  // used, and their real (non-trial, non-bonus) plan matches what that
  // trial requires. Deliberately checked against realPlan, not the
  // effective plan — e.g. a Free user riding a referral-bonus "Pro"
  // effective plan should still be offered the real Free->Pro trial
  // slot, since their actual billing plan is still Free.
  const eligibleTrials = TRIAL_TYPES.filter(
    (t) => !usedTrialTypes.has(t) && TRIAL_CONFIG[t].eligibleFromPlan === realPlan,
  );

  return NextResponse.json({
    plan,
    billingInterval: isActive ? sub!.billingInterval : null,
    status: sub?.status ?? null,
    habitCount,
    habitLimit: habitLimitFor(plan),
    isSuperUser: user.isSuperUser,
    realPlan,
    previewPlan: sub?.previewPlan ?? null,
    // When exactly this plan renews (still-active subscription) or, if
    // `status` is "cancelled", when access actually ends and the user
    // drops to Free — see the grace-period note on isCancelledGracePeriod
    // above and cancelSubscriptionRecord in lib/billing.ts.
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: isCancelledGracePeriod,
    activeTrial: activeTrial
      ? {
          trialType: activeTrial.trialType,
          startedAt: activeTrial.startedAt,
          endsAt: activeTrial.endsAt,
          grantsPlan: TRIAL_CONFIG[activeTrial.trialType as TrialType].grantsPlan,
          returnsToPlan: realPlan,
        }
      : null,
    eligibleTrials,
  });
}
