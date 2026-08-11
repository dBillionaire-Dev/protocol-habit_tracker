"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type InsertHabit, type HabitWithStatus } from "shared/schema";
import { apiFetch, isGuestMode } from "@/lib/api";
import { guestStorage, GuestLimitError } from "@/lib/guest-storage";

function getDeleteUrl(id: number): string { return `/api/habits/${id}`; }
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
      if (isGuestMode()) {
        return guestStorage.confirmCleanDay(id, date);
      }

      const res = await apiFetch(getConfirmCleanDayUrl(id), {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error("Failed to confirm clean day");
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
    mutationFn: async ({ id, date, completed }: { id: number; date: string; completed: boolean }) => {
      if (isGuestMode()) {
        return guestStorage.completeDailyTask(id, date, completed);
      }

      const res = await apiFetch(getCompleteDailyUrl(id), {
        method: "POST",
        body: JSON.stringify({ date, completed }),
      });
      if (!res.ok) throw new Error("Failed to update status");
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
        return guestStorage.completeDailyTask(id, date, false);
      }

      const res = await apiFetch(getCompleteDailyUrl(id), {
        method: "POST",
        body: JSON.stringify({ date, completed: false }),
      });
      if (!res.ok) throw new Error("Failed to mark as missed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}
