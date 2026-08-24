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
    case "repayment":
      return <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">repayment</Badge>;
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
                <SelectItem value="repayment">Repayment</SelectItem>
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
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-muted-foreground font-mono text-xs shrink-0">
                          {format(new Date(`${entry.date}T00:00:00`), "MMM d, yyyy")}
                        </span>
                        <span className="font-medium truncate max-w-[55vw] sm:max-w-none">
                          {entry.habitName}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {entry.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
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
                        {entry.debtRepaid !== null && (
                          <span className="text-xs text-emerald-500 font-mono">
                            repaid {entry.debtRepaid}d
                          </span>
                        )}
                        {entry.type === "build" && entry.remainingDebtAfter !== null && entry.remainingDebtAfter > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            debt: {entry.remainingDebtAfter}d
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
