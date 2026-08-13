import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  activateSubscription,
  markSubscriptionPastDue,
  cancelSubscriptionRecord,
} from "@/lib/billing";
import type { PlanTier, BillingInterval } from "shared/schema";

// Paystack webhook. This endpoint is publicly reachable by design (Paystack
// calls it from their servers), so EVERY request must have its signature
// verified against the raw body before any event is trusted — never trust
// the parsed JSON alone, since anyone can POST here.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.warn("Rejected Paystack webhook with invalid signature");
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const metadata = event.data?.metadata as
    | { userId?: string; tier?: PlanTier; interval?: BillingInterval }
    | undefined;
  const userId = metadata?.userId;

  try {
    switch (event.event) {
      case "charge.success":
      case "subscription.create": {
        const data = event.data;
        if (!userId || !metadata?.tier || !metadata?.interval) {
          console.warn(`Paystack ${event.event} event missing tier/interval/userId in metadata`, data.reference);
          break;
        }
        if (metadata.tier === "free") break; // shouldn't happen, but guard anyway
        await activateSubscription({
          userId,
          tier: metadata.tier,
          interval: metadata.interval,
          customerCode: data.customer?.customer_code,
          subscriptionCode: data.subscription_code,
          emailToken: data.email_token,
          nextPaymentDate: data.next_payment_date ?? null,
        });
        break;
      }

      case "invoice.payment_failed": {
        if (userId) await markSubscriptionPastDue(userId);
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        if (userId) await cancelSubscriptionRecord(userId);
        break;
      }

      default:
        // Unhandled event types are fine to ignore — Paystack sends many
        // more event kinds than we act on.
        break;
    }
  } catch (err) {
    console.error(`Failed to process Paystack webhook (${event.event}):`, err);
    // Still 200 — Paystack retries on non-2xx, and a DB hiccup on our end
    // shouldn't cause Paystack to hammer this endpoint. Errors are logged
    // for manual follow-up instead.
  }

  return NextResponse.json({ received: true });
}
