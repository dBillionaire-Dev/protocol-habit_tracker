import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { disableSubscription } from "@/lib/paystack";

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Nothing to cancel" }, { status: 400 });
  }

  const sub = await storage.getSubscription(user.id);
  if (!sub?.paystackSubscriptionCode || !sub.paystackEmailToken) {
    return NextResponse.json(
      { message: "No active subscription found" },
      { status: 404 },
    );
  }

  try {
    await disableSubscription({
      subscriptionCode: sub.paystackSubscriptionCode,
      emailToken: sub.paystackEmailToken,
    });
    // Paystack will also fire a subscription.disable webhook, but we
    // update locally too so the UI reflects it immediately.
    await storage.upsertSubscription({
      userId: user.id,
      plan: "free",
      status: "cancelled",
    });
    return NextResponse.json({ message: "Subscription cancelled" });
  } catch (err) {
    console.error("Failed to cancel Paystack subscription:", err);
    return NextResponse.json(
      { message: "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
