"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";
import type { PartnershipStatus } from "shared/schema";

export interface PartnershipView {
  id: number;
  status: PartnershipStatus;
  initiatorUserId: string;
  initiatorEmail: string;
  initiatorHabitId: number;
  initiatorHabitName: string;
  partnerUserId: string;
  partnerEmail: string;
  partnerHabitId: number | null;
  partnerHabitName: string | null;
  invitedAt: string;
  respondedAt: string | null;
  endedAt: string | null;
  bestSharedStreak: number;
  currentSharedStreak: number;
  initiatorCompletedToday: boolean;
  partnerCompletedToday: boolean;
  sharedTrackingActive: boolean;
}

class PartnershipApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

// Not available in guest mode — see the GET /api/partnerships route
// comment for why (a partnership links two persistent accounts; guest
// habits live only in localStorage with nothing server-side to link).
export function usePartnerships() {
  return useQuery<PartnershipView[]>({
    queryKey: ["/api/partnerships"],
    queryFn: async () => {
      const res = await apiFetch("/api/partnerships");
      if (!res.ok) throw new Error("Failed to load streak partners");
      return res.json();
    },
    enabled: !isGuestMode(),
  });
}

export function useInvitePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, partnerEmail }: { habitId: number; partnerEmail: string }) => {
      const res = await apiFetch("/api/partnerships/invite", {
        method: "POST",
        body: JSON.stringify({ habitId, partnerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new PartnershipApiError(data.message || "Failed to send invite", data.code);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
    },
  });
}

export function useAcceptPartnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, habitId }: { id: number; habitId: number }) => {
      const res = await apiFetch(`/api/partnerships/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ habitId }),
      });
      const data = await res.json();
      if (!res.ok) throw new PartnershipApiError(data.message || "Failed to accept invite");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
    },
  });
}

function useSimplePartnershipAction(action: "decline" | "cancel" | "end") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/partnerships/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new PartnershipApiError(data.message || `Failed to ${action} partnership`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
    },
  });
}

export function useDeclinePartnership() {
  return useSimplePartnershipAction("decline");
}
export function useCancelPartnership() {
  return useSimplePartnershipAction("cancel");
}
export function useEndPartnership() {
  return useSimplePartnershipAction("end");
}
