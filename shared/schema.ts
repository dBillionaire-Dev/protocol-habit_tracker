import { pgTable, text, serial, integer, boolean, timestamp, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// Export auth tables
export * from "./models/auth";

// Habit Types
export const HABIT_TYPES = ["avoidance", "build"] as const;
export type HabitType = typeof HABIT_TYPES[number];

export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type", { enum: HABIT_TYPES }).notNull(),
  baseTaskValue: integer("base_task_value"), // For build habits
  unit: text("unit"), // reps, minutes, pages, sessions
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
});

export const insertHabitEventSchema = createInsertSchema(habitEvents).omit({ 
  id: true, 
  timestamp: true 
});

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
