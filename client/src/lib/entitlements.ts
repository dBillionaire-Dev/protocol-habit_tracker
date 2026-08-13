import { FREE_PLAN_HABIT_LIMIT, type PlanTier } from "shared/schema";

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
