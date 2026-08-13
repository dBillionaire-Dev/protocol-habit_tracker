"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AnalyticsRange, AnalyticsSummary } from "@/lib/analytics-types";

interface AnalyticsResponse {
  summary: AnalyticsSummary;
  insights: string[];
  range: AnalyticsRange;
}

export function useAnalytics(range: AnalyticsRange) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["/api/analytics", range],
    queryFn: async () => {
      const res = await apiFetch(`/api/analytics?range=${range}`);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to load analytics") as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data;
    },
    staleTime: 1000 * 60, // avoid recomputing on every render/focus, per spec's performance guidance
  });
}
