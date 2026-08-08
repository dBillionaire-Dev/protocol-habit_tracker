"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WindowState {
  isWindowOpen: boolean;
  timeUntilWindow: { hours: number; minutes: number; seconds: number } | null;
  timeRemaining: { hours: number; minutes: number; seconds: number } | null;
  lastCalculated: number;
}

function msToHMS(diffMs: number): { hours: number; minutes: number; seconds: number } {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function calculateWindowState(): WindowState {
  const now = new Date();
  const hours = now.getHours();

  // Window is 9:00 PM (21:00) through 12:00 AM (00:00) — a 3-hour span
  // covering hours 21, 22, and 23. (hours === 21) only matched the first
  // of those three hours, which is why the countdown used to stop working
  // correctly after 10 PM.
  const isWindowOpen = hours >= 21 && hours <= 23;

  let timeUntilWindow: WindowState["timeUntilWindow"] = null;
  let timeRemaining: WindowState["timeRemaining"] = null;

  if (isWindowOpen) {
    // Count down to the next midnight, not the next top-of-hour.
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    timeRemaining = msToHMS(midnight.getTime() - now.getTime());
  } else {
    // Count up to 9 PM today. Since isWindowOpen already covers hours
    // 21-23, every hour that reaches this branch (0-20) is before 9 PM
    // on the same day, so there's no midnight-wraparound case to handle.
    const windowStart = new Date(now);
    windowStart.setHours(21, 0, 0, 0);
    timeUntilWindow = msToHMS(windowStart.getTime() - now.getTime());
  }

  return {
    isWindowOpen,
    timeUntilWindow,
    timeRemaining,
    lastCalculated: Date.now(),
  };
}

export function useConfirmationWindow() {
  const [state, setState] = useState<WindowState>(() => calculateWindowState());

  const refresh = useCallback(() => {
    setState(calculateWindowState());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(calculateWindowState());
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setState(calculateWindowState());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { ...state, refresh };
}

interface DayConfirmationCardProps {
  onRefresh?: () => void;
  className?: string;
}

export function DayConfirmationCard({ onRefresh, className }: DayConfirmationCardProps) {
  const { isWindowOpen, timeUntilWindow, timeRemaining, refresh } = useConfirmationWindow();

  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  const formatTime = (time: { hours: number; minutes: number; seconds?: number } | null) => {
    if (!time) return "--:--";
    if (time.hours > 0) {
      return `${time.hours}h ${time.minutes}m`;
    }
    return `${time.minutes}m`;
  };

  return (
    <Card className={cn(
      "transition-all",
      isWindowOpen
        ? "border-emerald-500/50 bg-emerald-500/5"
        : "border-muted",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isWindowOpen ? "bg-emerald-500/10" : "bg-muted"
            )}>
              <Clock className={cn(
                "w-5 h-5",
                isWindowOpen ? "text-emerald-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="font-semibold text-sm">Day Confirmation</p>
              <p className="text-xs text-muted-foreground">Window: 09:00 PM - 12:00 AM</p>
            </div>
          </div>

          <div className="text-right">
            {isWindowOpen ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-emerald-500 font-mono font-bold text-lg">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-orange-500 font-mono font-bold text-lg">
                  In {formatTime(timeUntilWindow)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { calculateWindowState };
