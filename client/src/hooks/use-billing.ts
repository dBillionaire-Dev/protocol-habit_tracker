"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";
import type { PlanTier, BillingInterval } from "shared/schema";

interface BillingStatus {
  plan: PlanTier;
  billingInterval: BillingInterval | null;
  status: string | null;
  habitCount: number;
  habitLimit: number | null;
  isSuperUser: boolean;
  realPlan: PlanTier;
  previewPlan: PlanTier | null;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      if (isGuestMode()) {
        return {
          plan: "free",
          billingInterval: null,
          status: null,
          habitCount: 0,
          habitLimit: null,
          isSuperUser: false,
          realPlan: "free",
          previewPlan: null,
        };
      }
      const res = await apiFetch("/api/billing/status");
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
    staleTime: 1000 * 30,
  });
}

// Super-user only — see /api/billing/preview-plan. Lets an internal
// tester experience the app as any tier (or null to return to full
// access) without touching real billing.
export function useSetPreviewPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: PlanTier | null) => {
      const res = await apiFetch("/api/billing/preview-plan", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set preview plan");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async ({ tier, interval }: { tier: "pro" | "premium_plus"; interval: BillingInterval }) => {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start checkout");
      return data as { authorizationUrl: string };
    },
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    },
  });
}
