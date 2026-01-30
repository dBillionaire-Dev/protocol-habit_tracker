import { type HabitWithStatus } from "@shared/schema";
import { useLogHabitEvent, useConfirmCleanDay, useCompleteDaily, useDeleteHabit, useMarkMissed } from "@/hooks/use-habits";
import { useConfirmationWindow } from "@/components/day-confirmation-card";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, Plus, Trash2, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

interface HabitCardProps {
  habit: HabitWithStatus;
}

export function HabitCard({ habit }: HabitCardProps) {
  const deleteMutation = useDeleteHabit();
  const logEventMutation = useLogHabitEvent();
  const confirmCleanMutation = useConfirmCleanDay();
  const completeMutation = useCompleteDaily();
  const missedMutation = useMarkMissed();
  const { isWindowOpen } = useConfirmationWindow();

  const today = format(new Date(), "yyyy-MM-dd");

  const handleDelete = () => {
    deleteMutation.mutate(habit.id);
  };

  if (habit.type === "avoidance") {
    const todayEvents = habit.todayEvents || 0;
    const isClean = todayEvents === 0;
    const isConfirmed = habit.todayConfirmed;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn(
          "transition-all",
          habit.debt && habit.debt > 0 ? "border-destructive/30" : "border-border"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle className="text-base font-bold tracking-tight">{habit.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Avoidance</p>
              </div>
              <DeleteButton onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
            </div>
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-3xl font-mono font-bold",
                habit.debt && habit.debt > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {habit.debt || 0}
              </span>
              <span className="text-xs text-muted-foreground">debt</span>
            </div>
          </CardHeader>
          <CardContent className="pb-3 space-y-3">
            {/* Streak display for avoidance habits */}
            {habit.currentStreak && habit.currentStreak > 0 ? (
              <div className="flex items-center gap-1.5 text-orange-500">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-medium">{habit.currentStreak} day streak</span>
              </div>
            ) : null}
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Today</p>
                {isClean ? (
                  <span className="text-emerald-500 font-medium text-sm">Clean</span>
                ) : (
                  <span className="text-orange-500 font-medium text-sm">{todayEvents} event{todayEvents !== 1 ? 's' : ''}</span>
                )}
              </div>
              
              {/* Log Event Button (+) - always visible */}
              <Button 
                variant="outline" 
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => logEventMutation.mutate({ id: habit.id })}
                disabled={logEventMutation.isPending}
                data-testid={`button-log-event-${habit.id}`}
              >
                <Plus className="w-4 h-4 mr-1" />
                Log
              </Button>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            {isConfirmed ? (
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
                disabled
              >
                <Check className="w-4 h-4 mr-2" />
                Clean day confirmed
              </Button>
            ) : (
              <Button 
                className={cn(
                  "flex-1",
                  isWindowOpen && isClean
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                onClick={() => confirmCleanMutation.mutate({ id: habit.id, date: today })}
                disabled={!isWindowOpen || confirmCleanMutation.isPending || !isClean}
                data-testid={`button-clean-${habit.id}`}
              >
                {isWindowOpen ? (isClean ? "Confirm Clean Day" : "Has Events Today") : "Window Closed"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  // Build Habit Card
  const penaltyText = habit.penaltyLevel && habit.penaltyLevel > 0 
    ? `Penalty stacked from ${habit.baseTaskValue} base` 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-base font-bold tracking-tight">{habit.name}</CardTitle>
              <p className="text-xs text-muted-foreground">Build</p>
            </div>
            <DeleteButton onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
          </div>
        </CardHeader>
        <CardContent className="pb-3 space-y-2">
          {/* Streak display */}
          {habit.currentStreak && habit.currentStreak > 0 ? (
            <div className="flex items-center gap-1.5 text-orange-500">
              <Flame className="w-4 h-4" />
              <span className="text-sm font-medium">{habit.currentStreak} day streak</span>
            </div>
          ) : null}

          <div>
            <p className="text-xs text-muted-foreground mb-1">Today's requirement</p>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-mono font-bold",
                habit.penaltyLevel && habit.penaltyLevel > 0 ? "text-orange-500" : ""
              )}>
                {habit.todayTask || habit.baseTaskValue}
              </span>
              <span className="text-sm text-muted-foreground">{habit.unit}</span>
            </div>
            {penaltyText && (
              <p className="text-xs text-orange-500 mt-1">{penaltyText}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          {habit.todayCompleted ? (
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
              disabled
            >
              <Check className="w-4 h-4 mr-2" />
              Completed
            </Button>
          ) : habit.todayMissed ? (
            <Button 
              className="flex-1 bg-red-900/40 hover:bg-red-900/40 text-red-400 cursor-default border-0"
              disabled
            >
              Missed - penalty stacks tomorrow
            </Button>
          ) : isWindowOpen ? (
            <div className="flex gap-2 w-full">
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => completeMutation.mutate({ id: habit.id, date: today, completed: true })}
                disabled={completeMutation.isPending}
                data-testid={`button-complete-${habit.id}`}
              >
                <Check className="w-4 h-4 mr-2" />
                Done
              </Button>
              <Button 
                variant="outline"
                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => missedMutation.mutate({ id: habit.id, date: today })}
                disabled={missedMutation.isPending}
                data-testid={`button-missed-${habit.id}`}
              >
                <X className="w-4 h-4 mr-2" />
                Missed
              </Button>
            </div>
          ) : (
            <Button 
              className="flex-1 bg-muted text-muted-foreground cursor-not-allowed"
              disabled
            >
              Window Closed
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function DeleteButton({ onDelete, isDeleting }: { onDelete: () => void, isDeleting: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" data-testid="button-delete-habit">
          <Trash2 className="w-3 h-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Protocol?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this habit and all its history. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
