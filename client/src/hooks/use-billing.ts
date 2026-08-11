"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";

interface BillingStatus {
  plan: "free" | "pro";
  status: string | null;
  habitCount: number;
  habitLimit: number | null;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      if (isGuestMode()) {
        return { plan: "free", status: null, habitCount: 0, habitLimit: null };
      }
      const res = await apiFetch("/api/billing/status");
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
    staleTime: 1000 * 30,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/billing/checkout", { method: "POST" });
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
