// Shared types for analytics — deliberately has zero imports that touch
// the database, so it's safe to import from both server code
// (lib/analytics.ts) and client components/hooks without risking `pg`
// getting pulled into the browser bundle.

export type AnalyticsRange = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

export interface AnalyticsSummary {
  rangeStart: string | null;
  rangeEnd: string;
  overallCompletionRate: number | null;
  buildCompletionRate: number | null;
  avoidSuccessRate: number | null;
  completedCount: number;
  missedCount: number;
  avoidViolations: number;
  bestDay: { dayOfWeek: string; successRate: number } | null;
  worstDay: { dayOfWeek: string; successRate: number } | null;
  strongestProtocol: { habitId: number; name: string; successRate: number } | null;
  weakestProtocol: { habitId: number; name: string; successRate: number } | null;
  currentStreak: number;
  longestStreak: number;
  timeSeries: { date: string; completionRate: number | null }[];
}

// --- History / Export types ---
// Shared between the server-only history engine (lib/history.ts) and
// client hooks — kept import-safe (no `db` dependency) for the same
// reason as the analytics types above.

// "repayment" covers a standalone Build-debt repayment recorded on a date
// that otherwise has no dailyHabitStatus row (e.g. today's protocol hasn't
// been confirmed yet, but the user still repaid an old missed day). See
// buildHistoryEntries in lib/history.ts.
export type HistoryStatus = "completed" | "missed" | "clean" | "violation" | "repayment";

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  habitId: number;
  habitName: string;
  type: "build" | "avoidance";
  status: HistoryStatus;
  completed: boolean;
  missed: boolean;
  // Build: accurately reconstructed by replaying completed/missed days in
  // order — this is exact, not estimated, since Build's streak rule is
  // fully determined by that sequence.
  // Avoidance: null. Avoid's real streak only advances on an explicit
  // "Confirm Clean Day" action, and only the single latest confirmation
  // date is stored (see habitDebts.lastCleanDate) — there's no historical
  // log of every past confirmation, so a per-day streak can't be
  // reconstructed honestly. Showing null here beats fabricating a number.
  streak: number | null;
  // Build: dailyHabitStatus.penaltyLevel for that day (exact, stored).
  // Avoidance: count of violation events logged on that specific date
  // (exact, derived from timestamped events) — not a running debt total,
  // since avoid's debt decrements aren't individually logged historically
  // (only the current count persists), so a historical running total
  // can't be reconstructed honestly either.
  penaltyInfo: number | null;
  // Build only: whole days of Build debt repaid on this date (from
  // build_debt_repayments), or null if none was recorded that day.
  // Avoidance: always null — see buildDebtRepayments in shared/schema.ts.
  debtRepaid: number | null;
  // Build only: outstanding Build debt immediately after this entry,
  // replayed chronologically (max(0, missed-to-date - repaid-to-date)).
  // Avoidance: always null.
  remainingDebtAfter: number | null;
}

export interface HistoryFilters {
  range: AnalyticsRange;
  habitId?: number;
  type?: "build" | "avoidance";
  status?: HistoryStatus;
}
