import { storage } from "@/lib/storage";

interface PaystackSubscriptionData {
  customer: { customer_code: string; email: string };
  subscription_code?: string;
  email_token?: string;
  next_payment_date?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Activates (or renews) a user's Pro subscription from Paystack data.
 * Called from both the webhook (the reliable, server-to-server source of
 * truth) and the post-checkout redirect (so the UI can reflect "Pro"
 * immediately instead of waiting on webhook delivery). Both paths
 * ultimately write the same row, so it's safe for this to run twice for
 * the same event.
 */
export async function activateProSubscription(data: {
  userId: string;
  customerCode: string;
  subscriptionCode?: string;
  emailToken?: string;
  nextPaymentDate?: string | null;
}): Promise<void> {
  await storage.upsertSubscription({
    userId: data.userId,
    plan: "pro",
    status: "active",
    paystackCustomerCode: data.customerCode,
    paystackSubscriptionCode: data.subscriptionCode,
    paystackEmailToken: data.emailToken,
    currentPeriodEnd: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
  });
}

export async function markSubscriptionPastDue(userId: string): Promise<void> {
  await storage.upsertSubscription({ userId, plan: "pro", status: "past_due" });
}

export async function cancelSubscriptionRecord(userId: string): Promise<void> {
  await storage.upsertSubscription({ userId, plan: "free", status: "cancelled" });
}

export type { PaystackSubscriptionData };
