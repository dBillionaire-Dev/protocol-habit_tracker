import { db } from "./db";
import { habits, habitEvents, dailyHabitStatus } from "shared/schema";
import { eq, and, gte } from "drizzle-orm";
import type { AnalyticsRange, AnalyticsSummary } from "./analytics-types";

export type { AnalyticsRange, AnalyticsSummary };

export function rangeToStartDate(range: AnalyticsRange): Date | null {
  if (range === "all") return null;
  const days: Record<Exclude<AnalyticsRange, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 182,
    "1y": 365,
  };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days[range]);
  return start;
}

function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface DayBucket {
  tracked: number;
  success: number;
}

interface PerHabitStat {
  habitId: number;
  name: string;
  type: "build" | "avoidance";
  tracked: number;
  successRate: number | null; // null = no tracked days in range
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Computes real analytics from existing habit history — nothing here is
 * fabricated or estimated. Reads dailyHabitStatus (Build) and
 * habitEvents (Avoidance) directly; doesn't touch or depend on any
 * optional/separately-added tables (e.g. build debt repayments), so this
 * works regardless of which other feature scripts have been applied.
 *
 * "Success" for a Build day = dailyHabitStatus.completed. "Success" for
 * an Avoidance day = no habitEvents logged that day (a day with zero
 * violations is a clean day) — this is inferred from the existing event
 * log rather than requiring a new per-day table, matching how the rest
 * of the app already treats avoidance habits.
 */
export async function getAnalyticsSummary(
  userId: string,
  range: AnalyticsRange,
): Promise<AnalyticsSummary> {
  const rangeStart = rangeToStartDate(range);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));

  let totalBuildTracked = 0;
  let totalBuildCompleted = 0;
  let totalAvoidTracked = 0;
  let totalAvoidClean = 0;
  let totalAvoidViolations = 0;
  let maxCurrentStreak = 0;
  let maxLongestStreak = 0;

  const perHabitStats: PerHabitStat[] = [];
  const dayOfWeekStats: DayBucket[] = Array.from({ length: 7 }, () => ({ tracked: 0, success: 0 }));
  const timeSeriesMap = new Map<string, DayBucket>();

  function recordDay(dateKey: string, success: boolean) {
    const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
    dayOfWeekStats[dow].tracked++;
    if (success) dayOfWeekStats[dow].success++;

    const bucket = timeSeriesMap.get(dateKey) ?? { tracked: 0, success: 0 };
    bucket.tracked++;
    if (success) bucket.success++;
    timeSeriesMap.set(dateKey, bucket);
  }

  for (const habit of userHabits) {
    maxCurrentStreak = Math.max(maxCurrentStreak, habit.currentStreak);
    maxLongestStreak = Math.max(maxLongestStreak, habit.longestStreak);

    if (habit.type === "build") {
      const conditions = [eq(dailyHabitStatus.habitId, habit.id)];
      if (rangeStart) conditions.push(gte(dailyHabitStatus.date, toDateKey(rangeStart)));
      const rows = await db.select().from(dailyHabitStatus).where(and(...conditions));

      const tracked = rows.length;
      const completed = rows.filter((r) => r.completed).length;
      totalBuildTracked += tracked;
      totalBuildCompleted += completed;

      for (const row of rows) {
        recordDay(row.date, row.completed);
      }

      perHabitStats.push({
        habitId: habit.id,
        name: habit.name,
        type: "build",
        tracked,
        successRate: tracked > 0 ? completed / tracked : null,
      });
    } else {
      // Avoidance: infer clean/violation days from the event log across
      // the intersection of [habit creation, range start] .. today.
      const events = await db.select().from(habitEvents).where(eq(habitEvents.habitId, habit.id));

      const habitCreated = new Date(habit.createdAt);
      habitCreated.setHours(0, 0, 0, 0);
      const windowStart = rangeStart && rangeStart > habitCreated ? rangeStart : habitCreated;

      const eventDatesInWindow = new Set(
        events
          .filter((e) => e.timestamp >= windowStart)
          .map((e) => toDateKey(new Date(e.timestamp))),
      );

      let tracked = 0;
      let clean = 0;
      for (
        let d = new Date(windowStart);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const key = toDateKey(d);
        const isClean = !eventDatesInWindow.has(key);
        tracked++;
        if (isClean) clean++;
        recordDay(key, isClean);
      }

      totalAvoidTracked += tracked;
      totalAvoidClean += clean;
      totalAvoidViolations += events.filter((e) => e.timestamp >= windowStart).length;

      perHabitStats.push({
        habitId: habit.id,
        name: habit.name,
        type: "avoidance",
        tracked,
        successRate: tracked > 0 ? clean / tracked : null,
      });
    }
  }

  const totalTracked = totalBuildTracked + totalAvoidTracked;
  const totalSuccess = totalBuildCompleted + totalAvoidClean;

  const rankedDays = dayOfWeekStats
    .map((bucket, dow) => ({
      dayOfWeek: DAY_NAMES[dow],
      successRate: bucket.tracked > 0 ? bucket.success / bucket.tracked : null,
      tracked: bucket.tracked,
    }))
    .filter((d) => d.tracked > 0 && d.successRate !== null);

  const bestDay = rankedDays.length
    ? rankedDays.reduce((a, b) => (b.successRate! > a.successRate! ? b : a))
    : null;
  const worstDay = rankedDays.length
    ? rankedDays.reduce((a, b) => (b.successRate! < a.successRate! ? b : a))
    : null;

  const rankedHabits = perHabitStats.filter((h) => h.successRate !== null);
  const strongest = rankedHabits.length
    ? rankedHabits.reduce((a, b) => (b.successRate! > a.successRate! ? b : a))
    : null;
  const weakest = rankedHabits.length
    ? rankedHabits.reduce((a, b) => (b.successRate! < a.successRate! ? b : a))
    : null;

  const timeSeries = Array.from(timeSeriesMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, bucket]) => ({
      date,
      completionRate: bucket.tracked > 0 ? bucket.success / bucket.tracked : null,
    }));

  return {
    rangeStart: rangeStart ? toDateKey(rangeStart) : null,
    rangeEnd: toDateKey(today),
    overallCompletionRate: totalTracked > 0 ? totalSuccess / totalTracked : null,
    buildCompletionRate: totalBuildTracked > 0 ? totalBuildCompleted / totalBuildTracked : null,
    avoidSuccessRate: totalAvoidTracked > 0 ? totalAvoidClean / totalAvoidTracked : null,
    completedCount: totalBuildCompleted,
    missedCount: totalBuildTracked - totalBuildCompleted,
    avoidViolations: totalAvoidViolations,
    bestDay: bestDay ? { dayOfWeek: bestDay.dayOfWeek, successRate: bestDay.successRate! } : null,
    worstDay: worstDay ? { dayOfWeek: worstDay.dayOfWeek, successRate: worstDay.successRate! } : null,
    strongestProtocol: strongest
      ? { habitId: strongest.habitId, name: strongest.name, successRate: strongest.successRate! }
      : null,
    weakestProtocol: weakest
      ? { habitId: weakest.habitId, name: weakest.name, successRate: weakest.successRate! }
      : null,
    currentStreak: maxCurrentStreak,
    longestStreak: maxLongestStreak,
    timeSeries,
  };
}

/**
 * Deterministic (non-AI) insights, generated from the summary above —
 * per spec section 13, these must NOT use AI. Only includes a sentence
 * when there's real data to support it; never fabricates.
 */
export function generateInsights(summary: AnalyticsSummary): string[] {
  const insights: string[] = [];

  if (summary.overallCompletionRate !== null) {
    insights.push(`Your completion rate is ${Math.round(summary.overallCompletionRate * 100)}%.`);
  }
  if (summary.bestDay) {
    insights.push(`${summary.bestDay.dayOfWeek} is your strongest day.`);
  }
  if (summary.worstDay && summary.worstDay.dayOfWeek !== summary.bestDay?.dayOfWeek) {
    insights.push(`${summary.worstDay.dayOfWeek} is your toughest day — worth extra focus.`);
  }
  if (summary.strongestProtocol) {
    insights.push(
      `"${summary.strongestProtocol.name}" is your strongest protocol at ${Math.round(summary.strongestProtocol.successRate * 100)}%.`,
    );
  }
  if (
    summary.weakestProtocol &&
    summary.weakestProtocol.habitId !== summary.strongestProtocol?.habitId
  ) {
    insights.push(
      `"${summary.weakestProtocol.name}" needs the most attention right now, at ${Math.round(summary.weakestProtocol.successRate * 100)}%.`,
    );
  }
  if (summary.longestStreak > 0) {
    insights.push(`Your longest streak so far is ${summary.longestStreak} day${summary.longestStreak !== 1 ? "s" : ""}.`);
  }
  if (summary.avoidViolations === 0 && summary.avoidSuccessRate !== null) {
    insights.push(`Zero Avoid violations in this period — clean record.`);
  }

  return insights;
}
