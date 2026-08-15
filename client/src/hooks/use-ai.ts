"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface AiInsightsResponse {
  insights: string[];
  recommendations: string[];
  message?: string;
}

interface AiError extends Error {
  code?: string;
}

export function useAiInsights(enabled: boolean) {
  return useQuery<AiInsightsResponse>({
    queryKey: ["/api/ai/insights"],
    queryFn: async () => {
      const res = await apiFetch("/api/ai/insights");
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to load insights") as AiError;
        err.code = data.code;
        throw err;
      }
      return data;
    },
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour — avoid re-triggering a real API call on every visit
    retry: false,
  });
}

export interface PlanSuggestion {
  name: string;
  type: "build" | "avoidance";
  baseTaskValue: number | null;
  unit: string | null;
  frequency: string;
  rationale: string;
}

export function useAiPlan() {
  return useMutation({
    mutationFn: async (goal: string) => {
      const res = await apiFetch("/api/ai/plan", {
        method: "POST",
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to generate a plan") as AiError;
        err.code = data.code;
        throw err;
      }
      return data as { suggestions: PlanSuggestion[] };
    },
  });
}
