import { FREE_PLAN_HABIT_LIMIT, type PlanTier } from "shared/schema";

/**
 * Computes the plan actually used for feature gating, accounting for
 * super users (internal test accounts, see SUPER_USER_EMAILS):
 *   - Non-super-users: always their real billing plan.
 *   - Super users with no preview set: full access (treated as
 *     premium_plus) regardless of what they're actually subscribed to —
 *     they shouldn't need a real subscription to test the app.
 *   - Super users with a preview set: exactly that tier, so they can
 *     verify free/pro gating actually works before it reaches real
 *     users. This deliberately makes gating *more* strict for a super
 *     user in preview mode, not less — the point is to test enforcement,
 *     not to bypass it further.
 *
 * previewPlan must be ignored entirely for non-super-users — enforced in
 * the route that sets it (api/billing/preview-plan), not just here, so a
 * stray/tampered value can never grant anything on its own.
 */
export function effectivePlan(params: {
  realPlan: PlanTier;
  isSuperUser: boolean;
  previewPlan: PlanTier | null;
}): PlanTier {
  if (!params.isSuperUser) return params.realPlan;
  if (params.previewPlan) return params.previewPlan;
  return "premium_plus";
}

/**
 * Single source of truth for what each plan tier can do. Route handlers
 * and UI components should check capabilities through these functions
 * rather than comparing `plan === "pro"` (or worse, `!== "free"`)
 * directly — that logic tends to drift out of sync across a codebase as
 * more tiers and features get added. This file is meant to be the one
 * place that changes when tier capabilities change.
 *
 * Phase 1 only wires up habit limits. Later phases (analytics, CSV
 * export, AI insights, live chat) will add their own hasX() functions
 * here rather than inlining checks elsewhere.
 */

export function habitLimitFor(plan: PlanTier): number | null {
  // null = unlimited
  if (plan === "free") return FREE_PLAN_HABIT_LIMIT;
  return null;
}

export function hasUnlimitedHabits(plan: PlanTier): boolean {
  return habitLimitFor(plan) === null;
}

export function isPaidPlan(plan: PlanTier): boolean {
  return plan !== "free";
}

export function planDisplayName(plan: PlanTier): string {
  switch (plan) {
    case "free":
      return "Free";
    case "pro":
      return "Pro";
    case "premium_plus":
      return "Premium Plus";
  }
}
