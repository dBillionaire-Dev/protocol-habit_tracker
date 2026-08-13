"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { Lock, TrendingUp, TrendingDown, Flame, Target, AlertTriangle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutShell } from "@/components/layout-shell";
import { useAnalytics } from "@/hooks/use-analytics";
import type { AnalyticsRange } from "@/lib/analytics-types";
import { cn } from "@/lib/utils";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const { data, isLoading, error } = useAnalytics(range);

  const isLocked = (error as (Error & { code?: string }) | null)?.code === "FEATURE_LOCKED";

  if (isLocked) {
    return (
      <LayoutShell>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">Analytics is a Pro feature</h1>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro or Premium Plus to see completion rates, streaks,
            your strongest and weakest protocols, and performance over time.
          </p>
          <Button asChild>
            <Link href="/pricing">View Plans</Link>
          </Button>
        </div>
      </LayoutShell>
    );
  }

  const summary = data?.summary;
  const insights = data?.insights ?? [];

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap">
            {RANGES.map((r) => (
              <button
                key={r.value}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  range === r.value ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => setRange(r.value)}
                data-testid={`button-range-${r.value}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        )}

        {summary && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Overall completion" value={pct(summary.overallCompletionRate)} />
              <StatCard label="Build completion" value={pct(summary.buildCompletionRate)} />
              <StatCard label="Avoid success rate" value={pct(summary.avoidSuccessRate)} />
              <StatCard
                label="Current streak"
                value={`${summary.currentStreak}d`}
                icon={<Flame className="w-4 h-4 text-orange-500" />}
              />
              <StatCard
                label="Longest streak"
                value={`${summary.longestStreak}d`}
                icon={<Flame className="w-4 h-4 text-orange-500" />}
              />
              <StatCard label="Completed" value={String(summary.completedCount)} />
              <StatCard label="Missed" value={String(summary.missedCount)} />
              <StatCard
                label="Avoid violations"
                value={String(summary.avoidViolations)}
                icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              />
            </div>

            {/* Best/worst day, strongest/weakest protocol */}
            <div className="grid md:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Day of week</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {summary.bestDay && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Best: {summary.bestDay.dayOfWeek}
                      </span>
                      <span className="font-mono text-sm">{pct(summary.bestDay.successRate)}</span>
                    </div>
                  )}
                  {summary.worstDay && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        Worst: {summary.worstDay.dayOfWeek}
                      </span>
                      <span className="font-mono text-sm">{pct(summary.worstDay.successRate)}</span>
                    </div>
                  )}
                  {!summary.bestDay && !summary.worstDay && (
                    <p className="text-sm text-muted-foreground">Not enough data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Protocols</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {summary.strongestProtocol && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm truncate">
                        <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                        Strongest: {summary.strongestProtocol.name}
                      </span>
                      <span className="font-mono text-sm shrink-0">{pct(summary.strongestProtocol.successRate)}</span>
                    </div>
                  )}
                  {summary.weakestProtocol && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm truncate">
                        <Target className="w-4 h-4 text-red-500 shrink-0" />
                        Weakest: {summary.weakestProtocol.name}
                      </span>
                      <span className="font-mono text-sm shrink-0">{pct(summary.weakestProtocol.successRate)}</span>
                    </div>
                  )}
                  {!summary.strongestProtocol && !summary.weakestProtocol && (
                    <p className="text-sm text-muted-foreground">Not enough data yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance over time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Performance over time</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.timeSeries.length > 1 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summary.timeSeries}>
                        <defs>
                          <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), "MMM d")}
                          fontSize={11}
                          minTickGap={30}
                        />
                        <YAxis
                          domain={[0, 1]}
                          tickFormatter={(v) => `${Math.round(v * 100)}%`}
                          fontSize={11}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${Math.round(value * 100)}%`, "Completion"]}
                          labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                        />
                        <Area
                          type="monotone"
                          dataKey="completionRate"
                          stroke="hsl(var(--primary))"
                          fill="url(#completionGradient)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Not enough history yet to chart performance over time.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            {insights.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {insights.map((insight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </LayoutShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xl font-mono font-bold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
