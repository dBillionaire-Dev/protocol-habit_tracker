#!/usr/bin/env bash
set -euo pipefail

# MONETIZATION SPEC — PHASE 2b: Full History + CSV Export.
#
# REQUIRES Phase 1, the super-user script, and add-analytics.sh to
# already be applied (uses rangeToStartDate from lib/analytics.ts and
# the entitlements/effective-plan system).
#
# What this adds:
#   - client/src/lib/history.ts (NEW): builds a unified history of every
#     tracked day across Build and Avoidance protocols. Honest about
#     what's actually reconstructable from existing data:
#       - Build streak per entry: exactly replayed from the real
#         completed/missed sequence (matches the app's real streak rule)
#       - Avoidance streak per entry: null — avoid's real streak only
#         advances on an explicit "Confirm Clean Day" action, and only
#         the latest confirmation date is stored, not a full historical
#         log, so a per-day value can't be reconstructed honestly
#       - Penalty info: Build's stored dailyHabitStatus.penaltyLevel
#         (exact) vs. Avoidance's violation-event count for that date
#         (exact) rather than a fabricated running debt total
#   - GET /api/history?range&habitId&type&status&page&pageSize (NEW) —
#     Free gets a 30-day unfiltered "Basic history" view; Pro/Premium
#     Plus get all ranges (7d/30d/90d/6m/1y/all) plus filtering by
#     protocol/type/status
#   - GET /api/export/csv (NEW) — Pro/Premium Plus only. Every row scoped
#     to storage.getHabit(...).userId === user.id before anything is
#     read; there's no path that can return another user's data.
#   - /history page (NEW): range + filter controls, paginated list,
#     Export CSV button (hidden entirely for Free)
#   - Nav link added alongside Dashboard/Analytics
#
# Usage: cd into your protocol-habit_tracker folder, then:
#   bash add-history-export.sh

if [ ! -f "package.json" ] || [ ! -d "shared" ] || [ ! -d "client" ]; then
  echo "error: run this from the root of protocol-habit_tracker" >&2
  echo "  (expected to find package.json, shared/, and client/ here)" >&2
  exit 1
fi

if [ ! -f "client/src/lib/analytics.ts" ]; then
  echo "error: this requires add-analytics.sh to be applied first." >&2
  echo "  (client/src/lib/analytics.ts not found — history.ts imports rangeToStartDate from it)" >&2
  exit 1
fi

echo "1/7 Writing client/src/lib/analytics-types.ts (adds History types)..."
cat > client/src/lib/analytics-types.ts << 'FILE_EOF'
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

export type HistoryStatus = "completed" | "missed" | "clean" | "violation";

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
}

export interface HistoryFilters {
  range: AnalyticsRange;
  habitId?: number;
  type?: "build" | "avoidance";
  status?: HistoryStatus;
}
FILE_EOF

echo "2/7 Writing client/src/lib/history.ts (new — history engine + CSV serializer)..."
cat > client/src/lib/history.ts << 'FILE_EOF'
import { db } from "./db";
import { habits, habitEvents, dailyHabitStatus } from "shared/schema";
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

      const filtered = rangeStart
        ? rows.filter((r) => r.date >= toDateKey(rangeStart))
        : rows;

      // Sort ascending to replay the streak accurately, then we'll
      // reverse for the final newest-first output.
      const sorted = [...filtered].sort((a, b) => (a.date < b.date ? -1 : 1));

      let runningStreak = 0;
      let previousDate: string | null = null;

      for (const row of sorted) {
        if (row.completed) {
          const expectedPrev = new Date(`${row.date}T00:00:00Z`);
          expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1);
          const expectedPrevKey = toDateKey(expectedPrev);
          runningStreak = previousDate === expectedPrevKey ? runningStreak + 1 : 1;
        } else {
          runningStreak = 0;
        }
        previousDate = row.date;

        entries.push({
          date: row.date,
          habitId: habit.id,
          habitName: habit.name,
          type: "build",
          status: row.completed ? "completed" : "missed",
          completed: row.completed,
          missed: !row.completed,
          streak: runningStreak,
          penaltyInfo: row.penaltyLevel,
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
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}
FILE_EOF

echo "3/7 Writing client/src/app/api/history/route.ts (new)..."
mkdir -p client/src/app/api/history
cat > client/src/app/api/history/route.ts << 'FILE_EOF'
import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { buildHistoryEntries } from "@/lib/history";
import type { AnalyticsRange, HistoryStatus } from "@/lib/analytics-types";

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "6m", "1y", "all"];
const BASIC_RANGES: AnalyticsRange[] = ["7d", "30d"]; // what "Basic history" (Free) allows
const VALID_STATUSES: HistoryStatus[] = ["completed", "missed", "clean", "violation"];

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account to view history.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  const hasFull = hasFeature(plan, "full_history");

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "30d";
  let range = (VALID_RANGES as string[]).includes(rangeParam)
    ? (rangeParam as AnalyticsRange)
    : "30d";

  // Free plan gets "Basic history" only — a short, unfiltered window.
  // Pro/Premium Plus get every range plus filtering.
  if (!hasFull) {
    if (!(BASIC_RANGES as string[]).includes(range)) {
      return NextResponse.json(
        { message: "That range is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
        { status: 403 },
      );
    }
  }

  const habitIdParam = params.get("habitId");
  const typeParam = params.get("type");
  const statusParam = params.get("status");

  if (!hasFull && (habitIdParam || typeParam || statusParam)) {
    return NextResponse.json(
      { message: "Filtering history is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const habitId = habitIdParam ? Number(habitIdParam) : undefined;
  if (habitId !== undefined) {
    const habit = await storage.getHabit(habitId);
    if (!habit || habit.userId !== user.id) {
      return NextResponse.json({ message: "Habit not found" }, { status: 404 });
    }
  }

  const type = typeParam === "build" || typeParam === "avoidance" ? typeParam : undefined;
  const status = (VALID_STATUSES as string[]).includes(statusParam ?? "")
    ? (statusParam as HistoryStatus)
    : undefined;

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "50") || 50));

  const allEntries = await buildHistoryEntries(user.id, { range, habitId, type, status });
  const total = allEntries.length;
  const start = (page - 1) * pageSize;
  const entries = allEntries.slice(start, start + pageSize);

  return NextResponse.json({ entries, total, page, pageSize, hasFull });
}
FILE_EOF

echo "4/7 Writing client/src/app/api/export/csv/route.ts (new)..."
mkdir -p client/src/app/api/export/csv
cat > client/src/app/api/export/csv/route.ts << 'FILE_EOF'
import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { buildHistoryEntries, toCSV } from "@/lib/history";
import type { AnalyticsRange, HistoryStatus } from "@/lib/analytics-types";

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "6m", "1y", "all"];
const VALID_STATUSES: HistoryStatus[] = ["completed", "missed", "clean", "violation"];

// Exports the current user's own Protocol history as CSV. Every query is
// scoped to storage.getHabit(...).userId === user.id before anything is
// read — there is no path here that can return another user's data.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account, then upgrade to export data.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "data_export")) {
    return NextResponse.json(
      { message: "Data export is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "all";
  const range = (VALID_RANGES as string[]).includes(rangeParam) ? (rangeParam as AnalyticsRange) : "all";

  const habitIdParam = params.get("habitId");
  const habitId = habitIdParam ? Number(habitIdParam) : undefined;
  if (habitId !== undefined) {
    const habit = await storage.getHabit(habitId);
    if (!habit || habit.userId !== user.id) {
      return NextResponse.json({ message: "Habit not found" }, { status: 404 });
    }
  }

  const typeParam = params.get("type");
  const type = typeParam === "build" || typeParam === "avoidance" ? typeParam : undefined;
  const statusParam = params.get("status");
  const status = (VALID_STATUSES as string[]).includes(statusParam ?? "")
    ? (statusParam as HistoryStatus)
    : undefined;

  const entries = await buildHistoryEntries(user.id, { range, habitId, type, status });
  const csv = toCSV(entries);
  const filename = `protocol-history-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
FILE_EOF

echo "5/7 Writing client/src/hooks/use-history.ts (new)..."
cat > client/src/hooks/use-history.ts << 'FILE_EOF'
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AnalyticsRange, HistoryEntry, HistoryStatus } from "@/lib/analytics-types";

interface HistoryFilters {
  range: AnalyticsRange;
  habitId?: number;
  type?: "build" | "avoidance";
  status?: HistoryStatus;
  page: number;
  pageSize: number;
}

interface HistoryResponse {
  entries: HistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasFull: boolean;
}

export function useHistory(filters: HistoryFilters) {
  return useQuery<HistoryResponse>({
    queryKey: ["/api/history", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        range: filters.range,
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.habitId) params.set("habitId", String(filters.habitId));
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);

      const res = await apiFetch(`/api/history?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to load history") as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data;
    },
    staleTime: 1000 * 30,
  });
}

export function exportCsvUrl(filters: {
  range: AnalyticsRange;
  habitId?: number;
  type?: "build" | "avoidance";
  status?: HistoryStatus;
}): string {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.habitId) params.set("habitId", String(filters.habitId));
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  return `/api/export/csv?${params.toString()}`;
}
FILE_EOF

echo "6/7 Writing client/src/app/history/page.tsx (new)..."
mkdir -p client/src/app/history
cat > client/src/app/history/page.tsx << 'FILE_EOF'
"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Lock, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutShell } from "@/components/layout-shell";
import { useHistory, exportCsvUrl } from "@/hooks/use-history";
import { useHabits } from "@/hooks/use-habits";
import { useBillingStatus } from "@/hooks/use-billing";
import { hasFeature } from "@/lib/entitlements";
import type { AnalyticsRange, HistoryStatus } from "@/lib/analytics-types";
import { cn } from "@/lib/utils";

const FULL_RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];
const BASIC_RANGES = FULL_RANGES.filter((r) => r.value === "7d" || r.value === "30d");

const PAGE_SIZE = 25;

function statusBadge(status: HistoryStatus) {
  switch (status) {
    case "completed":
    case "clean":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">{status}</Badge>;
    case "missed":
    case "violation":
      return <Badge variant="destructive">{status}</Badge>;
  }
}

export default function HistoryPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [habitId, setHabitId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: billing } = useBillingStatus();
  const { data: habits } = useHabits();
  const hasFull = hasFeature(billing?.plan ?? "free", "full_history");
  const canExport = hasFeature(billing?.plan ?? "free", "data_export");

  const filters = {
    range,
    habitId: habitId !== "all" ? Number(habitId) : undefined,
    type: type !== "all" ? (type as "build" | "avoidance") : undefined,
    status: status !== "all" ? (status as HistoryStatus) : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useHistory(filters);

  const isLocked = (error as (Error & { code?: string }) | null)?.code === "FEATURE_LOCKED";
  const ranges = hasFull ? FULL_RANGES : BASIC_RANGES;

  function updateRange(next: AnalyticsRange) {
    setRange(next);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold tracking-tight">History</h1>
          {canExport && (
            <Button asChild variant="outline" size="sm">
              <a href={exportCsvUrl({ range, habitId: filters.habitId, type: filters.type, status: filters.status })}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </a>
            </Button>
          )}
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap w-fit">
          {ranges.map((r) => (
            <button
              key={r.value}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                range === r.value ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
              onClick={() => updateRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {!hasFull && (
          <p className="text-xs text-muted-foreground">
            Free plan shows the last 30 days.{" "}
            <Link href="/pricing" className="underline">
              Upgrade
            </Link>{" "}
            for full history and filtering.
          </p>
        )}

        {/* Filters — Pro/Premium Plus only */}
        {hasFull && (
          <div className="flex flex-wrap gap-2">
            <Select value={habitId} onValueChange={(v) => { setHabitId(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All protocols" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All protocols</SelectItem>
                {habits?.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="build">Build</SelectItem>
                <SelectItem value="avoidance">Avoid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="violation">Violation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLocked && (
          <div className="text-center py-12 space-y-3">
            <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {(error as Error).message}
            </p>
            <Button asChild size="sm">
              <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
        )}

        {isLoading && !isLocked && (
          <p className="text-sm text-muted-foreground">Loading history...</p>
        )}

        {data && !isLocked && (
          <>
            {data.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No history in this range.
              </p>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {data.entries.map((entry, i) => (
                    <div
                      key={`${entry.habitId}-${entry.date}-${i}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-muted-foreground font-mono text-xs shrink-0 w-20">
                          {format(new Date(`${entry.date}T00:00:00`), "MMM d, yyyy")}
                        </span>
                        <span className="font-medium truncate">{entry.habitName}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {entry.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {entry.streak !== null && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {entry.streak}d streak
                          </span>
                        )}
                        {entry.penaltyInfo !== null && entry.penaltyInfo > 0 && (
                          <span className="text-xs text-orange-500 font-mono">
                            {entry.type === "build" ? `+${entry.penaltyInfo} penalty` : `${entry.penaltyInfo} event${entry.penaltyInfo !== 1 ? "s" : ""}`}
                          </span>
                        )}
                        {statusBadge(entry.status)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </LayoutShell>
  );
}
FILE_EOF

echo "7/7 Writing client/src/components/layout-shell.tsx (adds History nav link)..."
cat > client/src/components/layout-shell.tsx << 'FILE_EOF'
"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Shield, Trash2, Loader2, User as UserIcon, Crown, Sparkles, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useBillingStatus, useCancelSubscription, useSetPreviewPlan } from "@/hooks/use-billing";
import { planDisplayName, isPaidPlan } from "@/lib/entitlements";
import type { PlanTier } from "shared/schema";

interface LayoutShellProps {
  children: React.ReactNode;
}

function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const f = firstName?.trim()?.[0];
  const l = lastName?.trim()?.[0];
  if (f || l) return `${f ?? ""}${l ?? ""}`.toUpperCase();
  return email?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function LayoutShell({ children }: LayoutShellProps) {
  const { user, logout, deleteAccount, isDeletingAccount, deleteAccountError } = useAuth();
  const { data: billing } = useBillingStatus();
  const { mutate: cancelSubscription, isPending: isCancelling } = useCancelSubscription();
  const { mutate: setPreviewPlan, isPending: isSettingPreview } = useSetPreviewPlan();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isGuest = user?.provider === "guest";
  const plan = billing?.plan ?? "free";
  const isPaid = isPaidPlan(plan);
  const isSuperUser = billing?.isSuperUser ?? false;
  const isPreviewing = isSuperUser && !!billing?.previewPlan;
  const displayName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : isGuest
        ? "Guest"
        : user?.email ?? "Account";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-5 h-5" />
            <span>PROTOCOL</span>
          </Link>

          {!isGuest && user && (
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/history"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                History
              </Link>
            </nav>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                data-testid="button-profile-menu"
              >
                <Avatar className="h-8 w-8">
                  {user?.profileImageUrl ? (
                    <AvatarImage src={user.profileImageUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback>
                    {isGuest ? <UserIcon className="h-4 w-4" /> : initials(user?.firstName, user?.lastName, user?.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none truncate">{displayName}</p>
                    {isPaid && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        <Crown className="w-3 h-3" />
                        {planDisplayName(plan)}
                      </span>
                    )}
                    {isPreviewing && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
                        <FlaskConical className="w-3 h-3" />
                        Preview
                      </span>
                    )}
                  </div>
                  {!isGuest && user?.email && (
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                  {isGuest && (
                    <p className="text-xs leading-none text-muted-foreground">
                      Guest session, nothing here is saved to an account
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isSuperUser && (
                <>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal pb-0">
                    Preview as (testing only)
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={billing?.previewPlan ?? "live"}
                    onValueChange={(value) => setPreviewPlan(value === "live" ? null : (value as PlanTier))}
                  >
                    <DropdownMenuRadioItem value="live" disabled={isSettingPreview} data-testid="menu-preview-live">
                      Live (full access)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="free" disabled={isSettingPreview} data-testid="menu-preview-free">
                      Free
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="pro" disabled={isSettingPreview} data-testid="menu-preview-pro">
                      Pro
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="premium_plus" disabled={isSettingPreview} data-testid="menu-preview-premium-plus">
                      Premium Plus
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isGuest && !isPaid && (
                <DropdownMenuItem asChild data-testid="menu-item-upgrade">
                  <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Link>
                </DropdownMenuItem>
              )}
              {!isGuest && isPaid && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setCancelConfirmOpen(true);
                  }}
                  data-testid="menu-item-manage-subscription"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Manage Subscription
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => logout()} data-testid="menu-item-sign-out">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
              {!isGuest && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  data-testid="menu-item-delete-account"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Pro subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll keep Pro access until your current billing period
                  ends, then drop back to the free plan (3 active
                  protocols). Your existing protocols beyond the free
                  limit won't be deleted, but you won't be able to create
                  new ones until you're back under the limit or resubscribe.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCancelling}>Keep {planDisplayName(plan)}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    cancelSubscription(undefined, { onSuccess: () => setCancelConfirmOpen(false) });
                  }}
                  disabled={isCancelling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel subscription"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and every habit,
                  streak, and debt record attached to it. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteAccountError && (
                <p className="text-sm text-destructive">
                  {deleteAccountError.message}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingAccount}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    deleteAccount();
                  }}
                  disabled={isDeletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete account"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Preview mode banner — impossible to miss while testing as a
          different tier, so a super user never mistakes it for their
          real account state. */}
      {isPreviewing && (
        <div className="bg-purple-500/10 border-b border-purple-500/20 text-purple-400 text-sm py-2 text-center font-medium">
          <FlaskConical className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Previewing as {planDisplayName(billing?.previewPlan ?? "free")} — this is not your real plan
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 mt-auto">
        <div className="container max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground font-mono">
          DISCIPLINE EQUALS FREEDOM
        </div>
      </footer>
    </div>
  );
}
FILE_EOF

echo
echo "Done. No new tables or migrations — history reads existing"
echo "dailyHabitStatus and habitEvents tables only."
echo
echo "Next: pnpm install && pnpm dev"
