import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Trophy, Calendar, TrendingUp, Shield } from "lucide-react";
import { type HabitWithStatus } from "@shared/schema";
import { format } from "date-fns";

interface StreakCardProps {
  habits: HabitWithStatus[];
}

export function StreakCard({ habits }: StreakCardProps) {
  const [selectedHabitId, setSelectedHabitId] = useState<string>("all");
  
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

  const selectedHabit = selectedHabitId === "all" 
    ? null 
    : habits.find(h => h.id.toString() === selectedHabitId);

  // Calculate aggregate stats for "all"
  const totalCurrentStreak = habits.reduce((sum, h) => sum + (h.currentStreak || 0), 0);
  const maxLongestStreak = Math.max(...habits.map(h => h.longestStreak || 0), 0);
  const habitWithLongest = habits.find(h => h.longestStreak === maxLongestStreak);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
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
            <SelectItem value="all">All Habits</SelectItem>
            {habits.map(habit => (
              <SelectItem key={habit.id} value={habit.id.toString()}>
                {habit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {selectedHabit ? (
          <HabitStreakDetail habit={selectedHabit} />
        ) : (
          <AllHabitsStreak 
            totalCurrentStreak={totalCurrentStreak} 
            maxLongestStreak={maxLongestStreak}
            habitWithLongest={habitWithLongest}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AllHabitsStreak({ 
  totalCurrentStreak, 
  maxLongestStreak, 
  habitWithLongest 
}: { 
  totalCurrentStreak: number;
  maxLongestStreak: number;
  habitWithLongest?: HabitWithStatus;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Current</p>
          <p className="text-3xl font-mono font-bold">{totalCurrentStreak}</p>
          <p className="text-xs text-muted-foreground">total days</p>
        </div>
      </div>
      
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/10">
          <Trophy className="w-5 h-5 text-yellow-500" />
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Longest</p>
          <p className="text-3xl font-mono font-bold">{maxLongestStreak}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[100px]">
            {habitWithLongest?.name || "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}

function HabitStreakDetail({ habit }: { habit: HabitWithStatus }) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  const TypeIcon = habit.type === "build" ? TrendingUp : Shield;
  const typeColor = habit.type === "build" ? "text-primary" : "text-destructive";
  const typeBg = habit.type === "build" ? "bg-primary/10" : "bg-destructive/10";

  return (
    <div className="space-y-4">
      {/* Habit Info */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
        <div className={`p-1.5 rounded-md ${typeBg}`}>
          <TypeIcon className={`w-4 h-4 ${typeColor}`} />
        </div>
        <div>
          <p className="font-semibold text-sm">{habit.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{habit.type}</p>
        </div>
      </div>

      {/* Current Streak */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Current Streak</p>
          <p className="text-2xl font-mono font-bold">{habit.currentStreak || 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          {habit.currentStreak && habit.currentStreak > 0 && habit.currentStreakStart ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              {formatDate(habit.currentStreakStart)} - Present
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No active streak</p>
          )}
        </div>
      </div>

      {/* Longest Streak */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/10">
          <Trophy className="w-5 h-5 text-yellow-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Longest Streak</p>
          <p className="text-2xl font-mono font-bold">{habit.longestStreak || 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          {habit.longestStreak && habit.longestStreak > 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              {formatDate(habit.longestStreakStart)}
              {habit.longestStreakEnd ? ` - ${formatDate(habit.longestStreakEnd)}` : " - Present"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No streaks recorded</p>
          )}
        </div>
      </div>
    </div>
  );
}
