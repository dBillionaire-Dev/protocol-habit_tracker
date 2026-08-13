import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { PLAN_TIERS } from "shared/schema";
import { z } from "zod";

const input = z.object({
  // null clears the preview and returns the super user to full access.
  plan: z.enum(PLAN_TIERS).nullable(),
});

// Lets a super user (see SUPER_USER_EMAILS) set which tier they want to
// experience the app as, for testing gating without touching real
// billing. Hard-blocked for everyone else — this must never be reachable
// as a way to grant anyone anything; it can only make a super user's own
// access MORE restrictive (or reset it), never grant a non-super-user
// paid features.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Not available for guest sessions" }, { status: 400 });
  }
  if (!user.isSuperUser) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
  }

  await storage.upsertSubscription({
    userId: user.id,
    previewPlan: parsed.data.plan,
  });

  return NextResponse.json({ previewPlan: parsed.data.plan });
}
