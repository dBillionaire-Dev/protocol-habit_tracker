import { useState, useEffect, useCallback } from "react";
import { useHabits } from "@/hooks/use-habits";
import { LayoutShell } from "@/components/layout-shell";
import { HabitCard } from "@/components/habit-card";
import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { DayConfirmationCard, calculateWindowState } from "@/components/day-confirmation-card";
import { StreakCard } from "@/components/streak-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: habits, isLoading, error, refetch } = useHabits();
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Recalculate window state
    setRefreshKey(prev => prev + 1);
    // Refresh API data
    await queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  // Tab focus detection - refresh on return
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

  const avoidanceHabits = habits?.filter(h => h.type === "avoidance") || [];
  const buildHabits = habits?.filter(h => h.type === "build") || [];
  const today = new Date();

  return (
    <LayoutShell>
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
            <div className="text-right hidden sm:block">
              <p className="text-lg font-semibold">{format(today, "EEEE")}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3" />
                {format(today, "MMMM d, yyyy")}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Top Cards: Streaks + Day Confirmation */}
        <div className="grid gap-4 md:grid-cols-2">
          <StreakCard habits={habits || []} />
          <DayConfirmationCard key={refreshKey} />
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
              avoidanceHabits.map(habit => (
                <HabitCard key={`${habit.id}-${refreshKey}`} habit={habit} />
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
              buildHabits.map(habit => (
                <HabitCard key={`${habit.id}-${refreshKey}`} habit={habit} />
              ))
            ) : (
              <EmptyState type="build" />
            )}
          </div>
        </section>

        {/* New Habit Button */}
        <div className="pt-4">
          <CreateHabitDialog />
        </div>
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
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
