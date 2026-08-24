import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { hasFeature } from "@/lib/entitlements";
import { z } from "zod";

const input = z.object({
  habitId: z.number().int(),
  partnerEmail: z.string().email(),
});

// POST /api/partnerships/invite — spec section 18: "This is a Pro and
// Premium Plus feature." Checked here, server-side, rather than just
// hiding the invite button — see storage.createPartnership for the rest
// of the validation (habit ownership, Build-only, no self-invite, no
// duplicate pending invite to the same person for the same habit).
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "streak_partners")) {
    return NextResponse.json(
      { message: "Streak partners is a Pro and Premium Plus feature.", code: "PLAN_REQUIRED" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof input>;
  try {
    body = input.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  try {
    const partnership = await storage.createPartnership(user.id, body.habitId, body.partnerEmail);
    return NextResponse.json(partnership);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to send invite." },
      { status: 400 },
    );
  }
}
