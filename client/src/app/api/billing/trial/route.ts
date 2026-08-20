import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { TRIAL_TYPES, TRIAL_CONFIG, type TrialType } from "shared/schema";

// POST /api/billing/trial — start one of the three one-time subscription
// trials (spec section 1). Guest sessions can't hold a trial (there's no
// persistent account to attach it to), so this is real-account only.
//
// Eligibility (which plan a trial requires the user to currently be on)
// and the one-trial-per-type-ever rule are both enforced in
// storage.startTrial, backed by a DB-level unique constraint — this
// route just translates that into HTTP responses.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Sign up for a free account to start a trial." },
      { status: 403 },
    );
  }

  let trialType: TrialType;
  try {
    const body = await request.json();
    if (!TRIAL_TYPES.includes(body.trialType)) {
      return NextResponse.json({ message: "Invalid trial type." }, { status: 400 });
    }
    trialType = body.trialType;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const sub = await storage.getSubscription(user.id);
  const isActive = sub?.status === "active" && sub.plan !== "free";
  const realPlan = isActive ? sub!.plan : "free";

  try {
    const trial = await storage.startTrial(user.id, trialType, realPlan);
    return NextResponse.json({
      trialType: trial.trialType,
      startedAt: trial.startedAt,
      endsAt: trial.endsAt,
      grantsPlan: TRIAL_CONFIG[trialType].grantsPlan,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to start trial." },
      { status: 409 },
    );
  }
}
