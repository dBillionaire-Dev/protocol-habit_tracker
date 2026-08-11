import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { initializeSubscriptionTransaction } from "@/lib/paystack";

// Starts a Pro subscription checkout. Returns a Paystack-hosted checkout
// URL for the client to redirect to — actual subscription creation is
// confirmed via webhook (see ../webhook/route.ts), not this response,
// since the user hasn't paid yet at this point.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a real account to subscribe to Pro." },
      { status: 400 },
    );
  }
  if (!user.email) {
    return NextResponse.json(
      { message: "Your account has no email on file." },
      { status: 400 },
    );
  }

  const planCode = process.env.PAYSTACK_PRO_PLAN_CODE;
  if (!planCode) {
    return NextResponse.json(
      { message: "Billing isn't configured yet." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    const { authorization_url } = await initializeSubscriptionTransaction({
      email: user.email,
      planCode,
      callbackUrl: `${appUrl}/api/billing/callback`,
      metadata: { userId: user.id },
    });
    return NextResponse.json({ authorizationUrl: authorization_url });
  } catch (err) {
    console.error("Failed to initialize Paystack transaction:", err);
    return NextResponse.json(
      { message: "Failed to start checkout" },
      { status: 500 },
    );
  }
}
