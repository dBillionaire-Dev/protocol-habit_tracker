"use client";

import type {
  HabitWithStatus,
  InsertHabit,
  HabitEvent,
  HabitType,
  DailyHabitStatus,
} from "shared/schema";
import { isScheduledDay, previousScheduledDate, countScheduledDaysBetween, FREE_PLAN_HABIT_EDIT_WINDOW_MS } from "shared/schema";
import { GUEST_STARTED_AT_KEY, GUEST_SESSION_MAX_AGE_MS } from "@/lib/api";

/**
 * Guest-mode data layer. Mirrors the same debt/streak/penalty rules as
 * server/storage.ts's DatabaseStorage, but persists to the browser's
 * localStorage instead of Supabase Postgres — nothing here ever makes a
 * network request. This lets people try the app (including creating and
 * completing habits) without an account, and without us storing any of
 * their demo data server-side.
 *
 * Data is scoped to this browser only. Switching devices, clearing site
 * data, or signing in for real starts fresh.
 */

const STORAGE_KEY = "protocol:guestHabitData";
const GUEST_USER_ID = "guest-demo-user";

// Guest sessions are intentionally capped tighter than the free plan (1
// vs 3) — the point is to let people try the app, not to be a
// fully-featured free tier with no account required.
export const GUEST_HABIT_LIMIT = 1;

export class GuestLimitError extends Error {
  constructor() {
    super(`Guest sessions are limited to ${GUEST_HABIT_LIMIT} protocol. Create a free account for more.`);
    this.name = "GuestLimitError";
  }
}

export class GuestDebtRepaymentError extends Error {}

export class GuestHabitEditError extends Error {}

interface GuestDailyStatus {
  date: string;
  completed: boolean;
  penaltyLevel: number;
  completedValue?: number; // mirrors dailyHabitStatus.completedValue server-side
}

interface GuestHabit {
  id: number;
  userId: string;
  name: string;
  type: HabitType;
  baseTaskValue: number | null;
  unit: string | null;
  scheduledDays: number[] | null; // build only — see shared/schema.ts's isScheduledDay etc.
  createdAt: string; // ISO
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  currentStreakStart: string | null;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  // Guest-only history, equivalent to separate tables server-side.
  events: { timestamp: string; notes?: string }[]; // habit_events
  dailyStatuses: GuestDailyStatus[]; // daily_habit_status
  debtCount: number; // habit_debts.debt_count (avoidance only)
  lastCleanDate: string | null; // habit_debts.last_clean_date (avoidance only)
  // Build only. Mirrors habits.outstandingDebtUnits server-side -- a
  // single running total in raw units, not a day count. Replaces an
  // earlier debtRepayments log the same way the server-side rewrite
  // replaced buildDebtRepayments (see shared/schema.ts).
  outstandingDebtUnits: number;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function load(): GuestHabit[] {
  if (typeof window === "undefined") return [];
  try {
    // Guest habit data is capped to the same 1-day window as the guest
    // session itself (see api.ts's GUEST_STARTED_AT_KEY / require-user.ts's
    // server-side enforcement) -- a guest's habits shouldn't outlive their
    // "session" just because localStorage itself never expires anything on
    // its own. Reusing the exact same timestamp as the session check means
    // there's one clock to reason about, not two that could drift apart.
    const startedAt = window.localStorage.getItem(GUEST_STARTED_AT_KEY);
    if (startedAt) {
      const startedMs = Date.parse(startedAt);
      if (!Number.isNaN(startedMs) && Date.now() - startedMs > GUEST_SESSION_MAX_AGE_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return [];
      }
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestHabit[]) : [];
  } catch {
    return [];
  }
}

function save(habits: GuestHabit[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function nextId(habits: GuestHabit[]): number {
  return habits.reduce((max, h) => Math.max(max, h.id), 0) + 1;
}

function getTodayEventCount(habit: GuestHabit, date: string): number {
  return habit.events.filter((e) => e.timestamp.split("T")[0] === date).length;
}

function getDailyStatus(
  habit: GuestHabit,
  date: string,
): GuestDailyStatus | undefined {
  return habit.dailyStatuses.find((s) => s.date === date);
}

// Same rules as DatabaseStorage.catchUpMissedDaysInTx, but PURE (does not
// mutate habit.outstandingDebtUnits) -- guest getHabits() never calls
// save() after mapping over habits, so a mutating version here would
// have its effect silently discarded on every single read. The write
// path (completeDailyTask below) is what actually applies and persists
// this via save().
function computeEffectiveDebt(habit: GuestHabit, asOfDate: string): number {
  if (habit.type !== "build") return habit.outstandingDebtUnits;

  const completedBefore = habit.dailyStatuses
    .filter((s) => s.completed)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const createdDate = habit.createdAt.split("T")[0];
  const fromDate = completedBefore[0]?.date ?? createdDate;

  const gapDays = countScheduledDaysBetween(habit.scheduledDays, fromDate, asOfDate);
  if (gapDays <= 0) return habit.outstandingDebtUnits;

  return habit.outstandingDebtUnits + gapDays * (habit.baseTaskValue || 0);
}

// Same rules as DatabaseStorage.updateStreak
function updateStreak(habit: GuestHabit, date: string, isSuccess: boolean) {
  if (isSuccess) {
    const previousRequiredDay = previousScheduledDate(habit.scheduledDays, date);

    let newStreak = 1;
    let currentStreakStart = date;

    if (habit.lastStreakDate === previousRequiredDay) {
      newStreak = habit.currentStreak + 1;
      currentStreakStart = habit.currentStreakStart || date;
    }

    const isNewLongest = newStreak > habit.longestStreak;

    habit.currentStreak = newStreak;
    habit.longestStreak = Math.max(habit.longestStreak, newStreak);
    habit.lastStreakDate = date;
    habit.currentStreakStart = currentStreakStart;

    if (isNewLongest) {
      habit.longestStreakStart = currentStreakStart;
      habit.longestStreakEnd = null;
    }
  } else {
    if (habit.currentStreak === habit.longestStreak && habit.currentStreak > 0) {
      habit.longestStreakEnd = habit.lastStreakDate;
    }
    habit.currentStreak = 0;
    habit.currentStreakStart = null;
  }
}


function toHabitWithStatus(habit: GuestHabit, today: string): HabitWithStatus {
  const {
    events: _events,
    dailyStatuses: _dailyStatuses,
    debtCount,
    lastCleanDate,
    createdAt,
    ...base
  } = habit;

  const withDate = { ...base, createdAt: new Date(createdAt) };

  if (habit.type === "avoidance") {
    return {
      ...withDate,
      debt: debtCount,
      todayEvents: getTodayEventCount(habit, today),
      todayConfirmed: lastCleanDate === today,
    };
  }

  const effectiveDebt = computeEffectiveDebt(habit, today);
  const base_ = habit.baseTaskValue || 0;
  const status = getDailyStatus(habit, today);
  return {
    ...withDate,
    penaltyLevel: base_ > 0 ? Math.ceil(effectiveDebt / base_) : 0,
    todayTask: base_ + effectiveDebt,
    todayCompleted: status?.completed ?? false,
    todayMissed: status ? !status.completed : false,
    todayIsRestDay: !isScheduledDay(habit.scheduledDays, today),
    remainingDebt: effectiveDebt,
  };
}

export const guestStorage = {
  getHabits(): HabitWithStatus[] {
    const today = todayStr();
    // Stable, deterministic ordering: earliest-created first. `load()`
    // returns habits in localStorage array order (== push/creation
    // order), and `id` (assigned via nextId, monotonically increasing)
    // is an equivalent, explicit tiebreaker — mirrors the real DB
    // layer's `ORDER BY id ASC` in storage.ts so guest and real accounts
    // never visibly disagree on ordering.
    return load()
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((h) => toHabitWithStatus(h, today));
  },

  createHabit(input: InsertHabit): HabitWithStatus {
    const habits = load();
    if (habits.length >= GUEST_HABIT_LIMIT) {
      throw new GuestLimitError();
    }
    const now = new Date().toISOString();
    const habit: GuestHabit = {
      id: nextId(habits),
      userId: GUEST_USER_ID,
      name: input.name,
      type: input.type,
      baseTaskValue: input.baseTaskValue ?? null,
      unit: input.unit ?? null,
      scheduledDays: input.scheduledDays ?? null,
      createdAt: now,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      currentStreakStart: null,
      longestStreakStart: null,
      longestStreakEnd: null,
      events: [],
      dailyStatuses: [],
      debtCount: 0,
      lastCleanDate: null,
      outstandingDebtUnits: 0,
    };
    habits.push(habit);
    save(habits);
    return toHabitWithStatus(habit, todayStr());
  },

  deleteHabit(id: number): void {
    save(load().filter((h) => h.id !== id));
  },

  // Guest sessions have no plan concept of their own — they're always
  // treated as Free-tier-equivalent for the 20-minute edit window (see
  // FREE_PLAN_HABIT_EDIT_WINDOW_MS), enforced here rather than trusting
  // any client-side check, for the same reason the real backend enforces
  // it server-side rather than just hiding the edit button.
  updateHabit(id: number, updates: Partial<Pick<GuestHabit, "name" | "baseTaskValue" | "unit" | "scheduledDays">>): HabitWithStatus {
    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    const createdMs = new Date(habit.createdAt).getTime();
    if (Date.now() - createdMs > FREE_PLAN_HABIT_EDIT_WINDOW_MS) {
      throw new GuestHabitEditError(
        "Editing is only available within 20 minutes of creating a protocol on the Free plan. Upgrade to Pro or Premium Plus to edit anytime.",
      );
    }

    Object.assign(habit, updates);
    save(habits);
    return toHabitWithStatus(habit, todayStr());
  },

  logHabitEvent(id: number, notes?: string): HabitEvent {
    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    const timestamp = new Date().toISOString();
    habit.events.push({ timestamp, notes });
    habit.debtCount += 1;
    habit.currentStreak = 0;
    save(habits);

    return {
      id: habit.events.length,
      habitId: id,
      timestamp: new Date(timestamp),
      value: 1,
      notes: notes ?? null,
    } as HabitEvent;
  },

  confirmCleanDay(id: number, date: string): { debt: number } {
    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    if (habit.lastCleanDate === date) {
      return { debt: habit.debtCount };
    }

    habit.debtCount = Math.max(0, habit.debtCount - 1);
    habit.lastCleanDate = date;
    updateStreak(habit, date, true);
    save(habits);

    return { debt: habit.debtCount };
  },

  // completedValue: raw units actually done today. Both whether today
  // counts as complete AND how much outstanding debt clears are derived
  // from this single number -- see DatabaseStorage.completeDailyTask for
  // the full explanation, mirrored here exactly.
  completeDailyTask(
    id: number,
    date: string,
    completedValue: number,
  ): DailyHabitStatus & { debtSummary: { outstandingDebtUnits: number } } {
    if (!Number.isInteger(completedValue) || completedValue < 0) {
      throw new GuestDebtRepaymentError("Amount completed must be a whole number of 0 or more.");
    }

    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    const debtBeforeToday = computeEffectiveDebt(habit, date);
    const base = habit.baseTaskValue || 0;
    const todayTask = base + debtBeforeToday;
    const isCompleted = completedValue >= base;
    const newDebt = Math.max(0, todayTask - completedValue);

    const existing = getDailyStatus(habit, date);
    if (existing) {
      existing.completed = isCompleted;
      existing.completedValue = completedValue;
    } else {
      habit.dailyStatuses.push({ date, completed: isCompleted, penaltyLevel: 0, completedValue });
    }

    habit.outstandingDebtUnits = newDebt;
    updateStreak(habit, date, isCompleted);
    save(habits);

    return {
      id: 0,
      habitId: id,
      date,
      completed: isCompleted,
      penaltyLevel: 0,
      completedValue,
      autoProcessed: false,
      debtSummary: { outstandingDebtUnits: newDebt },
    };
  },

  clearAll(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
