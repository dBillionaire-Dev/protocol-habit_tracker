import type { PlanTier, BillingInterval } from "shared/schema";

/**
 * Maps (tier, interval) -> the Paystack Plan code to charge against.
 * Each of these has to be created once in your Paystack dashboard
 * (Plans -> Create Plan) with the real NGN amount and billing interval
 * set there — Paystack is the source of truth for the actual price
 * charged, not this file. The DISPLAY_PRICING constants below are only
 * for showing a number on the /pricing page and must be kept in sync
 * with whatever you actually set in Paystack.
 */
export function resolvePlanCode(tier: Exclude<PlanTier, "free">, interval: BillingInterval): string {
  const key =
    tier === "pro"
      ? interval === "monthly"
        ? "PAYSTACK_PRO_MONTHLY_PLAN_CODE"
        : "PAYSTACK_PRO_ANNUAL_PLAN_CODE"
      : interval === "monthly"
        ? "PAYSTACK_PREMIUM_PLUS_MONTHLY_PLAN_CODE"
        : "PAYSTACK_PREMIUM_PLUS_ANNUAL_PLAN_CODE";

  const code = process.env[key];
  if (!code) {
    throw new Error(
      `${key} must be set. Create a matching Plan in your Paystack dashboard (Plans -> Create Plan) and copy its code.`,
    );
  }
  return code;
}

// Display-only NGN amounts for the pricing page. These are starting
// suggestions (~$2-4/mo equivalent) — update to match whatever you
// actually configure in Paystack. Annual pricing here gives ~2 months
// free relative to paying monthly, a common SaaS convention; adjust as
// you like.
export const DISPLAY_PRICING: Record<
  Exclude<PlanTier, "free">,
  Record<BillingInterval, number>
> = {
  pro: {
    monthly: 2500,
    annual: 25000,
  },
  premium_plus: {
    monthly: 6000,
    annual: 60000,
  },
};

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}
