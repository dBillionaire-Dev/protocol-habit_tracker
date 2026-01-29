import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy, Calendar, TrendingUp, Shield } from "lucide-react";
import { type HabitWithStatus } from "@shared/schema";
import { format } from "date-fns";

interface StreakCardProps {
  habits: HabitWithStatus[];
}

export function StreakCard({ habits }: StreakCardProps) {
  const [selectedHabitId, setSelectedHabitId] = useState<string>(() => {
    return habits.length > 0 ? habits[0].id.toString() : "all";
  });
  
  if (habits.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Streaks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No habits to track yet.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedHabit = habits.find(h => h.id.toString() === selectedHabitId) || habits[0];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  const formatDateShort = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM d");
    } catch {
      return "N/A";
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Streaks</CardTitle>
        <Select value={selectedHabitId} onValueChange={setSelectedHabitId}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-streak-habit">
            <SelectValue placeholder="Select habit" />
          </SelectTrigger>
          <SelectContent>
            {habits.map(habit => (
              <SelectItem key={habit.id} value={habit.id.toString()}>
                {habit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <HabitStreakDetail habit={selectedHabit} formatDate={formatDate} formatDateShort={formatDateShort} />
      </CardContent>
    </Card>
  );
}

function HabitStreakDetail({ 
  habit, 
  formatDate, 
  formatDateShort 
}: { 
  habit: HabitWithStatus;
  formatDate: (d: string | null | undefined) => string;
  formatDateShort: (d: string | null | undefined) => string;
}) {
  return (
    <div className="space-y-3">
      {/* Habit Info */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{habit.name}</span>
        <Badge variant="outline" className="text-xs capitalize">
          {habit.type}
        </Badge>
      </div>

      {/* Current and Longest Streaks - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Streak */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono uppercase tracking-widest">Current</span>
          </div>
          <p className="text-3xl font-mono font-bold">{habit.currentStreak || 0}</p>
          <p className="text-xs text-muted-foreground">days</p>
          <p className="text-xs text-muted-foreground">
            {habit.currentStreak && habit.currentStreak > 0 && habit.currentStreakStart 
              ? `Since ${formatDateShort(habit.currentStreakStart)}`
              : "No active streak"
            }
          </p>
        </div>

        {/* Longest Streak */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-mono uppercase tracking-widest">Longest</span>
          </div>
          <p className="text-3xl font-mono font-bold">{habit.longestStreak || 0}</p>
          <p className="text-xs text-muted-foreground">days</p>
          <p className="text-xs text-muted-foreground">
            {habit.longestStreak && habit.longestStreak > 0 && habit.longestStreakStart
              ? `${formatDateShort(habit.longestStreakStart)} - ${habit.longestStreakEnd ? formatDate(habit.longestStreakEnd) : formatDate(habit.lastStreakDate)}`
              : "No streaks recorded"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
