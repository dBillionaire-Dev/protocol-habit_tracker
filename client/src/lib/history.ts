import { db } from "./db";
import { habits, habitEvents, dailyHabitStatus } from "shared/schema";
import { countScheduledDaysBetween } from "shared/schema";
import { eq, and } from "drizzle-orm";
import { rangeToStartDate } from "./analytics";
import type { HistoryEntry, HistoryFilters } from "./analytics-types";

function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Builds the full (unpaginated) list of history entries matching the
 * given filters, across all the user's habits (or just one, if
 * habitId is set). Ordered newest-first. Both the /api/history route
 * (which paginates on top of this) and /api/export/csv (which doesn't)
 * share this single implementation, so there's one source of truth for
 * what "history" means.
 */
export async function buildHistoryEntries(
  userId: string,
  filters: HistoryFilters,
): Promise<HistoryEntry[]> {
  const rangeStart = rangeToStartDate(filters.range);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const habitConditions = [eq(habits.userId, userId)];
  if (filters.habitId) habitConditions.push(eq(habits.id, filters.habitId));
  let userHabits = await db.select().from(habits).where(and(...habitConditions));

  if (filters.type) {
    userHabits = userHabits.filter((h) => h.type === filters.type);
  }

  const entries: HistoryEntry[] = [];

  for (const habit of userHabits) {
    if (habit.type === "build") {
      const rows = await db
        .select()
        .from(dailyHabitStatus)
        .where(eq(dailyHabitStatus.habitId, habit.id));

      const statusByDate = new Map(rows.map((r) => [r.date, r]));
      const allDates = Array.from(new Set(rows.map((r) => r.date))).sort();
      const base = habit.baseTaskValue || 0;
      const createdDateKey = toDateKey(new Date(habit.createdAt));

      let runningStreak = 0;
      let previousDate: string | null = null;
      // Debt outstanding as of right after the last row we replayed —
      // same running total storage.completeDailyTask persists as
      // habits.outstandingDebtUnits, reconstructed here by walking the
      // full history in order instead of reading a live column, so this
      // stays accurate for any date in the past.
      let runningDebt = 0;
      // Only a day that fully met baseTaskValue resets the gap
      // reference for catch-up purposes — mirrors
      // catchUpMissedDaysInTx's use of "last completed=true row" rather
      // than "last touched row".
      let lastFullyCompletedDate: string | null = null;

      for (const date of allDates) {
        const row = statusByDate.get(date)!;

        // Catch up any fully-untouched scheduled days strictly between
        // the last full completion (or creation) and this row's date —
        // same rule as catchUpMissedDaysInTx.
        const gapFrom = lastFullyCompletedDate ?? createdDateKey;
        const gapDays = countScheduledDaysBetween(habit.scheduledDays, gapFrom, date);
        if (gapDays > 0) runningDebt += gapDays * base;

        const debtBefore = runningDebt;
        const todayTask = base + debtBefore;
        // Older rows predate the completedValue column — fall back to
        // "did exactly the base" for a completed row, 0 for a missed
        // one, since that's the best honest reconstruction available
        // without a logged raw amount.
        const completedValue = row.completedValue ?? (row.completed ? base : 0);
        const debtAfter = Math.max(0, todayTask - completedValue);
        // Whatever completedValue covered beyond base, capped at
        // debtBefore (can't "repay" more debt than existed).
        const actualDebtRepaid = Math.min(Math.max(0, completedValue - base), debtBefore);

        if (row.completed) {
          const expectedPrev = new Date(`${date}T00:00:00Z`);
          expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1);
          const expectedPrevKey = toDateKey(expectedPrev);
          runningStreak = previousDate === expectedPrevKey ? runningStreak + 1 : 1;
          lastFullyCompletedDate = date;
        } else {
          runningStreak = 0;
        }
        previousDate = date;
        runningDebt = debtAfter;

        if (rangeStart && date < toDateKey(rangeStart)) continue;

        entries.push({
          date,
          habitId: habit.id,
          habitName: habit.name,
          type: "build",
          status: row.completed ? "completed" : "missed",
          completed: row.completed,
          missed: !row.completed,
          streak: runningStreak,
          penaltyInfo: debtBefore,
          completedValue: row.completedValue ?? null,
          debtRepaid: actualDebtRepaid > 0 ? actualDebtRepaid : null,
          remainingDebtAfter: debtAfter,
        });
      }
    } else {
      const events = await db.select().from(habitEvents).where(eq(habitEvents.habitId, habit.id));

      const habitCreated = new Date(habit.createdAt);
      habitCreated.setHours(0, 0, 0, 0);
      const windowStart = rangeStart && rangeStart > habitCreated ? rangeStart : habitCreated;

      const eventsByDate = new Map<string, number>();
      for (const e of events) {
        const key = toDateKey(new Date(e.timestamp));
        eventsByDate.set(key, (eventsByDate.get(key) ?? 0) + 1);
      }

      for (
        let d = new Date(windowStart);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const key = toDateKey(d);
        const violationCount = eventsByDate.get(key) ?? 0;
        const isClean = violationCount === 0;

        entries.push({
          date: key,
          habitId: habit.id,
          habitName: habit.name,
          type: "avoidance",
          status: isClean ? "clean" : "violation",
          completed: isClean,
          missed: !isClean,
          streak: null,
          penaltyInfo: violationCount,
          completedValue: null,
          debtRepaid: null,
          remainingDebtAfter: null,
        });
      }
    }
  }

  let result = entries;
  if (filters.status) {
    result = result.filter((e) => e.status === filters.status);
  }

  result.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.habitId - b.habitId));
  return result;
}

export function toCSV(entries: HistoryEntry[]): string {
  const header = [
    "Date",
    "Protocol",
    "Type",
    "Status",
    "Completion",
    "Missed",
    "Streak",
    "Penalty Info",
    "Debt Repaid",
    "Remaining Debt",
  ];

  const escapeCsv = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const rows = entries.map((e) =>
    [
      e.date,
      e.habitName,
      e.type,
      e.status,
      e.completed ? "yes" : "no",
      e.missed ? "yes" : "no",
      e.streak === null ? "" : String(e.streak),
      e.penaltyInfo === null ? "" : String(e.penaltyInfo),
      e.debtRepaid === null ? "" : String(e.debtRepaid),
      e.remainingDebtAfter === null ? "" : String(e.remainingDebtAfter),
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}
