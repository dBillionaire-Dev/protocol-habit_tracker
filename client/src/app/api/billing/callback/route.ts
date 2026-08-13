import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { activateSubscription } from "@/lib/billing";
import type { PlanTier, BillingInterval } from "shared/schema";

// Paystack redirects the user's browser here after checkout (success or
// not) with ?reference=. We verify it server-side and activate
// immediately so the UI can show the new plan right away, rather than
// making the user wait on webhook delivery — the webhook
// (../webhook/route.ts) remains the reliable source of truth and will
// just confirm the same state again when it arrives.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  try {
    const data = await verifyTransaction(reference);
    const metadata = data.metadata as
      | { userId?: string; tier?: PlanTier; interval?: BillingInterval }
      | undefined;

    if (data.status === "success" && metadata?.userId && metadata.tier && metadata.tier !== "free" && metadata.interval) {
      await activateSubscription({
        userId: metadata.userId,
        tier: metadata.tier,
        interval: metadata.interval,
        customerCode: data.customer.customer_code,
      });
      return NextResponse.redirect(`${origin}/dashboard?upgraded=${metadata.tier}`);
    }
  } catch (err) {
    console.error("Failed to verify Paystack transaction on callback:", err);
  }

  return NextResponse.redirect(`${origin}/dashboard?upgrade_failed=true`);
}
