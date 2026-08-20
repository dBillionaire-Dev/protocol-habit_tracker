import { db } from "./db";
import { habits, habitEvents, dailyHabitStatus, buildDebtRepayments } from "shared/schema";
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

      // Every recorded repayment for this habit — NOT filtered by range
      // yet, because remainingDebtAfter must be replayed from the very
      // start of the habit's history to be accurate, even when the
      // visible window is narrower. Filtering happens after the replay.
      const repayments = await db
        .select()
        .from(buildDebtRepayments)
        .where(eq(buildDebtRepayments.habitId, habit.id));

      const repaidByDate = new Map<string, number>();
      for (const r of repayments) {
        repaidByDate.set(r.date, (repaidByDate.get(r.date) ?? 0) + r.amount);
      }

      // Merge dailyHabitStatus dates with any repayment-only dates (a
      // standalone repayment on a day that otherwise has no status row —
      // see the "repayment" HistoryStatus case below) into one
      // chronological timeline so debt can be replayed accurately.
      const statusByDate = new Map(rows.map((r) => [r.date, r]));
      const allDates = Array.from(
        new Set([...rows.map((r) => r.date), ...repaidByDate.keys()]),
      ).sort();

      let runningStreak = 0;
      let previousDate: string | null = null;
      let runningMissed = 0;
      let runningRepaid = 0;

      for (const date of allDates) {
        const row = statusByDate.get(date);
        const repaidToday = repaidByDate.get(date) ?? 0;

        let status: typeof entries[number]["status"];
        let completed = false;
        let missed = false;
        let penaltyInfo: number | null = null;

        if (row) {
          if (row.completed) {
            const expectedPrev = new Date(`${date}T00:00:00Z`);
            expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1);
            const expectedPrevKey = toDateKey(expectedPrev);
            runningStreak = previousDate === expectedPrevKey ? runningStreak + 1 : 1;
            runningMissed += 0;
          } else {
            runningStreak = 0;
            runningMissed += 1;
          }
          previousDate = date;
          status = row.completed ? "completed" : "missed";
          completed = row.completed;
          missed = !row.completed;
          penaltyInfo = row.penaltyLevel;
        } else {
          // Repayment recorded with no matching dailyHabitStatus row for
          // that date (e.g. repaid old debt before confirming today).
          status = "repayment";
        }

        runningRepaid += repaidToday;
        const remainingDebtAfter = Math.max(0, runningMissed - runningRepaid);

        // Now apply the range filter — the replay above needed the full,
        // unfiltered history to compute an accurate running balance.
        if (rangeStart && date < toDateKey(rangeStart)) continue;

        entries.push({
          date,
          habitId: habit.id,
          habitName: habit.name,
          type: "build",
          status,
          completed,
          missed,
          streak: row ? runningStreak : null,
          penaltyInfo,
          debtRepaid: repaidToday > 0 ? repaidToday : null,
          remainingDebtAfter,
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
