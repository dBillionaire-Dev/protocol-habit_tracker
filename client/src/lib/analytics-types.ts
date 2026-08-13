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
