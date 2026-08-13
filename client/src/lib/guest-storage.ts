"use client";

import type {
  HabitWithStatus,
  InsertHabit,
  HabitEvent,
  HabitType,
} from "shared/schema";

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

interface GuestDailyStatus {
  date: string;
  completed: boolean;
  penaltyLevel: number;
}

interface GuestHabit {
  id: number;
  userId: string;
  name: string;
  type: HabitType;
  baseTaskValue: number | null;
  unit: string | null;
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
  debtRepayments: { amount: number; date: string }[]; // build_debt_repayments (build only)
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function load(): GuestHabit[] {
  if (typeof window === "undefined") return [];
  try {
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

// Same rules as DatabaseStorage.calculatePenaltyLevel
function calculatePenaltyLevel(habit: GuestHabit, today: string): number {
  const createdDate = habit.createdAt.split("T")[0];
  if (createdDate === today) return 0;

  const completedBefore = habit.dailyStatuses
    .filter((s) => s.completed && s.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastCompleted = completedBefore[0];

  if (lastCompleted) {
    const lastDate = new Date(lastCompleted.date);
    const todayDate = new Date(today);
    const diffDays = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, diffDays - 1);
  }

  const created = new Date(habit.createdAt);
  created.setHours(0, 0, 0, 0);
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (todayDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, diffDays);
}

// Same rules as DatabaseStorage.updateStreak
function updateStreak(habit: GuestHabit, date: string, isSuccess: boolean) {
  if (isSuccess) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    let currentStreakStart = date;

    if (habit.lastStreakDate === yesterdayStr) {
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

// Same rules as DatabaseStorage.getBuildDebtSummary: derived from real
// history, never a directly-settable number.
function getBuildDebtSummary(habit: GuestHabit): {
  totalMissedDays: number;
  totalRepaidDays: number;
  remainingDebt: number;
} {
  const totalMissedDays = habit.dailyStatuses.filter((s) => !s.completed).length;
  const totalRepaidDays = habit.debtRepayments.reduce((sum, r) => sum + r.amount, 0);
  return {
    totalMissedDays,
    totalRepaidDays,
    remainingDebt: Math.max(0, totalMissedDays - totalRepaidDays),
  };
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

  const penaltyLevel = calculatePenaltyLevel(habit, today);
  const status = getDailyStatus(habit, today);
  const debtSummary = getBuildDebtSummary(habit);
  return {
    ...withDate,
    penaltyLevel,
    todayTask: (habit.baseTaskValue || 0) + (habit.baseTaskValue || 0) * penaltyLevel,
    todayCompleted: status?.completed ?? false,
    todayMissed: status ? !status.completed : false,
    totalMissedDays: debtSummary.totalMissedDays,
    totalRepaidDays: debtSummary.totalRepaidDays,
    remainingDebt: debtSummary.remainingDebt,
  };
}

export const guestStorage = {
  getHabits(): HabitWithStatus[] {
    const today = todayStr();
    return load().map((h) => toHabitWithStatus(h, today));
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
      debtRepayments: [],
    };
    habits.push(habit);
    save(habits);
    return toHabitWithStatus(habit, todayStr());
  },

  deleteHabit(id: number): void {
    save(load().filter((h) => h.id !== id));
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

  completeDailyTask(
    id: number,
    date: string,
    completed: boolean,
    debtRepayment?: number,
  ): { completed: boolean; penaltyLevel: number; debtSummary: ReturnType<typeof getBuildDebtSummary> } {
    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    const penaltyLevel = calculatePenaltyLevel(habit, date);
    const existing = getDailyStatus(habit, date);
    if (existing) {
      existing.completed = completed;
      existing.penaltyLevel = penaltyLevel;
    } else {
      habit.dailyStatuses.push({ date, completed, penaltyLevel });
    }

    updateStreak(habit, date, completed);

    // Completing today's requirement does NOT implicitly repay debt —
    // that's a separate, explicit choice.
    let debtSummary = getBuildDebtSummary(habit);
    if (debtRepayment && debtRepayment > 0) {
      if (debtRepayment > debtSummary.remainingDebt) {
        throw new GuestDebtRepaymentError(
          debtSummary.remainingDebt === 0
            ? "You have no outstanding debt to repay."
            : `Repayment amount cannot exceed your outstanding debt of ${debtSummary.remainingDebt}.`,
        );
      }
      habit.debtRepayments.push({ amount: debtRepayment, date });
      debtSummary = getBuildDebtSummary(habit);
    }

    save(habits);

    return { completed, penaltyLevel, debtSummary };
  },

  repayDebt(id: number, amount: number): ReturnType<typeof getBuildDebtSummary> {
    const habits = load();
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habit not found");

    if (!Number.isInteger(amount) || amount < 1) {
      throw new GuestDebtRepaymentError("Repayment amount must be a whole number of at least 1.");
    }

    const summary = getBuildDebtSummary(habit);
    if (amount > summary.remainingDebt) {
      throw new GuestDebtRepaymentError(
        summary.remainingDebt === 0
          ? "You have no outstanding debt to repay."
          : `Repayment amount cannot exceed your outstanding debt of ${summary.remainingDebt}.`,
      );
    }

    habit.debtRepayments.push({ amount, date: todayStr() });
    save(habits);

    return getBuildDebtSummary(habit);
  },

  clearAll(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
