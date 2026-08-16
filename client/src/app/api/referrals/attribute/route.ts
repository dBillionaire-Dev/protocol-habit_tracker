import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { attributeReferral } from "@/lib/referrals";
import { z } from "zod";

const input = z.object({
  code: z.string().min(1).max(20),
});

// Called once, client-side, after a real signup, with a referral code
// captured from ?ref= earlier in the flow. Safe to call repeatedly —
// attribution only ever applies once per account (see
// lib/referrals.ts's attributeReferral), so redundant calls are no-ops.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json({ attributed: false });
  }

  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid code" }, { status: 400 });
  }

  const result = await attributeReferral({ newUserId: user.id, referralCode: parsed.data.code });
  return NextResponse.json(result);
}
