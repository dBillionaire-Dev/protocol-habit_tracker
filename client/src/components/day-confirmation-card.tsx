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

function calculateWindowState(): WindowState {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Window is 11:00 PM (23:00) to 12:00 AM (00:00)
  const isWindowOpen = hours === 23;

  let timeUntilWindow: { hours: number; minutes: number; seconds: number } | null = null;
  let timeRemaining: { hours: number; minutes: number; seconds: number } | null = null;

  if (isWindowOpen) {
    const remainingMinutes = 59 - minutes;
    const remainingSeconds = 59 - seconds;
    timeRemaining = {
      hours: 0,
      minutes: remainingMinutes,
      seconds: remainingSeconds,
    };
  } else {
    let hoursUntil = 23 - hours;
    let minutesUntil = 60 - minutes;
    let secondsUntil = 60 - seconds;

    if (minutesUntil === 60) {
      minutesUntil = 0;
    } else {
      hoursUntil -= 1;
    }
    if (secondsUntil === 60) {
      secondsUntil = 0;
    } else if (minutesUntil > 0) {
      minutesUntil -= 1;
    }

    if (hoursUntil < 0) {
      hoursUntil += 24;
    }

    timeUntilWindow = {
      hours: hoursUntil,
      minutes: minutesUntil,
      seconds: secondsUntil,
    };
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
              <p className="text-xs text-muted-foreground">Window: 11:00 PM - 12:00 AM</p>
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
