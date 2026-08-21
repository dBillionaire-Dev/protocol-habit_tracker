"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";
import type { PlanTier, BillingInterval, TrialType } from "shared/schema";

interface ActiveTrialInfo {
  trialType: TrialType;
  startedAt: string;
  endsAt: string;
  grantsPlan: PlanTier;
  // What the user's plan reverts to when this trial ends — "pro" for the
  // Pro -> Premium Plus trial, "free" for the two Free-plan trials.
  returnsToPlan: PlanTier;
}

interface BillingStatus {
  plan: PlanTier;
  billingInterval: BillingInterval | null;
  status: string | null;
  habitCount: number;
  habitLimit: number | null;
  isSuperUser: boolean;
  realPlan: PlanTier;
  previewPlan: PlanTier | null;
  currentPeriodEnd: string | null;
  // True when status is "cancelled" but currentPeriodEnd hasn't passed
  // yet — the user keeps `plan` access until then (see
  // cancelSubscriptionRecord in lib/billing.ts), after which they revert
  // to Free automatically.
  cancelAtPeriodEnd: boolean;
  activeTrial: ActiveTrialInfo | null;
  // Trial types this user could still start right now (not yet used,
  // and their real plan matches what that trial requires).
  eligibleTrials: TrialType[];
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
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          activeTrial: null,
          eligibleTrials: [],
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

// POST /api/billing/trial — start one of the three one-time trials (spec
// section 1). Not available in guest mode (see the route) since a trial
// needs a persistent account to attach its one-time-use record to.
export function useStartTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trialType: TrialType) => {
      const res = await apiFetch("/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ trialType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start trial");
      return data as { trialType: TrialType; startedAt: string; endsAt: string; grantsPlan: PlanTier };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}
