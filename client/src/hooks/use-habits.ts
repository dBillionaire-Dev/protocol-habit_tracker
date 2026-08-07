"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type InsertHabit, type HabitWithStatus } from "shared/schema";
import { apiFetch } from "@/lib/api";

function getDeleteUrl(id: number): string { return `/api/habits/${id}`; }
function getLogEventUrl(id: number): string { return `/api/habits/${id}/events`; }
function getConfirmCleanDayUrl(id: number): string { return `/api/habits/${id}/clean-day`; }
function getCompleteDailyUrl(id: number): string { return `/api/habits/${id}/complete`; }

// GET /api/habits
export function useHabits() {
  return useQuery({
    queryKey: ["/api/habits"],
    queryFn: async () => {
      const res = await apiFetch("/api/habits");
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch habits");

      const data = await res.json();
      return data as HabitWithStatus[];
    },
  });
}

// POST /api/habits
export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (habit: InsertHabit) => {
      const res = await apiFetch("/api/habits", {
        method: "POST",
        body: JSON.stringify(habit),
      });

      if (!res.ok) throw new Error("Failed to create habit");
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
