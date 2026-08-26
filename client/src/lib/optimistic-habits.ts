"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { HabitWithStatus, InsertHabit } from "shared/schema";

// Optimistic updates for offline-queued habit actions (see
// lib/offline-queue.ts). Applied immediately when an action is queued so
// the UI reflects the change right away instead of waiting for the
// eventual sync -- the real server data, once synced, overwrites this
// via the query invalidation useOfflineSync's drain() already does.
//
// Deliberately minimal: only the directly-observable fields a user would
// notice immediately (checkbox state, event count, debt) are touched.
// Derived numbers with real server-side logic behind them (streak
// length, penalty level) are intentionally left alone here rather than
// reimplementing that logic client-side and risking it drifting out of
// sync with lib/storage.ts's actual calculation.

const HABITS_KEY = ["/api/habits"];

function updateHabit(
  queryClient: QueryClient,
  habitId: number,
  updater: (habit: HabitWithStatus) => HabitWithStatus,
) {
  queryClient.setQueryData<HabitWithStatus[]>(HABITS_KEY, (old) =>
    old?.map((h) => (h.id === habitId ? updater(h) : h)),
  );
}

export function applyOptimisticLogEvent(queryClient: QueryClient, habitId: number): void {
  updateHabit(queryClient, habitId, (h) => ({
    ...h,
    todayEvents: (h.todayEvents ?? 0) + 1,
    debt: (h.debt ?? 0) + 1,
    currentStreak: 0,
  }));
}

export function applyOptimisticCompleteDaily(queryClient: QueryClient, habitId: number, completed: boolean): void {
  updateHabit(queryClient, habitId, (h) => ({
    ...h,
    todayCompleted: completed,
    todayMissed: !completed,
  }));
}

export function applyOptimisticConfirmCleanDay(queryClient: QueryClient, habitId: number): void {
  updateHabit(queryClient, habitId, (h) => ({
    ...h,
    todayConfirmed: true,
    debt: Math.max(0, (h.debt ?? 0) - 1),
  }));
}

// Negative so a temp id can never collide with a real serial id from
// Postgres (which only ever produces positive ones). The optimistic row
// disappears on its own once create-habit syncs and the resulting
// invalidateQueries() refetches the real list -- no manual cleanup here.
let tempIdCounter = -1;
function nextTempHabitId(): number {
  return tempIdCounter--;
}

export function isPendingSyncHabit(habit: Pick<HabitWithStatus, "id">): boolean {
  return habit.id < 0;
}

export function applyOptimisticCreateHabit(queryClient: QueryClient, habit: InsertHabit): number {
  const id = nextTempHabitId();
  const optimistic: HabitWithStatus = {
    id,
    userId: "",
    name: habit.name,
    type: habit.type,
    baseTaskValue: habit.baseTaskValue ?? null,
    unit: habit.unit ?? null,
    scheduledDays: habit.scheduledDays ?? null,
    createdAt: new Date(),
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    currentStreakStart: null,
    longestStreakStart: null,
    longestStreakEnd: null,
    debt: habit.type === "avoidance" ? 0 : undefined,
    todayEvents: habit.type === "avoidance" ? 0 : undefined,
    todayConfirmed: false,
    todayTask: habit.type === "build" ? (habit.baseTaskValue ?? undefined) : undefined,
    todayCompleted: false,
    todayMissed: false,
  };
  queryClient.setQueryData<HabitWithStatus[]>(HABITS_KEY, (old) => [...(old ?? []), optimistic]);
  return id;
}
