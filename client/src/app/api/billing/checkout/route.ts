import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { initializeSubscriptionTransaction } from "@/lib/paystack";
import { resolvePlanCode } from "@/lib/paystack/plans";
import { z } from "zod";

const input = z.object({
  tier: z.enum(["pro", "premium_plus"]),
  interval: z.enum(["monthly", "annual"]),
});

// Starts a subscription checkout for the chosen tier + billing interval.
// Returns a Paystack-hosted checkout URL for the client to redirect to —
// actual subscription creation is confirmed via webhook (see
// ../webhook/route.ts), not this response, since the user hasn't paid
// yet at this point.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a real account to subscribe." },
      { status: 400 },
    );
  }
  if (!user.email) {
    return NextResponse.json(
      { message: "Your account has no email on file." },
      { status: 400 },
    );
  }

  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid tier or interval" }, { status: 400 });
  }
  const { tier, interval } = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    const planCode = resolvePlanCode(tier, interval);
    const { authorization_url } = await initializeSubscriptionTransaction({
      email: user.email,
      planCode,
      callbackUrl: `${appUrl}/api/billing/callback`,
      metadata: { userId: user.id, tier, interval },
    });
    return NextResponse.json({ authorizationUrl: authorization_url });
  } catch (err) {
    console.error("Failed to initialize Paystack transaction:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to start checkout" },
      { status: 500 },
    );
  }
}
