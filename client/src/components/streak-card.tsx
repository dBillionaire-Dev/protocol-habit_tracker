import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy } from "lucide-react";
import { type HabitWithStatus } from "@shared/schema";

interface StreakCardProps {
  habits: HabitWithStatus[];
}

export function StreakCard({ habits }: StreakCardProps) {
  // Calculate overall streaks from all habits
  const totalCurrentStreak = habits.reduce((sum, h) => sum + (h.currentStreak || 0), 0);
  const maxLongestStreak = Math.max(...habits.map(h => h.longestStreak || 0), 0);
  
  // Find the habit with the longest current streak for display
  const bestHabit = habits.reduce((best, h) => 
    (h.currentStreak || 0) > (best?.currentStreak || 0) ? h : best
  , habits[0]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Streaks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Current</p>
              <p className="text-3xl font-mono font-bold">{totalCurrentStreak}</p>
              <p className="text-xs text-muted-foreground">days</p>
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
                {bestHabit?.name || "No habits"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
