"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type InsertHabit, type UpdateHabitRequest, type HabitWithStatus } from "shared/schema";
import { apiFetch, isGuestMode } from "@/lib/api";
import { guestStorage, GuestLimitError, GuestDebtRepaymentError, GuestHabitEditError } from "@/lib/guest-storage";
import { enqueue as enqueueOfflineAction } from "@/lib/offline-queue";

// Marks a mutation's return value as having been queued locally rather
// than confirmed by the server — spec section 16's explicit "do not
// falsely claim that an action has been permanently saved to the server
// while offline." Callers (habit-card.tsx) check this flag to show a
// "saved offline, will sync" state instead of treating it identically
// to a real server confirmation.
export interface QueuedLocally {
  queuedOffline: true;
}

function getDeleteUrl(id: number): string { return `/api/habits/${id}`; }
function getUpdateUrl(id: number): string { return `/api/habits/${id}`; }
function getLogEventUrl(id: number): string { return `/api/habits/${id}/events`; }
function getConfirmCleanDayUrl(id: number): string { return `/api/habits/${id}/clean-day`; }
function getCompleteDailyUrl(id: number): string { return `/api/habits/${id}/complete`; }

// GET /api/habits — or, in guest mode, read straight from localStorage.
// Nothing about a guest session ever touches the database.
export function useHabits() {
  return useQuery({
    queryKey: ["/api/habits"],
    queryFn: async () => {
      if (isGuestMode()) {
        return guestStorage.getHabits();
      }

      const res = await apiFetch("/api/habits");
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch habits");

      const data = await res.json();
      return data as HabitWithStatus[];
    },
  });
}

// POST /api/habits
export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (habit: InsertHabit) => {
      if (isGuestMode()) {
        try {
          return guestStorage.createHabit(habit);
        } catch (err) {
          if (err instanceof GuestLimitError) {
            throw new ApiError(err.message, 402, "GUEST_LIMIT_REACHED");
          }
          throw err;
        }
      }

      const res = await apiFetch("/api/habits", {
        method: "POST",
        body: JSON.stringify(habit),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.message || "Failed to create habit", res.status, body.code);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// DELETE /api/habits/:id
export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (isGuestMode()) {
        return guestStorage.deleteHabit(id);
      }

      const res = await apiFetch(getDeleteUrl(id), { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete habit");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// POST /api/habits/:id/events
export function useLogHabitEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      if (isGuestMode()) {
        return guestStorage.logHabitEvent(id, notes);
      }

      const res = await apiFetch(getLogEventUrl(id), {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to log event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// POST /api/habits/:id/clean-day
export function useConfirmCleanDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      // clientHour: the browser's local hour-of-day, sent so the server
      // can enforce the same 9PM-midnight confirmation window the UI
      // already shows (see day-confirmation-card.tsx's
      // useConfirmationWindow) — no timezone is stored per-account
      // anywhere in this app, so the server has no other way to know
      // the user's local evening. See api/habits/[id]/clean-day/route.ts
      // for why trusting this value is a reasonable, non-security-boundary
      // tradeoff. Guest mode has no server round-trip, so it isn't
      // needed there.
      const clientHour = new Date().getHours();

      if (isGuestMode()) {
        return guestStorage.confirmCleanDay(id, date);
      }

      // Offline: queue rather than let this fail outright — see
      // lib/offline-queue.ts for why confirm-clean-day specifically is
      // safe to queue (storage.confirmCleanDay already guards against
      // replaying the same date twice). Returns a value the caller can
      // distinguish from a real server confirmation (see QueuedLocally).
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineAction({ type: "confirm-clean-day", habitId: id, date });
        return { queuedOffline: true } as QueuedLocally;
      }

      const res = await apiFetch(getConfirmCleanDayUrl(id), {
        method: "POST",
        body: JSON.stringify({ date, clientHour }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.message || "Failed to confirm clean day", res.status, body.code);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// POST /api/habits/:id/complete
export function useCompleteDaily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      date,
      completedValue,
    }: {
      id: number;
      date: string;
      completedValue: number;
    }) => {
      if (isGuestMode()) {
        try {
          return guestStorage.completeDailyTask(id, date, completedValue);
        } catch (err) {
          if (err instanceof GuestDebtRepaymentError) {
            throw new ApiError(err.message, 400, "DEBT_REPAYMENT_INVALID");
          }
          throw err;
        }
      }

      // Offline: queue rather than fail outright. Safe to queue —
      // storage.completeDailyTask UPSERTs on (habitId, date), so
      // replaying it is idempotent even if the same day somehow also
      // got confirmed another way before this synced.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineAction({
          type: "complete-daily",
          habitId: id,
          date,
          completedValue,
        });
        return { queuedOffline: true } as QueuedLocally;
      }

      const res = await apiFetch(getCompleteDailyUrl(id), {
        method: "POST",
        // clientHour: see api/habits/[id]/complete/route.ts and the same
        // comment in useConfirmCleanDay above — the server enforces the
        // 9PM-midnight window using the browser's own local hour, since
        // no per-user timezone is stored anywhere in this app.
        body: JSON.stringify({ date, completedValue, clientHour: new Date().getHours() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.message || "Failed to update status", res.status);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// PATCH /api/habits/:id — edit a habit. Free plan: only within 20 minutes
// of creation (enforced server-side, see the PATCH route); Pro/Premium
// Plus: anytime. Guest mode enforces the same 20-minute window locally.
export function useUpdateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateHabitRequest }) => {
      if (isGuestMode()) {
        try {
          return guestStorage.updateHabit(id, updates);
        } catch (err) {
          if (err instanceof GuestHabitEditError) {
            throw new ApiError(err.message, 403, "EDIT_WINDOW_EXPIRED");
          }
          throw err;
        }
      }

      const res = await apiFetch(getUpdateUrl(id), {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.message || "Failed to update protocol", res.status, body.code);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}

// POST /api/habits/:id/complete (mark as missed)
export function useMarkMissed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      if (isGuestMode()) {
        return guestStorage.completeDailyTask(id, date, 0);
      }

      // Offline: see the identical comment in useCompleteDaily above —
      // same underlying route/idempotency guarantee.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineAction({ type: "mark-missed", habitId: id, date });
        return { queuedOffline: true } as QueuedLocally;
      }

      const res = await apiFetch(getCompleteDailyUrl(id), {
        method: "POST",
        body: JSON.stringify({ date, completedValue: 0, clientHour: new Date().getHours() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.message || "Failed to mark as missed", res.status, body.code);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}
