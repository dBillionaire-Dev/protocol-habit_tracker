"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PlanTier } from "shared/schema";

interface ReferralStatsResponse {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  signedUp: number;
  qualified: number;
  paidConversions: number;
  bonusPlan: PlanTier | null;
  bonusExpiresAt: string | null;
  bonusDaysRemaining: number;
  nextMilestone: { qualifiedNeeded: number; days: number } | null;
}

export function useReferralStats() {
  return useQuery<ReferralStatsResponse>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const res = await apiFetch("/api/referrals/me");
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to load referral stats") as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data;
    },
    staleTime: 1000 * 30,
  });
}
