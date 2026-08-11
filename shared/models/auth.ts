import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

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

export const subscriptions = pgTable("subscriptions", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  plan: varchar("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  status: varchar("status", { enum: SUBSCRIPTION_STATUSES }),
  paystackCustomerCode: varchar("paystack_customer_code"),
  paystackSubscriptionCode: varchar("paystack_subscription_code"),
  paystackEmailToken: varchar("paystack_email_token"), // needed to call the "disable subscription" endpoint
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type UpsertSubscription = typeof subscriptions.$inferInsert;

export const FREE_PLAN_HABIT_LIMIT = 3;

