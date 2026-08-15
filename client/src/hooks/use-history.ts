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
