"use client";

import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { isGuestMode } from "@/lib/api";

export function OfflineIndicator() {
  const { isOnline, pendingCount, failedCount, isSyncing, retryAll } = useOfflineSync();

  if (isGuestMode()) return null;
  if (isOnline && pendingCount === 0 && failedCount === 0) return null;

  return (
    <div
      className={
        !isOnline
          ? "bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-sm py-2 px-4 text-center font-medium flex items-center justify-center gap-2 flex-wrap"
          : "bg-muted/40 border-b border-border/40 text-muted-foreground text-sm py-2 px-4 text-center flex items-center justify-center gap-2 flex-wrap"
      }
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>
            You're offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount !== 1 ? "s" : ""} will sync automatically once you're back online` : ""}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingCount} change{pendingCount !== 1 ? "s" : ""}...</span>
        </>
      ) : failedCount > 0 ? (
        <>
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-destructive">
            {failedCount} change{failedCount !== 1 ? "s" : ""} couldn't sync
          </span>
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={retryAll}>
            Retry
          </Button>
        </>
      ) : null}
    </div>
  );
}
