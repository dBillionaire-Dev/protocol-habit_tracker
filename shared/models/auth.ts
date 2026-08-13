import { pgTable, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type UpsertSubscription = typeof subscriptions.$inferInsert;

// Free plan is capped at 3 protocols total (Build + Avoidance combined),
// not 3 of each. Pro and Premium Plus are both unlimited — see
// client/src/lib/entitlements.ts for the single source of truth on what
// each tier can do, rather than scattering `plan === "..."` checks.
export const FREE_PLAN_HABIT_LIMIT = 3;

