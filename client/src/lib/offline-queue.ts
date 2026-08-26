// Spec section 16 (Offline Support) — the offline action queue.
//
// Deliberately localStorage-backed and driven from page context, NOT
// the service worker's IndexedDB + Background Sync API that sw.js had
// already sketched out (getPendingEventsFromDB/removePendingEventFromDB
// were stubs — "would use IndexedDB in real implementation... returns
// empty array as placeholder" — nothing behind them actually worked).
// Two reasons for this choice over finishing that approach instead:
//   1. The Background Sync API has no Safari/iOS support at all, which
//      would silently exclude a real slice of PWA users.
//   2. Replaying queued actions from page context means reusing the
//      EXACT SAME mutation logic (use-habits.ts) already validated for
//      online use, instead of re-implementing raw fetch calls with
//      separate error handling inside the service worker.
//
// SCOPE: only actions with a server-side idempotency guarantee are
// queueable here — see ACTION_TYPES below and lib/storage.ts:
//   - complete-daily / mark-missed both go through completeDailyTask,
//     which UPSERTs on (habitId, date) — replaying it twice is a no-op
//     the second time, not a duplicate.
//   - confirm-clean-day has an explicit `lastCleanDate === date` guard
//     for the same reason.
// habitEvents (logging an avoidance violation) is DELIBERATELY NOT
// included — storage.logHabitEvent is a bare insert with no dedup key,
// and unconditionally increments debt on every call. Queuing it here
// without a real idempotency key would risk silently double-counting a
// violation if a sync retry ever fired twice for the same queued item.

const QUEUE_KEY = "protocol:offline-queue";
const MAX_ATTEMPTS = 5;

export const ACTION_TYPES = ["complete-daily", "mark-missed", "confirm-clean-day"] as const;
export type OfflineActionType = typeof ACTION_TYPES[number];

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  habitId: number;
  date: string;
  // complete-daily only -- raw units actually done that day. Not present
  // for mark-missed (which always means 0) or confirm-clean-day
  // (avoidance habits don't have this concept at all).
  completedValue?: number;
  createdAt: string;
  attempts: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

function load(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full/unavailable — the action that triggered this enqueue
    // attempt is lost, but this shouldn't crash the calling mutation.
    console.error("Failed to persist offline queue");
  }
}

export function getQueue(): OfflineAction[] {
  return load();
}

export function enqueue(action: Omit<OfflineAction, "id" | "createdAt" | "attempts" | "status">): OfflineAction {
  const queue = load();
  const entry: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  queue.push(entry);
  save(queue);
  return entry;
}

export function removeFromQueue(id: string): void {
  save(load().filter((a) => a.id !== id));
}

export function markSyncing(id: string): void {
  save(load().map((a) => (a.id === id ? { ...a, status: "syncing" as const } : a)));
}

export function markAttemptFailed(id: string, error: string): void {
  save(
    load().map((a) => {
      if (a.id !== id) return a;
      const attempts = a.attempts + 1;
      return {
        ...a,
        attempts,
        lastError: error,
        // Stop auto-retrying after MAX_ATTEMPTS — surfaced in the UI as
        // "failed" with a manual retry affordance (spec's "handle sync
        // failures" requirement), rather than hammering the server or
        // silently dropping the user's data.
        status: attempts >= MAX_ATTEMPTS ? ("failed" as const) : ("pending" as const),
      };
    }),
  );
}

// Resets a failed item back to pending (and its attempt counter to 0)
// for a manual "Retry" click.
export function resetForRetry(id: string): void {
  save(load().map((a) => (a.id === id ? { ...a, status: "pending" as const, attempts: 0 } : a)));
}
