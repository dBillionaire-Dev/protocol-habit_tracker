import { db } from "./db";
import { users, referrals, referralRewards, subscriptions, REFERRAL_REWARD_CONFIG } from "shared/schema";
import type { PlanTier, RewardType } from "shared/schema";
import { eq, and, count, sql } from "drizzle-orm";

/**
 * Generates a short, unique-enough referral code. Collisions are checked
 * for and retried — astronomically unlikely at this scale, but cheap to
 * guard against outright.
 */
function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, avoids ambiguous codes
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const [existing] = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId));
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      return code;
    } catch {
      // Unique constraint hit — extremely unlikely, just retry with a new code.
      continue;
    }
  }
  throw new Error("Failed to generate a unique referral code after 5 attempts");
}

/**
 * Attributes a new user to a referrer, per spec section 39: capture on
 * signup, associate after account creation, one referrer per account,
 * immutable once set, backend-only.
 *
 * Fraud guards (spec section 40):
 *   - Self-referral: rejected if the code belongs to the user themselves.
 *   - Already attributed: a no-op if this user already has a referrer —
 *     referredByUserId is never overwritten.
 *   - Invalid code: silently ignored (no error surfaced to the client
 *     beyond "not attributed") — an invalid/typo'd code shouldn't block
 *     signup or leak whether a code exists.
 */
export async function attributeReferral(params: {
  newUserId: string;
  referralCode: string;
}): Promise<{ attributed: boolean }> {
  const [newUser] = await db.select().from(users).where(eq(users.id, params.newUserId));
  if (!newUser) return { attributed: false };
  if (newUser.referredByUserId) return { attributed: false }; // already has a referrer, immutable

  const [referrer] = await db
    .select()
    .from(users)
    .where(eq(users.referralCode, params.referralCode.toUpperCase().trim()));
  if (!referrer) return { attributed: false };
  if (referrer.id === params.newUserId) return { attributed: false }; // self-referral

  await db.transaction(async (tx) => {
    // Re-check inside the transaction in case of a race between two
    // concurrent attribution attempts for the same new user.
    const [current] = await tx.select({ referredByUserId: users.referredByUserId }).from(users).where(eq(users.id, params.newUserId));
    if (current?.referredByUserId) return;

    await tx.update(users).set({ referredByUserId: referrer.id }).where(eq(users.id, params.newUserId));
    await tx.insert(referrals).values({
      referrerId: referrer.id,
      referredUserId: params.newUserId,
      status: "pending",
    });
  });

  return { attributed: true };
}

/**
 * Idempotently grants a referral reward. Returns true if this call
 * actually granted something new, false if it was already granted
 * (a safe no-op, not an error) — the caller doesn't need to distinguish
 * these for correctness, only for logging/response purposes.
 *
 * Idempotency is enforced by Postgres itself via the UNIQUE constraint
 * on referralRewards.idempotencyKey, not by an application-level check-
 * then-insert (which would have a race window) — the insert either
 * succeeds once, ever, or is rejected.
 */
async function grantReward(params: {
  userId: string;
  referralId: number | null;
  rewardType: RewardType;
  planGranted: PlanTier;
  daysGranted: number;
  reason: string;
  idempotencyKey: string;
}): Promise<boolean> {
  if (params.planGranted === "free") return false; // rewards only ever grant paid tiers
  const planGranted = params.planGranted; // narrowed to "pro" | "premium_plus" from here on

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(referralRewards)
      .values({
        userId: params.userId,
        referralId: params.referralId,
        rewardType: params.rewardType,
        planGranted,
        daysGranted: params.daysGranted,
        reason: params.reason,
        idempotencyKey: params.idempotencyKey,
      })
      .onConflictDoNothing({ target: referralRewards.idempotencyKey })
      .returning();

    if (inserted.length === 0) {
      return false; // already granted — idempotent no-op
    }

    // Row-lock the subscription so concurrent grants for the same user
    // extend the bonus correctly rather than racing on a stale read.
    await tx.execute(sql`SELECT user_id FROM subscriptions WHERE user_id = ${params.userId} FOR UPDATE`);

    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, params.userId));
    const now = new Date();
    const currentExpiry = sub?.referralBonusExpiresAt && sub.referralBonusExpiresAt > now ? sub.referralBonusExpiresAt : now;
    const newExpiry = new Date(currentExpiry.getTime() + params.daysGranted * 24 * 60 * 60 * 1000);

    const rank: Record<PlanTier, number> = { free: 0, pro: 1, premium_plus: 2 };
    const currentBonusPlan = sub?.referralBonusPlan ?? "free";
    const combinedPlan = rank[planGranted] > rank[currentBonusPlan] ? planGranted : currentBonusPlan;

    await tx
      .insert(subscriptions)
      .values({
        userId: params.userId,
        referralBonusPlan: combinedPlan,
        referralBonusExpiresAt: newExpiry,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          referralBonusPlan: combinedPlan,
          referralBonusExpiresAt: newExpiry,
          updatedAt: new Date(),
        },
      });

    return true;
  });
}

/**
 * Call after a referred user completes the qualification event (creating
 * their first protocol). Marks the referral qualified, then checks
 * whether the referrer has now crossed the 3- or 10-qualified-referral
 * milestone and grants that reward if so (idempotent either way).
 */
export async function qualifyReferralIfApplicable(referredUserId: string): Promise<void> {
  const [referral] = await db.select().from(referrals).where(eq(referrals.referredUserId, referredUserId));
  if (!referral || referral.status !== "pending") return;

  await db
    .update(referrals)
    .set({ status: "qualified", qualifiedAt: new Date() })
    .where(eq(referrals.id, referral.id));

  const [{ qualifiedCount }] = await db
    .select({ qualifiedCount: count() })
    .from(referrals)
    .where(and(eq(referrals.referrerId, referral.referrerId), eq(referrals.status, "qualified")));

  if (qualifiedCount >= REFERRAL_REWARD_CONFIG.milestone10.qualifiedCount) {
    await grantReward({
      userId: referral.referrerId,
      referralId: null,
      rewardType: "milestone_10",
      planGranted: REFERRAL_REWARD_CONFIG.milestone10.plan,
      daysGranted: REFERRAL_REWARD_CONFIG.milestone10.days,
      reason: `${REFERRAL_REWARD_CONFIG.milestone10.qualifiedCount} successful referrals`,
      idempotencyKey: `milestone_10_${referral.referrerId}`,
    });
  }
  if (qualifiedCount >= REFERRAL_REWARD_CONFIG.milestone3.qualifiedCount) {
    await grantReward({
      userId: referral.referrerId,
      referralId: null,
      rewardType: "milestone_3",
      planGranted: REFERRAL_REWARD_CONFIG.milestone3.plan,
      daysGranted: REFERRAL_REWARD_CONFIG.milestone3.days,
      reason: `${REFERRAL_REWARD_CONFIG.milestone3.qualifiedCount} successful referrals`,
      idempotencyKey: `milestone_3_${referral.referrerId}`,
    });
  }
}

/**
 * Call when a referred user's subscription is activated to a paid tier
 * (from billing.ts's activateSubscription). Grants the referrer `days`
 * of the SAME tier the referred person purchased — idempotent per
 * referral, so this is safe to call from both the webhook and the
 * post-checkout callback for the same event.
 */
export async function handlePaidReferralIfApplicable(params: {
  referredUserId: string;
  purchasedPlan: Exclude<PlanTier, "free">;
}): Promise<void> {
  const [referral] = await db.select().from(referrals).where(eq(referrals.referredUserId, params.referredUserId));
  if (!referral) return;

  if (referral.status !== "paid") {
    await db.update(referrals).set({ status: "paid", paidAt: new Date() }).where(eq(referrals.id, referral.id));
  }

  await grantReward({
    userId: referral.referrerId,
    referralId: referral.id,
    rewardType: "paid_referral",
    planGranted: params.purchasedPlan,
    daysGranted: REFERRAL_REWARD_CONFIG.paidReferral.days,
    reason: `Referred user upgraded to ${params.purchasedPlan}`,
    // Keyed to the referral relationship, not the individual payment
    // event — this reward is meant to fire once per referral, not once
    // per billing cycle.
    idempotencyKey: `paid_referral_${referral.id}`,
  });
}

export interface ReferralStats {
  referralCode: string;
  totalInvited: number;
  signedUp: number;
  qualified: number;
  paidConversions: number;
  bonusPlan: PlanTier | null;
  bonusExpiresAt: string | null;
  bonusDaysRemaining: number;
  nextMilestone: { qualifiedNeeded: number; days: number } | null;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const referralCode = await ensureReferralCode(userId);

  const rows = await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  const signedUp = rows.length; // every row here = a completed signup already
  const qualified = rows.filter((r) => r.status === "qualified" || r.status === "paid").length;
  const paidConversions = rows.filter((r) => r.status === "paid").length;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const bonusActive = !!(sub?.referralBonusExpiresAt && sub.referralBonusExpiresAt.getTime() > Date.now());
  const bonusDaysRemaining = bonusActive
    ? Math.ceil((sub!.referralBonusExpiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  let nextMilestone: ReferralStats["nextMilestone"] = null;
  if (qualified < REFERRAL_REWARD_CONFIG.milestone3.qualifiedCount) {
    nextMilestone = { qualifiedNeeded: REFERRAL_REWARD_CONFIG.milestone3.qualifiedCount, days: REFERRAL_REWARD_CONFIG.milestone3.days };
  } else if (qualified < REFERRAL_REWARD_CONFIG.milestone10.qualifiedCount) {
    nextMilestone = { qualifiedNeeded: REFERRAL_REWARD_CONFIG.milestone10.qualifiedCount, days: REFERRAL_REWARD_CONFIG.milestone10.days };
  }

  return {
    referralCode,
    totalInvited: signedUp,
    signedUp,
    qualified,
    paidConversions,
    bonusPlan: bonusActive ? (sub!.referralBonusPlan as PlanTier) : null,
    bonusExpiresAt: bonusActive ? sub!.referralBonusExpiresAt!.toISOString() : null,
    bonusDaysRemaining,
    nextMilestone,
  };
}
