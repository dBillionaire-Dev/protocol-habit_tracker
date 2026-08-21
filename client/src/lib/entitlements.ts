import { FREE_PLAN_HABIT_LIMIT, TRIAL_CONFIG, type PlanTier, type TrialType } from "shared/schema";

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
const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, premium_plus: 2 };

export function effectivePlan(params: {
  realPlan: PlanTier;
  isSuperUser: boolean;
  previewPlan: PlanTier | null;
  // Referral bonus — free access earned via referrals, entirely separate
  // from real billing. Only ever upgrades effective access, never
  // downgrades it: a paid Premium Plus user with a smaller Pro bonus
  // active stays at Premium Plus.
  referralBonusPlan?: PlanTier | null;
  referralBonusActive?: boolean;
  // Active subscription trial (see shared/schema.ts TRIAL_CONFIG and
  // storage.getEffectivePlan). Like the referral bonus, this ONLY ever
  // grants access on top of realPlan, never replaces or downgrades it —
  // which is exactly why "Pro -> Premium Plus trial reverts to Pro, not
  // Free" works automatically: once trialActive is false, effectivePlan
  // just falls back to realPlan, whatever that already was.
  trialType?: TrialType | null;
  trialActive?: boolean;
}): PlanTier {
  if (params.isSuperUser) {
    if (params.previewPlan) return params.previewPlan;
    return "premium_plus";
  }

  const candidates: PlanTier[] = [params.realPlan];

  if (
    params.referralBonusActive &&
    params.referralBonusPlan &&
    PLAN_RANK[params.referralBonusPlan] > PLAN_RANK[params.realPlan]
  ) {
    candidates.push(params.referralBonusPlan);
  }

  if (params.trialActive && params.trialType) {
    candidates.push(TRIAL_CONFIG[params.trialType].grantsPlan);
  }

  return candidates.reduce((best, plan) => (PLAN_RANK[plan] > PLAN_RANK[best] ? plan : best));
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

/**
 * Feature-level entitlements, per the product spec's suggested API:
 *   hasFeature(plan, "advanced_analytics")
 * This is the single place that changes when a feature moves between
 * tiers — routes and UI should call this rather than comparing plan
 * strings directly. habitLimitFor/hasUnlimitedHabits above predate this
 * and stay as-is (habit limits work differently: a number, not a
 * boolean), but every new gated feature should go through here.
 */
export type FeatureKey =
  | "advanced_analytics"
  | "full_history"
  | "custom_rules"
  | "data_export"
  | "advanced_insights"
  | "ai_insights"
  | "ai_planning"
  | "accountability"
  | "unrestricted_habit_editing"
  | "flexible_confirmation";

const FEATURE_MATRIX: Record<FeatureKey, readonly PlanTier[]> = {
  advanced_analytics: ["pro", "premium_plus"],
  full_history: ["pro", "premium_plus"],
  custom_rules: ["pro", "premium_plus"],
  data_export: ["pro", "premium_plus"],
  advanced_insights: ["pro", "premium_plus"],
  ai_insights: ["premium_plus"],
  ai_planning: ["premium_plus"],
  accountability: ["premium_plus"],
  // Free users can only edit a habit within FREE_PLAN_HABIT_EDIT_WINDOW_MS
  // of creating it (see requireHabitEditable). Pro/Premium Plus can edit
  // anytime.
  unrestricted_habit_editing: ["pro", "premium_plus"],
  // Premium Plus only: bypasses the normal 9PM-11:59PM confirmation
  // window entirely (see the server-side check in
  // api/habits/[id]/clean-day/route.ts and useConfirmationWindow in
  // day-confirmation-card.tsx). Free and Pro remain window-restricted.
  flexible_confirmation: ["premium_plus"],
};

export function hasFeature(plan: PlanTier, feature: FeatureKey): boolean {
  return FEATURE_MATRIX[feature].includes(plan);
}
