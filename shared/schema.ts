import { pgTable, text, serial, integer, boolean, timestamp, date, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// Export auth tables
export * from "./models/auth";
// Export admin tables (audit log, support tickets, system events)
export * from "./models/admin";

// Habit Types
// Free-plan habits can only be edited within this window after creation
// (see requireHabitEditable in lib/auth/require-user.ts, used by both the
// PATCH /api/habits/:id route and — for parity — guest-storage.ts, since
// guest sessions behave like Free for this purpose). Pro and Premium Plus
// are exempt entirely; this constant only ever applies to Free/guest.
export const FREE_PLAN_HABIT_EDIT_WINDOW_MS = 20 * 60 * 1000;

export const HABIT_TYPES = ["avoidance", "build"] as const;
export type HabitType = typeof HABIT_TYPES[number];

export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", { enum: HABIT_TYPES }).notNull(),
  baseTaskValue: integer("base_task_value"), // For build habits
  unit: text("unit"), // reps, minutes, pages, sessions
  // Build protocols only (Pro/Premium Plus, "Custom Protocol Rules").
  // Which days of the week this protocol is required: 0=Sunday .. 6=Saturday.
  // null or empty = required every day (the original, default behavior —
  // every existing habit has this unset, so nothing changes for them).
  // A day NOT in this list is a rest day: no requirement, not counted as
  // missed, doesn't count toward the penalty stack, doesn't break streaks.
  scheduledDays: integer("scheduled_days").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Streak tracking
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastStreakDate: date("last_streak_date"), // Last date that contributed to streak
  currentStreakStart: date("current_streak_start"), // When current streak began
  longestStreakStart: date("longest_streak_start"), // When longest streak began
  longestStreakEnd: date("longest_streak_end"), // When longest streak ended (if broken)
});

export const habitEvents = pgTable("habit_events", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habits.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  value: integer("value").default(1).notNull(),
  notes: text("notes"),
});

export const dailyHabitStatus = pgTable("daily_habit_status", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habits.id),
  date: date("date").notNull(),
  completed: boolean("completed").default(false).notNull(),
  penaltyLevel: integer("penalty_level").default(0).notNull(),
  autoProcessed: boolean("auto_processed").default(false).notNull(), // True if processed by midnight automation
}, (table) => ({
  habitDateUnique: unique().on(table.habitId, table.date),
}));

export const habitDebts = pgTable("habit_debts", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().unique().references(() => habits.id),
  debtCount: integer("debt_count").default(0).notNull(),
  lastCleanDate: date("last_clean_date"),
});

// Build-habit debt repayment history. Unlike avoidance's habitDebts (a
// single mutable counter), Build debt is DERIVED, not stored directly:
//   totalMissedDays = count of dailyHabitStatus rows where completed = false
//   totalRepaidDays = sum of this table's `amount` for the habit
//   remainingDebt   = max(0, totalMissedDays - totalRepaidDays)
// This keeps the missed-day history (already recorded in dailyHabitStatus)
// as the single source of truth, and makes repayment an auditable event
// log rather than a number the frontend could ever set directly.
export const buildDebtRepayments = pgTable("build_debt_repayments", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habits.id),
  userId: text("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BuildDebtRepayment = typeof buildDebtRepayments.$inferSelect;

// Schemas
export const insertHabitSchema = createInsertSchema(habits).omit({ 
  id: true, 
  userId: true, 
  createdAt: true,
  currentStreak: true,
  longestStreak: true,
  lastStreakDate: true,
  currentStreakStart: true,
  longestStreakStart: true,
  longestStreakEnd: true,
}).extend({
  type: z.enum(HABIT_TYPES),
  baseTaskValue: z.number().optional(),
  scheduledDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional()
    .refine((days) => !days || new Set(days).size === days.length, {
      message: "scheduledDays must not contain duplicate values",
    }),
});

export const insertHabitEventSchema = createInsertSchema(habitEvents).omit({ 
  id: true, 
  timestamp: true 
});

// Editing an existing habit. Deliberately narrower than insertHabitSchema:
// `type` is excluded — changing avoidance<->build after creation would
// leave existing debt/penalty/history data (recorded under the old
// type's assumptions) in an ambiguous state, so type is fixed at
// creation and this only covers fields safe to change afterward.
export const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  baseTaskValue: z.number().optional(),
  unit: z.string().optional(),
  scheduledDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional()
    .refine((days) => !days || new Set(days).size === days.length, {
      message: "scheduledDays must not contain duplicate values",
    }),
});
export type UpdateHabitRequest = z.infer<typeof updateHabitSchema>;

export const insertDailyStatusSchema = createInsertSchema(dailyHabitStatus).omit({ 
  id: true 
});

// Types
export type Habit = typeof habits.$inferSelect;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type HabitEvent = typeof habitEvents.$inferSelect;
export type DailyHabitStatus = typeof dailyHabitStatus.$inferSelect;
export type HabitDebt = typeof habitDebts.$inferSelect;

// API Types
export type CreateHabitRequest = InsertHabit;
export type LogEventRequest = { notes?: string };
export type ConfirmCleanDayRequest = { date: string };
export type CompleteDailyTaskRequest = { date: string, completed: boolean };

export type HabitWithStatus = Habit & {
  debt?: number; // For avoidance
  todayEvents?: number; // For avoidance - events logged today
  todayConfirmed?: boolean; // For avoidance - clean day confirmed today
  todayTask?: number; // For build - required task amount
  todayCompleted?: boolean; // For build
  todayIsRestDay?: boolean; // For build - today isn't a scheduled day, no action needed
  todayMissed?: boolean; // For build - marked as missed
  penaltyLevel?: number; // For build - stacking requirement multiplier, NOT debt
  // For build - missed-day debt, independent of penaltyLevel. See
  // buildDebtRepayments above for how these are derived.
  totalMissedDays?: number;
  totalRepaidDays?: number;
  remainingDebt?: number;
};

export type BuildDebtSummary = {
  totalMissedDays: number;
  totalRepaidDays: number;
  remainingDebt: number;
};

// --- Custom Protocol Rules: day-of-week scheduling (Build only) ---
//
// Pure functions, deliberately dependency-free, so both the real
// (Postgres-backed) storage layer and guest mode's localStorage layer
// can share the exact same scheduling logic rather than maintaining two
// implementations that could drift apart.

export function isScheduledDay(
  scheduledDays: number[] | null | undefined,
  dateStr: string,
): boolean {
  if (!scheduledDays || scheduledDays.length === 0) return true; // default: every day
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return scheduledDays.includes(dow);
}

/**
 * The most recent scheduled day strictly before fromDateStr. Used so a
 * streak's "was this consecutive" check compares against the previous
 * REQUIRED day, not literally yesterday — a Mon-Fri protocol's streak
 * shouldn't break just because the weekend happened.
 */
export function previousScheduledDate(
  scheduledDays: number[] | null | undefined,
  fromDateStr: string,
): string {
  const d = new Date(`${fromDateStr}T00:00:00Z`);
  // Bounded loop: a full week always contains at least one scheduled day
  // for any valid (non-empty) schedule, so 60 days is a generous safety
  // margin, not a realistic case this would ever actually hit.
  for (let i = 0; i < 60; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().split("T")[0];
    if (isScheduledDay(scheduledDays, key)) return key;
  }
  const fallback = new Date(`${fromDateStr}T00:00:00Z`);
  fallback.setUTCDate(fallback.getUTCDate() - 1);
  return fallback.toISOString().split("T")[0];
}

/**
 * Counts scheduled (required) days strictly between fromDateStr
 * (exclusive) and toDateStr (exclusive) — this is "how many required
 * days have passed since the last completion," which is what the
 * penalty stack should actually be counting. For an every-day schedule
 * this equals the plain calendar-day gap (identical to the original,
 * pre-scheduling behavior), so nothing changes for habits without a
 * custom schedule.
 */
export function countScheduledDaysBetween(
  scheduledDays: number[] | null | undefined,
  fromDateStr: string,
  toDateStr: string,
): number {
  let count = 0;
  const d = new Date(`${fromDateStr}T00:00:00Z`);
  const end = new Date(`${toDateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d < end) {
    const key = d.toISOString().split("T")[0];
    if (isScheduledDay(scheduledDays, key)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// --- Bug reports (spec section 11) ---
//
// Persisted here (not just emailed) so reports remain visible even if an
// email bounces or gets buried, and so a future admin dashboard can list
// and triage them without needing an inbox — the spec explicitly asks
// for this "if the existing architecture supports it," and since this
// app already has Postgres via Drizzle for everything else, it does.
//
// userId/userEmail are nullable and NOT foreign-keyed to `users`:
// reports should be submittable by guests (no account, no user row to
// reference) and should survive account deletion (storage.deleteUserAccount
// permanently removes the user row; a bug report about that very account
// dying shouldn't disappear along with it). Snapshotting the email as
// plain text at submission time is deliberate for the same reason.
export const bugReports = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  userEmail: varchar("user_email"),
  subject: text("subject").notNull(),
  category: varchar("category").notNull(),
  description: text("description").notNull(),
  stepsToReproduce: text("steps_to_reproduce"),
  expectedBehavior: text("expected_behavior"),
  actualBehavior: text("actual_behavior"),
  // Which app route the report was filed from (e.g. "/dashboard") — NOT
  // a full URL, so no query params or fragments that could carry
  // sensitive data ever get persisted or emailed.
  page: varchar("page"),
  // navigator.userAgent — never anything from cookies, headers, or auth
  // state. No passwords, tokens, or session identifiers are collected
  // anywhere in this table, matching the spec's explicit requirement.
  userAgent: text("user_agent"),
  appVersion: varchar("app_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBugReportSchema = createInsertSchema(bugReports).omit({
  id: true,
  createdAt: true,
});
export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = typeof bugReports.$inferInsert;

// --- Push notifications (spec sections 13 & 15) ---
//
// One row per subscribed BROWSER/DEVICE, not per user — the same
// account can have Protocol open (and separately subscribed) on a phone
// and a laptop, and each needs its own endpoint/keys to receive pushes.
// `endpoint` (the browser push service's unique URL for that
// registration) is the natural unique key: re-subscribing the same
// browser produces the same endpoint, so upserting on conflict avoids
// silently accumulating duplicate rows for one device across repeated
// permission grants.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// One row per user, created lazily on first preference read/write
// (see storage.getNotificationPreferences). Every category defaults to
// true so opting IN to push (granting browser permission) gets you all
// the useful nudges by default; opting individual categories back OFF
// is the "manage notification preferences" the spec asks for.
//
// NOTE ON SCOPE: every column below has a real preference toggle wired
// up in the UI. Only `confirmationWindowOpen` has an actual SERVER-SIDE
// trigger sending real pushes for it right now (see
// api/cron/confirmation-window-push/route.ts) — habit reminders, streak
// reminders, and subscription reminders don't have their trigger logic
// built yet. Flagging this honestly rather than implying they're all
// fully wired just because the toggle exists.
export const notificationPreferences = pgTable("notification_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  habitReminders: boolean("habit_reminders").notNull().default(true),
  confirmationWindowOpen: boolean("confirmation_window_open").notNull().default(true),
  confirmationWindowReminder: boolean("confirmation_window_reminder").notNull().default(true),
  trialEnding: boolean("trial_ending").notNull().default(true),
  subscriptionReminders: boolean("subscription_reminders").notNull().default(true),
  streakReminders: boolean("streak_reminders").notNull().default(true),
  importantAnnouncements: boolean("important_announcements").notNull().default(true),
  // Dedup guard for the daily confirmation-window-open cron sweep — only
  // ever send once per calendar day per user, even if the cron somehow
  // fires more than once (matches the spec's explicit "do not send
  // duplicate notifications" requirement, enforced server-side rather
  // than trusting the sw.js `tag` collapsing alone).
  lastConfirmationWindowPushDate: date("last_confirmation_window_push_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type UpsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

export const NOTIFICATION_CATEGORIES = [
  "habitReminders",
  "confirmationWindowOpen",
  "confirmationWindowReminder",
  "trialEnding",
  "subscriptionReminders",
  "streakReminders",
  "importantAnnouncements",
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];
