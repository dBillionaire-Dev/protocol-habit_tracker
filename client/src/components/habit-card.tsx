"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Check, Plus, Minus, Trash2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { HabitWithStatus } from "shared/schema";
import {
  useLogHabitEvent,
  useConfirmCleanDay,
  useCompleteDaily,
  useDeleteHabit,
  useMarkMissed,
  useRepayDebt,
  ApiError,
} from "@/hooks/use-habits";
import { useConfirmationWindow } from "@/components/day-confirmation-card";

interface HabitCardProps {
  habit: HabitWithStatus;
}

// Simple [-] N [+] stepper matching the spec's mockups. Bounded to
// [1, max] — the "+" button disables itself at max rather than allowing
// an out-of-range value to ever be selectable.
function Stepper({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
      >
        <Minus className="w-4 h-4" />
      </Button>
      <span className="w-8 text-center font-mono font-bold text-lg">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function HabitCard({ habit }: HabitCardProps) {
  const deleteMutation = useDeleteHabit();
  const logEventMutation = useLogHabitEvent();
  const confirmCleanMutation = useConfirmCleanDay();
  const completeMutation = useCompleteDaily();
  const missedMutation = useMarkMissed();
  const repayDebtMutation = useRepayDebt();
  const { isWindowOpen } = useConfirmationWindow();

  const today = format(new Date(), "yyyy-MM-dd");

  const handleDelete = () => {
    deleteMutation.mutate(habit.id);
  };

  // --- Build-habit debt repayment state ---
  const remainingDebt = habit.remainingDebt ?? 0;
  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState(1);
  const [repayError, setRepayError] = useState<string | null>(null);

  // --- Today's-completion + optional repayment confirmation state ---
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [repayDuringComplete, setRepayDuringComplete] = useState<"no" | "yes">("no");
  const [completeRepayAmount, setCompleteRepayAmount] = useState(1);
  const [completeError, setCompleteError] = useState<string | null>(null);

  function openRepayDialog() {
    setRepayAmount(Math.min(1, remainingDebt) || 1);
    setRepayError(null);
    setRepayDialogOpen(true);
  }

  function confirmRepay() {
    repayDebtMutation.mutate(
      { id: habit.id, amount: repayAmount },
      {
        onSuccess: () => setRepayDialogOpen(false),
        onError: (err) => setRepayError(err instanceof ApiError ? err.message : "Something went wrong."),
      },
    );
  }

  function openCompleteDialog() {
    if (remainingDebt <= 0) {
      // No outstanding debt — nothing to ask about, complete immediately
      // exactly like before this feature existed.
      completeMutation.mutate({ id: habit.id, date: today, completed: true });
      return;
    }
    setRepayDuringComplete("no");
    setCompleteRepayAmount(1);
    setCompleteError(null);
    setCompleteDialogOpen(true);
  }

  function confirmComplete() {
    const debtRepayment = repayDuringComplete === "yes" ? completeRepayAmount : 0;
    completeMutation.mutate(
      { id: habit.id, date: today, completed: true, debtRepayment },
      {
        onSuccess: () => setCompleteDialogOpen(false),
        onError: (err) => setCompleteError(err instanceof ApiError ? err.message : "Something went wrong."),
      },
    );
  }

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

              <Button
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => logEventMutation.mutate({ id: habit.id })}
                disabled={logEventMutation.isPending}
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
    ? `Penalty stacked from ${habit.penaltyLevel} day${habit.penaltyLevel !== 1 ? "s" : ""} missed`
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
          {remainingDebt > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-3xl font-mono font-bold text-destructive">{remainingDebt}</span>
              <span className="text-xs text-muted-foreground">day{remainingDebt !== 1 ? "s" : ""} debt</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pb-3 space-y-2">
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

          {remainingDebt > 0 && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={openRepayDialog}
                disabled={repayDebtMutation.isPending}
                data-testid={`button-repay-debt-${habit.id}`}
              >
                Repay Debt
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0">
          {habit.todayCompleted ? (
            <div className="flex-1 bg-emerald-600 text-white rounded-md py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Completed
            </div>
          ) : habit.todayMissed ? (
            <div className="flex-1 bg-red-900/40 text-red-400 rounded-md py-2 px-4 text-center font-medium">
              Missed - penalty stacks tomorrow
            </div>
          ) : isWindowOpen ? (
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={openCompleteDialog}
                disabled={completeMutation.isPending}
              >
                Execute Protocol
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => missedMutation.mutate({ id: habit.id, date: today })}
                disabled={missedMutation.isPending}
              >
                Missed
              </Button>
            </div>
          ) : (
            <div className="flex-1 bg-muted text-muted-foreground rounded-md py-2 px-4 text-center font-medium">
              Window Closed
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Standalone debt repayment dialog — independent of today's completion */}
      <Dialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Repay Debt</DialogTitle>
            <DialogDescription>
              You currently have {remainingDebt} day{remainingDebt !== 1 ? "s" : ""} of outstanding debt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">How many missed days did you repay?</p>
              <Stepper value={repayAmount} onChange={setRepayAmount} max={remainingDebt} />
            </div>
            <p className="text-sm text-muted-foreground">
              This will reduce your outstanding debt to {Math.max(0, remainingDebt - repayAmount)} day{Math.max(0, remainingDebt - repayAmount) !== 1 ? "s" : ""}.
            </p>
            {repayError && <p className="text-sm text-destructive">{repayError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayDialogOpen(false)} disabled={repayDebtMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmRepay} disabled={repayDebtMutation.isPending || remainingDebt < 1}>
              {repayDebtMutation.isPending ? "Recording..." : "Confirm Repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Today's-completion dialog, shown only when there's outstanding
          debt — asks explicitly whether any of it was also repaid today.
          Completing today's requirement never implicitly repays debt. */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Complete Today's Protocol</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Today's requirement</p>
              <p className="text-lg font-mono font-bold">{habit.todayTask || habit.baseTaskValue} {habit.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding debt</p>
              <p className="text-lg font-mono font-bold text-destructive">{remainingDebt} day{remainingDebt !== 1 ? "s" : ""}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Did you repay any missed days today?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={repayDuringComplete === "no" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setRepayDuringComplete("no")}
                >
                  No
                </Button>
                <Button
                  type="button"
                  variant={repayDuringComplete === "yes" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setRepayDuringComplete("yes")}
                >
                  Yes
                </Button>
              </div>
            </div>

            {repayDuringComplete === "yes" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Days repaid</p>
                <Stepper value={completeRepayAmount} onChange={setCompleteRepayAmount} max={remainingDebt} />
              </div>
            )}

            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={completeMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmComplete} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function DeleteButton({ onDelete, isDeleting }: { onDelete: () => void; isDeleting: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
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
