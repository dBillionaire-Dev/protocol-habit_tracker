"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutShell } from "@/components/layout-shell";
import { HabitCard } from "@/components/habit-card";
import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { DayConfirmationCard } from "@/components/day-confirmation-card";
import { StreakCard } from "@/components/streak-card";
import { OnboardingModal } from "@/components/onboarding-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHabits } from "@/hooks/use-habits";
import { apiFetch } from "@/lib/api";
import type { HabitWithStatus } from "shared/schema";

export default function DashboardPage() {
  const { data: habits, isLoading, error, refetch } = useHabits();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Fetch user to check onboarding preference
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/user");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Mutation to update onboarding preference
  const updatePrefs = useMutation({
    mutationFn: async (showOnboarding: string) => {
      const res = await apiFetch("/api/user/preferences", {
        method: "POST",
        body: JSON.stringify({ showOnboarding }),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  // Show onboarding modal based on user preference
  useEffect(() => {
    if (user && user.showOnboarding === "true") {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleCloseOnboarding = (dontShowAgain: boolean) => {
    setShowOnboarding(false);
    if (dontShowAgain) {
      updatePrefs.mutate("false");
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  // Tab focus detection - refresh on return
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleRefresh]);

  // Auto-refresh every 60 seconds. This must actually refetch the query
  // (not just force a remount) — previously this bumped a `refreshKey`
  // that was folded into every HabitCard's `key`, so every 60 seconds
  // (and on every tab-focus/manual refresh) ALL habit cards were fully
  // unmounted and remounted: their entrance animation replayed, any open
  // dialog state was destroyed, and the resulting layout thrash is what
  // caused visible "jumping". Habit identity now stays stable
  // (key={habit.id} below) across refetches, so React just re-renders
  // updated props in place — no remount, no animation replay, no lost
  // scroll position.
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    }, 60000);

    return () => clearInterval(interval);
  }, [queryClient]);

  if (isLoading) {
    return (
      <LayoutShell>
        <DashboardSkeleton />
      </LayoutShell>
    );
  }

  if (error) {
    return (
      <LayoutShell>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-bold">Failed to load protocols</h2>
          <p className="text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </LayoutShell>
    );
  }

  const avoidanceHabits = habits?.filter((h: HabitWithStatus) => h.type === "avoidance") || [];
  const buildHabits = habits?.filter((h: HabitWithStatus) => h.type === "build") || [];
  const today = new Date();

  return (
    <LayoutShell>
      <OnboardingModal open={showOnboarding} onClose={handleCloseOnboarding} />
      <div className="space-y-6">
        {/* Header with Date */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Daily Protocols</h1>
            <p className="text-muted-foreground mt-1">
              Maintain discipline. Eliminate weakness.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right order-2 sm:order-1">
              {/* Desktop */}
              <div className="hidden sm:block">
                <p className="text-lg font-semibold">{format(today, "EEEE")}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                  <Calendar className="w-3 h-3" />
                  {format(today, "MMMM d, yyyy")}
                </p>
              </div>

              {/* Mobile */}
              <div className="flex sm:hidden items-center gap-1 text-sm">
                <span className="font-semibold">
                  {format(today, "EEE")} ·
                </span>
                <span className="text-muted-foreground">
                  {format(today, "MMM d, yyyy")}
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="order-1 sm:order-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Top Cards: Streaks + Day Confirmation with New Habit Button */}
        <div className="grid gap-4 md:grid-cols-2">
          <StreakCard habits={habits || []} />
          <div className="flex flex-col gap-4 h-full">
            {/* No `key` here on purpose — DayConfirmationCard manages its
                own time-based state via useConfirmationWindow's internal
                interval/visibilitychange listener, so it never needs to
                be remounted from outside. Remounting it on every refresh
                used to replay its entrance state and contributed to the
                page feeling like it "jumped". */}
            <DayConfirmationCard className="flex-1" />
            <CreateHabitDialog />
          </div>
        </div>

        {/* Avoidance Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <h2 className="text-lg font-semibold tracking-tight uppercase text-destructive">Avoid</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono">
              {avoidanceHabits.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {avoidanceHabits.length > 0 ? (
              // key is ONLY habit.id — stable across refetches, so React
              // reconciles props in place instead of unmounting and
              // remounting the card (which previously replayed its
              // entrance animation and could reset in-progress dialog
              // state every 60s / tab-focus / manual refresh).
              avoidanceHabits.map((habit: HabitWithStatus) => (
                <HabitCard key={habit.id} habit={habit} />
              ))
            ) : (
              <EmptyState type="avoidance" />
            )}
          </div>
        </section>

        {/* Build Section */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <h2 className="text-lg font-semibold tracking-tight uppercase text-primary">Build</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
              {buildHabits.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buildHabits.length > 0 ? (
              buildHabits.map((habit: HabitWithStatus) => (
                <HabitCard key={habit.id} habit={habit} />
              ))
            ) : (
              <EmptyState type="build" />
            )}
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}

function EmptyState({ type }: { type: "avoidance" | "build" }) {
  return (
    <div className="col-span-full border border-dashed border-border rounded-lg p-8 text-center bg-card/50">
      <p className="text-muted-foreground text-sm">
        No {type} protocols active. Initialize a new one to begin tracking.
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
