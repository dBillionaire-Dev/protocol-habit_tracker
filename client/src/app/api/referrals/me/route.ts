import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { getReferralStats } from "@/lib/referrals";

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account to get your referral link.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const stats = await getReferralStats(user.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  return NextResponse.json({
    ...stats,
    referralLink: `${appUrl}/?ref=${stats.referralCode}`,
  });
}
