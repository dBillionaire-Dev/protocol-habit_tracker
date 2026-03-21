"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type InsertHabit, type HabitWithStatus } from "@/types/schema";

// API endpoints helper functions
function getDeleteUrl(id: number): string { return `/api/habits/${id}`; }
function getLogEventUrl(id: number): string { return `/api/habits/${id}/events`; }
function getConfirmCleanDayUrl(id: number): string { return `/api/habits/${id}/clean-day`; }
function getCompleteDailyUrl(id: number): string { return `/api/habits/${id}/complete`; }

// GET /api/habits
export function useHabits() {
  return useQuery({
    queryKey: ["/api/habits"],
    queryFn: async () => {
      const res = await fetch("/api/habits", { credentials: "include" });
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
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(habit),
        credentials: "include",
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
      const res = await fetch(getDeleteUrl(id), { 
        method: "DELETE",
        credentials: "include" 
      });
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
      const res = await fetch(getLogEventUrl(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
        credentials: "include",
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
      const res = await fetch(getConfirmCleanDayUrl(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
        credentials: "include",
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
      const res = await fetch(getCompleteDailyUrl(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed }),
        credentials: "include",
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
      const res = await fetch(getCompleteDailyUrl(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed: false }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as missed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    },
  });
}
