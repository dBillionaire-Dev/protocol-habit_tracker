import { storage } from "@/lib/storage";
import type { PlanTier, BillingInterval } from "shared/schema";

interface PaystackSubscriptionData {
  customer: { customer_code: string; email: string };
  subscription_code?: string;
  email_token?: string;
  next_payment_date?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Activates (or renews) a user's paid subscription from Paystack data.
 * Called from both the webhook (the reliable, server-to-server source of
 * truth) and the post-checkout redirect (so the UI can reflect the new
 * plan immediately instead of waiting on webhook delivery). Both paths
 * ultimately write the same row, so it's safe for this to run twice for
 * the same event.
 */
export async function activateSubscription(data: {
  userId: string;
  tier: Exclude<PlanTier, "free">;
  interval: BillingInterval;
  customerCode: string;
  subscriptionCode?: string;
  emailToken?: string;
  nextPaymentDate?: string | null;
}): Promise<void> {
  await storage.upsertSubscription({
    userId: data.userId,
    plan: data.tier,
    billingInterval: data.interval,
    status: "active",
    paystackCustomerCode: data.customerCode,
    paystackSubscriptionCode: data.subscriptionCode,
    paystackEmailToken: data.emailToken,
    currentPeriodEnd: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
  });
}

export async function markSubscriptionPastDue(userId: string): Promise<void> {
  await storage.upsertSubscription({ userId, status: "past_due" });
}

export async function cancelSubscriptionRecord(userId: string): Promise<void> {
  await storage.upsertSubscription({ userId, plan: "free", billingInterval: null, status: "cancelled" });
}

export type { PaystackSubscriptionData };
