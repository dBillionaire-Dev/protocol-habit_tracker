import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertHabit, type HabitWithStatus } from "@shared/schema";
import { z } from "zod";

// Helper to log errors safely
function logZodError(error: unknown, context: string) {
  if (error instanceof z.ZodError) {
    console.error(`[Zod] ${context} validation failed:`, error.format());
  } else {
    console.error(`[API] ${context} failed:`, error);
  }
}

// GET /api/habits
export function useHabits() {
  return useQuery({
    queryKey: [api.habits.list.path],
    queryFn: async () => {
      const res = await fetch(api.habits.list.path, { credentials: "include" });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch habits");
      
      const data = await res.json();
      try {
        return api.habits.list.responses[200].parse(data);
      } catch (e) {
        logZodError(e, "useHabits");
        throw e;
      }
    },
  });
}

// POST /api/habits
export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (habit: InsertHabit) => {
      // Validate input before sending
      const validated = api.habits.create.input.parse(habit);
      
      const res = await fetch(api.habits.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create habit");
      return api.habits.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}

// DELETE /api/habits/:id
export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.habits.delete.path, { id });
      const res = await fetch(url, { 
        method: "DELETE",
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete habit");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}

// POST /api/habits/:id/events (Avoidance: Log Incident)
export function useLogHabitEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const url = buildUrl(api.habits.logEvent.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log event");
      return api.habits.logEvent.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}

// POST /api/habits/:id/clean-day (Avoidance: Confirm Clean)
export function useConfirmCleanDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      const url = buildUrl(api.habits.confirmCleanDay.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to confirm clean day");
      return api.habits.confirmCleanDay.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}

// POST /api/habits/:id/complete (Build: Complete Daily)
export function useCompleteDaily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date, completed }: { id: number; date: string; completed: boolean }) => {
      const url = buildUrl(api.habits.completeDaily.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return api.habits.completeDaily.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}

// Mark as Missed (Build: Failed to complete)
export function useMarkMissed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      const url = buildUrl(api.habits.completeDaily.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed: false }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as missed");
      return api.habits.completeDaily.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}
