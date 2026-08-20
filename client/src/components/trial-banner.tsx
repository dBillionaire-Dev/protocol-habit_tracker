"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planDisplayName } from "@/lib/entitlements";
import type { PlanTier, TrialType } from "shared/schema";

interface ActiveTrialInfo {
  trialType: TrialType;
  startedAt: string;
  endsAt: string;
  grantsPlan: PlanTier;
  returnsToPlan: PlanTier;
}

function useCountdown(endsAt: string) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(endsAt).getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return Math.max(0, remainingMs);
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(0, minutes)}m remaining`;
}

// Spec section 1: "Clearly display: Trial active status, Remaining
// trial time, Trial expiry date" plus, for the Pro -> Premium Plus
// trial specifically, "Clearly display that they will return to Pro if
// they do not upgrade." Rendered on the pricing page for now (where the
// upgrade CTA already lives) — a persistent header badge can follow once
// the shared nav/header from spec section 10 exists.
export function TrialBanner({
  trial,
  onUpgrade,
  isUpgradePending,
}: {
  trial: ActiveTrialInfo;
  onUpgrade: () => void;
  isUpgradePending?: boolean;
}) {
  const remainingMs = useCountdown(trial.endsAt);
  const expiryDate = new Date(trial.endsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">
            You&apos;re trying {planDisplayName(trial.grantsPlan)} — {formatRemaining(remainingMs)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trial ends {expiryDate}.{" "}
            {trial.returnsToPlan === "free"
              ? "You'll return to Free unless you subscribe."
              : `You'll return to ${planDisplayName(trial.returnsToPlan)} unless you upgrade.`}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 shrink-0"
        onClick={onUpgrade}
        disabled={isUpgradePending}
      >
        {isUpgradePending ? "Redirecting..." : `Keep ${planDisplayName(trial.grantsPlan)}`}
      </Button>
    </div>
  );
}
