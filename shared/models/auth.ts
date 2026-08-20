import { pgTable, varchar, timestamp, boolean, serial, integer, text, unique, type AnyPgColumn } from "drizzle-orm/pg-core";

// Profile table. Rows here are keyed 1:1 with Supabase's `auth.users.id`
// (a uuid). Supabase Auth owns credentials/identities; this table only
// holds the app-specific profile fields we care about.
//
// Note: there is no formal cross-schema FK to auth.users here because
// Drizzle migrations don't manage the `auth` schema. Rows are created via
// upsert the first time a verified user hits the API (see
// server/middleware/require-user.ts), so referential integrity is
// enforced in application code rather than the database.
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // matches auth.users.id (uuid as text)
  email: varchar("email").unique(),
  provider: varchar("provider").default("email"), // "email", "google", "guest"
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  showOnboarding: varchar("show_onboarding").default("true"),
  // Full access to every feature/tier regardless of billing status, for
  // internal testing. Set automatically on login based on the
  // SUPER_USER_EMAILS env var allow-list (see require-user.ts) — not
  // hand-edited in the DB, so removing an email from that list revokes
  // access on the person's next login too.
  isSuperUser: boolean("is_super_user").notNull().default(false),
  // Every user gets a unique referral code, generated on first login
  // (see require-user.ts). Immutable once set.
  referralCode: varchar("referral_code").unique(),
  // Who referred this user, if anyone — set at most once, server-side
  // only (POST /api/referrals/attribute), never changeable afterward.
  // Nullable self-reference: a user's referrer is another user.
  referredByUserId: varchar("referred_by_user_id").references((): AnyPgColumn => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// One row per user, tracking their plan and Paystack subscription state.
// A user with no row here (or status !== "active") is on the free plan.
export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "cancelled",
  "attention", // Paystack's status for a subscription with a failed charge that hasn't yet lapsed
] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const PLAN_TIERS = ["free", "pro", "premium_plus"] as const;
export type PlanTier = typeof PLAN_TIERS[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = typeof BILLING_INTERVALS[number];

export const subscriptions = pgTable("subscriptions", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  plan: varchar("plan", { enum: PLAN_TIERS }).notNull().default("free"),
  billingInterval: varchar("billing_interval", { enum: BILLING_INTERVALS }),
  status: varchar("status", { enum: SUBSCRIPTION_STATUSES }),
  paystackCustomerCode: varchar("paystack_customer_code"),
  paystackSubscriptionCode: varchar("paystack_subscription_code"),
  paystackEmailToken: varchar("paystack_email_token"), // needed to call the "disable subscription" endpoint
  currentPeriodEnd: timestamp("current_period_end"),
  // Super-user only: lets an internal tester view/experience the app as
  // if they were on a specific tier, without touching their real
  // subscription. Ignored entirely for non-super-users (enforced
  // server-side in the preview-plan route, not just by convention). Null
  // means "not previewing" — super users default to full access.
  previewPlan: varchar("preview_plan", { enum: PLAN_TIERS }),
  // Free access earned via referral rewards — separate from real
  // Paystack billing entirely. See entitlements.effectivePlan: this
  // only ever grants MORE access than the real plan, never less, and
  // never overrides an active paid subscription of equal or higher
  // tier. referralBonusPlan is the tier granted; the bonus is active
  // exactly while referralBonusExpiresAt is in the future.
  referralBonusPlan: varchar("referral_bonus_plan", { enum: PLAN_TIERS }),
  referralBonusExpiresAt: timestamp("referral_bonus_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type UpsertSubscription = typeof subscriptions.$inferInsert;

// --- Subscription trials ---
//
// Each of the three trial types (spec section 1) can be used AT MOST
// ONCE ever, per user — enforced by the unique(userId, trialType)
// constraint below, not just app-side logic. A row existing at all means
// that trial has been used; whether it's still ACTIVE is a separate
// question (endsAt > now).
//
// Deliberately its own table rather than more columns on `subscriptions`:
//   1. Three independent one-time-use flags (one per trial type) need
//      their own uniqueness guarantee each, which maps cleanly onto one
//      row per (user, type) rather than three parallel nullable column
//      sets on a table that's otherwise one-row-per-user.
//   2. It keeps a permanent, auditable record of every trial ever
//      granted (when it started, when it ended, which reminders fired)
//      instead of being overwritten/cleared when a trial ends.
//
// How this composes with billing (see entitlements.effectivePlan and
// storage.getEffectivePlan, which is the ONLY place that should ever
// read this table): starting a trial never touches `subscriptions.plan`
// or `.status` at all — the real paid plan (or lack thereof) is
// untouched throughout. A trial is purely a temporary, expiring
// *bonus* on top of the real plan, exactly like referralBonusPlan. This
// This
// is what makes "Pro -> Premium Plus trial reverts to Pro, not Free" fall
// out for free: effectivePlan always falls back to the real
// (untouched-by-the-trial) plan once the trial's endsAt has passed.
export const TRIAL_TYPES = [
  "pro_from_free",
  "premium_plus_from_free",
  "premium_plus_from_pro",
] as const;
export type TrialType = typeof TRIAL_TYPES[number];

export const TRIAL_CONFIG: Record<
  TrialType,
  { days: number; grantsPlan: Exclude<PlanTier, "free">; eligibleFromPlan: PlanTier }
> = {
  pro_from_free: { days: 7, grantsPlan: "pro", eligibleFromPlan: "free" },
  premium_plus_from_free: { days: 3, grantsPlan: "premium_plus", eligibleFromPlan: "free" },
  premium_plus_from_pro: { days: 7, grantsPlan: "premium_plus", eligibleFromPlan: "pro" },
};

export const TRIAL_REMINDER_KEYS = ["two_days", "one_day", "final"] as const;
export type TrialReminderKey = typeof TRIAL_REMINDER_KEYS[number];

// Which reminder checkpoints apply to each trial type, and how many
// hours before `endsAt` each one should fire (see
// lib/trial-reminders.ts). Spec section 1 gives different suggested
// schedules per trial: the 7-day trials get a "2 days remaining" nudge
// that the 3-day Premium-Plus-from-Free trial skips (too soon after
// starting to be useful).
export const TRIAL_REMINDER_SCHEDULE: Record<TrialType, readonly { key: TrialReminderKey; hoursBefore: number }[]> = {
  pro_from_free: [
    { key: "two_days", hoursBefore: 48 },
    { key: "one_day", hoursBefore: 24 },
    { key: "final", hoursBefore: 3 },
  ],
  premium_plus_from_free: [
    { key: "one_day", hoursBefore: 24 },
    { key: "final", hoursBefore: 3 },
  ],
  premium_plus_from_pro: [
    { key: "two_days", hoursBefore: 48 },
    { key: "one_day", hoursBefore: 24 },
    { key: "final", hoursBefore: 3 },
  ],
};

export const subscriptionTrials = pgTable(
  "subscription_trials",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => users.id),
    trialType: varchar("trial_type", { enum: TRIAL_TYPES }).notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endsAt: timestamp("ends_at").notNull(),
    // Individually-tracked booleans rather than an array column — small,
    // fixed, known set of checkpoints (see TRIAL_REMINDER_KEYS), and
    // booleans keep `lib/trial-reminders.ts` a plain read-check-write
    // with no array-membership logic or driver-specific array typing.
    twoDayReminderSentAt: timestamp("two_day_reminder_sent_at"),
    oneDayReminderSentAt: timestamp("one_day_reminder_sent_at"),
    finalReminderSentAt: timestamp("final_reminder_sent_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // The actual one-time-use enforcement: Postgres rejects a second
    // insert for the same (userId, trialType) outright, so this can
    // never be bypassed by a race condition or an app-logic bug.
    onePerUserPerType: unique().on(table.userId, table.trialType),
  }),
);

export type SubscriptionTrial = typeof subscriptionTrials.$inferSelect;
export type InsertSubscriptionTrial = typeof subscriptionTrials.$inferInsert;

// --- Referrals ---

export const REFERRAL_STATUSES = ["pending", "qualified", "paid"] as const;
export type ReferralStatus = typeof REFERRAL_STATUSES[number];

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  // One row per referred user — a person can only ever be referred once,
  // enforced by this being unique (and by users.referredByUserId only
  // ever being set a single time, never overwritten).
  referredUserId: varchar("referred_user_id").notNull().unique().references(() => users.id),
  status: varchar("status", { enum: REFERRAL_STATUSES }).notNull().default("pending"),
  qualifiedAt: timestamp("qualified_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Referral = typeof referrals.$inferSelect;

export const REWARD_TYPES = ["milestone_3", "milestone_10", "paid_referral"] as const;
export type RewardType = typeof REWARD_TYPES[number];

// The reward ledger (spec section 41). Every grant is a row here, and
// every row's idempotencyKey is UNIQUE — that constraint, enforced by
// Postgres itself, is what makes reward-granting idempotent. A reward
// is only ever inserted once; a duplicate attempt (e.g. a webhook firing
// twice, or the same milestone check running twice) hits the unique
// constraint and is treated as a no-op, not an error.
export const referralRewards = pgTable("referral_rewards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id), // who RECEIVES the reward
  referralId: integer("referral_id").references(() => referrals.id),
  rewardType: varchar("reward_type", { enum: REWARD_TYPES }).notNull(),
  planGranted: varchar("plan_granted", { enum: ["pro", "premium_plus"] }).notNull(),
  daysGranted: integer("days_granted").notNull(),
  reason: text("reason").notNull(),
  idempotencyKey: varchar("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ReferralReward = typeof referralRewards.$inferSelect;

// All reward values are configurable here, per spec section 37 ("All
// values must be configurable") — change these, not scattered literals
// elsewhere.
export const REFERRAL_REWARD_CONFIG = {
  milestone3: { qualifiedCount: 3, days: 30, plan: "pro" as const },
  milestone10: { qualifiedCount: 10, days: 90, plan: "pro" as const },
  // Paid referral: the referrer gets `days` of whatever plan the
  // referred person actually purchased (pro -> pro, premium_plus ->
  // premium_plus) — matching Nexy's explicit instruction, which is more
  // specific than the spec's flat "always Pro" default.
  paidReferral: { days: 30 },
};

// Free plan is capped at 3 protocols total (Build + Avoidance combined),
// not 3 of each. Pro and Premium Plus are both unlimited — see
// client/src/lib/entitlements.ts for the single source of truth on what
// each tier can do, rather than scattering `plan === "..."` checks.
export const FREE_PLAN_HABIT_LIMIT = 3;

