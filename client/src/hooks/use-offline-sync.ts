"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";
import {
  getQueue,
  removeFromQueue,
  markSyncing,
  markAttemptFailed,
  resetForRetry,
  type OfflineAction,
} from "@/lib/offline-queue";

// navigator.onLine via useSyncExternalStore so every consumer reads the
// same live value without each mounting its own online/offline
// listeners — this is imported by both the offline-aware mutations in
// use-habits.ts AND the OfflineIndicator banner.
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getSnapshot() {
  return navigator.onLine;
}
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

function endpointFor(action: OfflineAction): { url: string; body: unknown } {
  switch (action.type) {
    case "complete-daily":
      return {
        url: `/api/habits/${action.habitId}/complete`,
        body: { date: action.date, completed: true, debtRepayment: action.debtRepayment, clientHour: new Date().getHours() },
      };
    case "mark-missed":
      return {
        url: `/api/habits/${action.habitId}/complete`,
        body: { date: action.date, completed: false, clientHour: new Date().getHours() },
      };
    case "confirm-clean-day":
      return {
        url: `/api/habits/${action.habitId}/clean-day`,
        body: { date: action.date, clientHour: new Date().getHours() },
      };
  }
}

// Drains the offline queue (see lib/offline-queue.ts for what's
// queueable and why) — called automatically the moment the browser
// reports back online, and available for a manual "Retry" action on
// items that have exhausted their automatic attempts.
export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const drainingRef = useRef(false);

  const refresh = useCallback(() => setQueue(getQueue()), []);

  useEffect(() => {
    refresh();
    // Storage events fire across tabs, not the tab that made the change
    // — poll lightly within this tab too so the indicator reflects
    // enqueues made by this same tab's mutations immediately.
    const interval = setInterval(refresh, 2000);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const drain = useCallback(async () => {
    if (drainingRef.current || isGuestMode()) return;
    drainingRef.current = true;
    setIsSyncing(true);
    try {
      // Re-read fresh each pass rather than closing over a stale
      // `queue` state value, so nothing enqueued mid-drain gets missed.
      let pending = getQueue().filter((a) => a.status !== "syncing");
      for (const action of pending) {
        if (action.status === "failed") continue; // needs an explicit manual retry
        markSyncing(action.id);
        const { url, body } = endpointFor(action);
        try {
          const res = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
          if (res.ok) {
            removeFromQueue(action.id);
          } else {
            const data = await res.json().catch(() => ({}));
            markAttemptFailed(action.id, data.message || `Server rejected the request (${res.status})`);
          }
        } catch (err) {
          // Genuine network failure (still offline, or connection
          // dropped mid-sync) — leave it queued, don't count this as a
          // server rejection.
          markAttemptFailed(action.id, err instanceof Error ? err.message : "Network error");
        }
      }
      refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    } finally {
      drainingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient, refresh]);

  // Auto-drain the instant the browser comes back online.
  useEffect(() => {
    if (isOnline) drain();
  }, [isOnline, drain]);

  const retry = useCallback(
    (id: string) => {
      resetForRetry(id);
      refresh();
      drain();
    },
    [drain, refresh],
  );

  const retryAll = useCallback(() => {
    for (const action of getQueue()) {
      if (action.status === "failed") resetForRetry(action.id);
    }
    refresh();
    drain();
  }, [drain, refresh]);

  return {
    isOnline,
    queue,
    pendingCount: queue.filter((a) => a.status !== "failed").length,
    failedCount: queue.filter((a) => a.status === "failed").length,
    isSyncing,
    drain,
    retry,
    retryAll,
  };
}
