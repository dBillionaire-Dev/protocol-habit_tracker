import { type HabitWithStatus } from "@shared/schema";
import { useLogHabitEvent, useConfirmCleanDay, useCompleteDaily, useDeleteHabit } from "@/hooks/use-habits";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, X, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
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
  
  // Handlers for Avoidance
  const logEventMutation = useLogHabitEvent();
  const confirmCleanMutation = useConfirmCleanDay();

  // Handlers for Build
  const completeMutation = useCompleteDaily();

  const today = format(new Date(), "yyyy-MM-dd");
  const isEndOfDay = new Date().getHours() >= 20; // Allow confirming clean day after 8 PM for UX, though server validates strictness if needed

  const handleDelete = () => {
    deleteMutation.mutate(habit.id);
  };

  if (habit.type === "avoidance") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn(
          "border-l-4 transition-all hover:shadow-lg",
          habit.debt && habit.debt > 0 ? "border-l-destructive shadow-destructive/5" : "border-l-emerald-500"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-bold tracking-tight">{habit.name}</CardTitle>
            <DeleteButton onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Current Debt</p>
                <div className={cn(
                  "text-4xl font-mono font-bold tracking-tighter",
                  habit.debt && habit.debt > 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {habit.debt || 0}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                {habit.debt && habit.debt > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Compromised
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Secure
                  </span>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full hover:bg-destructive hover:text-destructive-foreground border-destructive/20 text-destructive"
              onClick={() => logEventMutation.mutate({ id: habit.id })}
              disabled={logEventMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Failure
            </Button>
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => confirmCleanMutation.mutate({ id: habit.id, date: today })}
              disabled={confirmCleanMutation.isPending}
              title="Confirm clean day (usually evening)"
            >
              <Check className="w-4 h-4 mr-2" />
              Clean
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  // Build Habit Card
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "border-l-4 border-l-primary transition-all hover:shadow-lg",
        habit.todayCompleted && "opacity-75"
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-lg font-bold tracking-tight">{habit.name}</CardTitle>
          <DeleteButton onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Today's Protocol</p>
                <div className="text-3xl font-mono font-bold">
                  {habit.todayTask || habit.baseTaskValue} <span className="text-lg font-normal text-muted-foreground">{habit.unit}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Penalty Level</p>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  (habit.penaltyLevel || 0) > 0 ? "text-orange-500" : "text-muted-foreground"
                )}>
                  Lvl {habit.penaltyLevel || 0}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          {habit.todayCompleted ? (
            <Button 
              variant="secondary" 
              className="w-full cursor-default bg-primary/10 text-primary hover:bg-primary/10"
              disabled
            >
              <Check className="w-4 h-4 mr-2" />
              Completed for Today
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={() => completeMutation.mutate({ id: habit.id, date: today, completed: true })}
              disabled={completeMutation.isPending}
            >
              Execute Protocol
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
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
