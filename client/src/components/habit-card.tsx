"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Check, Plus, Trash2, Flame, Pencil, UserPlus } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import type { HabitWithStatus } from "shared/schema";
import { FREE_PLAN_HABIT_EDIT_WINDOW_MS } from "shared/schema";
import {
  useLogHabitEvent,
  useConfirmCleanDay,
  useCompleteDaily,
  useDeleteHabit,
  useUpdateHabit,
  useMarkMissed,
  ApiError,
} from "@/hooks/use-habits";
import { useBillingStatus } from "@/hooks/use-billing";
import { hasFeature } from "@/lib/entitlements";
import { useInvitePartner } from "@/hooks/use-partnerships";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmationWindow } from "@/components/day-confirmation-card";

interface HabitCardProps {
  habit: HabitWithStatus;
}

export function HabitCard({ habit }: HabitCardProps) {
  const deleteMutation = useDeleteHabit();
  const updateMutation = useUpdateHabit();
  const logEventMutation = useLogHabitEvent();
  const confirmCleanMutation = useConfirmCleanDay();
  const completeMutation = useCompleteDaily();
  const missedMutation = useMarkMissed();
  const { isWindowOpen } = useConfirmationWindow();
  const { data: billing } = useBillingStatus();

  const today = format(new Date(), "yyyy-MM-dd");

  const handleDelete = () => {
    deleteMutation.mutate(habit.id);
  };

  // --- Habit editing: Free plan can only edit within 20 minutes of
  // creation (server-enforced — see PATCH /api/habits/:id); Pro/Premium
  // Plus can edit anytime. This is just the UI-side mirror of that rule
  // for showing/disabling the button; the actual enforcement lives
  // server-side regardless of what this computes. ---
  const canEditAnytime = hasFeature(billing?.plan ?? "free", "unrestricted_habit_editing");
  const editDeadlineMs = new Date(habit.createdAt).getTime() + FREE_PLAN_HABIT_EDIT_WINDOW_MS;
  const isWithinEditWindow = Date.now() < editDeadlineMs;
  const canEdit = canEditAnytime || isWithinEditWindow;

  // --- Premium Flexible Day Confirmation: Premium Plus bypasses the
  // normal 9PM-midnight confirmation window entirely (server-enforced —
  // see api/habits/[id]/clean-day/route.ts). This is the UI-side mirror
  // for the Avoidance "Confirm Clean Day" action specifically; Build's
  // "Execute Protocol" window isn't covered by this pass — see delivery
  // notes. ---
  const canConfirmAnytime = hasFeature(billing?.plan ?? "free", "flexible_confirmation");
  const canConfirmCleanDay = isWindowOpen || canConfirmAnytime;
  const [confirmCleanError, setConfirmCleanError] = useState<string | null>(null);
  const [missedError, setMissedError] = useState<string | null>(null);

  // --- Streak Partners (Build only, spec section 18) ---
  const canInvitePartner = hasFeature(billing?.plan ?? "free", "streak_partners");
  const invitePartnerMutation = useInvitePartner();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invitePartnerEmail, setInvitePartnerEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  function submitInvite() {
    setInviteError(null);
    invitePartnerMutation.mutate(
      { habitId: habit.id, partnerEmail: invitePartnerEmail },
      {
        onSuccess: () => {
          setInviteDialogOpen(false);
          setInvitePartnerEmail("");
          toast({ title: "✓ Invite sent", description: "They'll see it next time they check their Streak Partners page." });
        },
        onError: (err) => setInviteError(err instanceof Error ? err.message : "Something went wrong."),
      },
    );
  }

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(habit.name);
  const [editBaseTaskValue, setEditBaseTaskValue] = useState(String(habit.baseTaskValue ?? ""));
  const [editUnit, setEditUnit] = useState(habit.unit ?? "");
  const [editError, setEditError] = useState<string | null>(null);

  function openEditDialog() {
    setEditName(habit.name);
    setEditBaseTaskValue(String(habit.baseTaskValue ?? ""));
    setEditUnit(habit.unit ?? "");
    setEditError(null);
    setEditDialogOpen(true);
  }

  function confirmEdit() {
    const updates: { name?: string; baseTaskValue?: number; unit?: string } = {
      name: editName.trim(),
    };
    if (habit.type === "build") {
      const parsed = Number(editBaseTaskValue);
      if (!Number.isNaN(parsed)) updates.baseTaskValue = parsed;
      updates.unit = editUnit.trim();
    }
    updateMutation.mutate(
      { id: habit.id, updates },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          toast({ title: "✓ Protocol updated" });
        },
        onError: (err) => setEditError(err instanceof ApiError ? err.message : "Something went wrong."),
      },
    );
  }

  // --- Build-habit debt display + today's-completion entry ---
  // remainingDebt is now raw units (e.g. pushups), not whole days — see
  // shared/schema.ts's outstandingDebtUnits comment for the full model.
  const remainingDebt = habit.remainingDebt ?? 0;
  const todayTask = habit.todayTask || habit.baseTaskValue || 0;

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  // Controlled as a string so the field can be genuinely empty while
  // typing (e.g. clearing "120" to type "80") without fighting a
  // number input's own coercion; parsed back to a number on submit.
  const [completedValueInput, setCompletedValueInput] = useState(String(todayTask));
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Extra guard against a typo (e.g. an accidental trailing zero) —
  // anything entered above todayTask has no effect beyond it (the
  // surplus is just discarded, there's no "banked credit" for future
  // days), so it's the one input value that's more likely to be a
  // mistake than a real number worth acting on without a second look.
  const [overageConfirmOpen, setOverageConfirmOpen] = useState(false);

  const parsedCompletedValue = Number(completedValueInput);
  const isValidCompletedValue =
    completedValueInput.trim() !== "" &&
    Number.isInteger(parsedCompletedValue) &&
    parsedCompletedValue >= 0;
  const projectedRemainingDebt = isValidCompletedValue
    ? Math.max(0, todayTask - parsedCompletedValue)
    : todayTask;
  const exceedsTodayTask = isValidCompletedValue && parsedCompletedValue > todayTask;

  function openCompleteDialog() {
    if (remainingDebt <= 0) {
      // No outstanding debt — nothing to ask about. Complete instantly
      // at exactly today's own base requirement, same low-friction
      // single-click flow as before this feature existed.
      completeMutation.mutate(
        { id: habit.id, date: today, completedValue: habit.baseTaskValue || 0 },
        {
          onSuccess: (data) => {
            if ("queuedOffline" in data) {
              toast({ title: "Saved offline", description: "This will sync automatically once you're back online." });
            }
          },
        },
      );
      return;
    }
    // Pre-filled to the full catch-up amount (today's own base PLUS all
    // outstanding debt) -- editable down to whatever was actually done,
    // e.g. 80 out of 120. Nothing is submitted until they confirm.
    setCompletedValueInput(String(todayTask));
    setCompleteError(null);
    setCompleteDialogOpen(true);
  }

  // What the main dialog's "Confirm" button actually calls. Splits out
  // from the real submission (submitComplete) so a value over todayTask
  // routes through one extra "are you sure" step instead of submitting
  // immediately.
  function handleConfirmClick() {
    if (!isValidCompletedValue) {
      setCompleteError("Enter a whole number of 0 or more.");
      return;
    }
    if (exceedsTodayTask) {
      setOverageConfirmOpen(true);
      return;
    }
    submitComplete();
  }

  function submitComplete() {
    completeMutation.mutate(
      { id: habit.id, date: today, completedValue: parsedCompletedValue },
      {
        onSuccess: (data) => {
          setOverageConfirmOpen(false);
          setCompleteDialogOpen(false);
          if ("queuedOffline" in data) {
            // Queued locally, not confirmed by the server yet — do NOT
            // read data.debtSummary here, it doesn't exist on this
            // shape. See QueuedLocally in use-habits.ts.
            toast({ title: "Saved offline", description: "This will sync automatically once you're back online." });
            return;
          }
          const remaining = data.debtSummary.outstandingDebtUnits;
          if (remaining > 0) {
            toast({
              title: parsedCompletedValue >= (habit.baseTaskValue || 0) ? "✓ Protocol executed" : "Logged — today's own target wasn't fully met",
              description: `${remaining} ${habit.unit || "unit"}${remaining !== 1 ? "s" : ""} carried forward to tomorrow.`,
            });
          } else if (todayTask > (habit.baseTaskValue || 0)) {
            toast({ title: "✓ Fully caught up", description: "All outstanding debt cleared." });
          }
        },
        onError: (err) => {
          setOverageConfirmOpen(false);
          setCompleteError(err instanceof ApiError ? err.message : "Something went wrong.");
        },
      },
    );
  }

  if (habit.type === "avoidance") {
    const todayEvents = habit.todayEvents || 0;
    const isClean = todayEvents === 0;
    const isConfirmed = habit.todayConfirmed;

    return (
      <>
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
              <EditButton onEdit={openEditDialog} canEdit={canEdit} canEditAnytime={canEditAnytime} />
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
              <div className="flex-1 space-y-1.5">
                <Button
                  className={cn(
                    "w-full",
                    canConfirmCleanDay && isClean
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  onClick={() => {
                    setConfirmCleanError(null);
                    confirmCleanMutation.mutate(
                      { id: habit.id, date: today },
                      {
                        onSuccess: (data) => {
                          if ("queuedOffline" in data) {
                            toast({ title: "Saved offline", description: "This will sync automatically once you're back online." });
                          }
                        },
                        onError: (err) => setConfirmCleanError(err instanceof ApiError ? err.message : "Something went wrong."),
                      },
                    );
                  }}
                  disabled={!canConfirmCleanDay || confirmCleanMutation.isPending || !isClean}
                >
                  {canConfirmCleanDay
                    ? (isClean ? "Confirm Clean Day" : "Has Events Today")
                    : "Window Closed"}
                </Button>
                {canConfirmAnytime && !isWindowOpen && (
                  <p className="text-[11px] text-amber-500 text-center">
                    Premium Plus: confirm anytime, not just 9PM–midnight
                  </p>
                )}
                {confirmCleanError && (
                  <p className="text-xs text-destructive text-center">{confirmCleanError}</p>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </motion.div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Protocol</DialogTitle>
            {!canEditAnytime && (
              <DialogDescription>
                Free plan protocols can only be edited within 20 minutes of creation.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-name-${habit.id}`}>Name</Label>
              <Input
                id={`edit-name-${habit.id}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmEdit} disabled={updateMutation.isPending || !editName.trim()}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
              <p className="text-xs text-muted-foreground">
                Build
                {habit.scheduledDays && habit.scheduledDays.length > 0 && habit.scheduledDays.length < 7 && (
                  <span> · {formatScheduleDays(habit.scheduledDays)}</span>
                )}
              </p>
            </div>
            <DeleteButton onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
            <EditButton onEdit={openEditDialog} canEdit={canEdit} canEditAnytime={canEditAnytime} />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => setInviteDialogOpen(true)}
              disabled={!canInvitePartner}
              title={canInvitePartner ? "Invite a streak partner" : "Streak Partners is a Pro and Premium Plus feature"}
            >
              <UserPlus className="w-3 h-3" />
            </Button>
          </div>
          {remainingDebt > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-3xl font-mono font-bold text-destructive">{remainingDebt}</span>
              <span className="text-xs text-muted-foreground">{habit.unit || "units"} owed</span>
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
          ) : habit.todayIsRestDay ? (
            <div className="flex-1 bg-muted/50 text-muted-foreground rounded-md py-2 px-4 text-center font-medium">
              Rest day — not scheduled today
            </div>
          ) : canConfirmCleanDay ? (
            <div className="flex-1 space-y-1.5">
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
                  onClick={() => {
                    setMissedError(null);
                    missedMutation.mutate(
                      { id: habit.id, date: today },
                      {
                        onSuccess: (data) => {
                          if ("queuedOffline" in data) {
                            toast({ title: "Saved offline", description: "This will sync automatically once you're back online." });
                          }
                        },
                        onError: (err) => setMissedError(err instanceof ApiError ? err.message : "Something went wrong."),
                      },
                    );
                  }}
                  disabled={missedMutation.isPending}
                >
                  Missed
                </Button>
              </div>
              {canConfirmAnytime && !isWindowOpen && (
                <p className="text-[11px] text-amber-500 text-center">
                  Premium Plus: confirm anytime, not just 9PM–midnight
                </p>
              )}
              {missedError && (
                <p className="text-xs text-destructive text-center">{missedError}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-muted text-muted-foreground rounded-md py-2 px-4 text-center font-medium">
              Window Closed
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Today's-completion dialog, shown only when there's outstanding
          debt. Single input: how much was actually done today, in raw
          units — e.g. "80" pushups. Pre-filled to the full catch-up
          amount (todayTask), editable down. Whether today itself counts
          as done, and how much of the debt clears, are both derived
          server-side from this one number — see storage.completeDailyTask. */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Execute Protocol</DialogTitle>
            <DialogDescription>
              You have {remainingDebt} {habit.unit || "units"} of debt piled up. Today's full
              requirement (today's own {habit.baseTaskValue} {habit.unit} plus what's owed) is{" "}
              {todayTask} {habit.unit}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`completed-value-${habit.id}`}>How much did you actually do today?</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`completed-value-${habit.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={completedValueInput}
                  onChange={(e) => setCompletedValueInput(e.target.value)}
                  className="font-mono"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground shrink-0">{habit.unit || "units"}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {!isValidCompletedValue
                ? "Enter a whole number of 0 or more."
                : projectedRemainingDebt > 0
                  ? `This leaves ${projectedRemainingDebt} ${habit.unit || "units"} carried forward to tomorrow.`
                  : "This fully clears your outstanding debt."}
            </p>

            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={completeMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirmClick} disabled={completeMutation.isPending || !isValidCompletedValue}>
              {completeMutation.isPending ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extra "are you sure" step, only when the entered value exceeds
          todayTask — the one input more likely to be a typo (an extra
          zero, etc.) than a real number worth acting on unconfirmed,
          since anything beyond todayTask has no effect: it's just
          discarded, not banked as credit toward future days. */}
      <AlertDialog open={overageConfirmOpen} onOpenChange={setOverageConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>That's more than was needed — just checking</AlertDialogTitle>
            <AlertDialogDescription>
              You entered {parsedCompletedValue} {habit.unit || "units"}, but only {todayTask}{" "}
              {habit.unit || "units"} was needed to fully clear today's requirement and all
              outstanding debt. Anything above that isn't banked for future days — it's simply not
              counted. Is {parsedCompletedValue} correct?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending}>
              Let me fix it
            </AlertDialogCancel>
            <AlertDialogAction onClick={submitComplete} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? "Confirming..." : "Yes, that's correct"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Protocol</DialogTitle>
            {!canEditAnytime && (
              <DialogDescription>
                Free plan protocols can only be edited within 20 minutes of creation.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-name-${habit.id}`}>Name</Label>
              <Input
                id={`edit-name-${habit.id}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`edit-value-${habit.id}`}>Daily target</Label>
                <Input
                  id={`edit-value-${habit.id}`}
                  type="number"
                  value={editBaseTaskValue}
                  onChange={(e) => setEditBaseTaskValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-unit-${habit.id}`}>Unit</Label>
                <Input
                  id={`edit-unit-${habit.id}`}
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                />
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmEdit} disabled={updateMutation.isPending || !editName.trim()}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) setInviteError(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Invite a streak partner</DialogTitle>
            <DialogDescription>
              They'll need an existing Protocol account. Once they accept, your shared streak only
              grows on days you BOTH complete this protocol — your own streak and history stay
              entirely separate either way.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`invite-email-${habit.id}`}>Their email</Label>
              <Input
                id={`invite-email-${habit.id}`}
                type="email"
                placeholder="partner@example.com"
                value={invitePartnerEmail}
                onChange={(e) => setInvitePartnerEmail(e.target.value)}
              />
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={invitePartnerMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitInvite} disabled={invitePartnerMutation.isPending || !invitePartnerEmail.trim()}>
              {invitePartnerMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function EditButton({ onEdit, canEdit, canEditAnytime }: { onEdit: () => void; canEdit: boolean; canEditAnytime: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
      onClick={onEdit}
      disabled={!canEdit}
      title={
        canEdit
          ? "Edit protocol"
          : "Free plan protocols can only be edited within 20 minutes of creation. Upgrade to Pro or Premium Plus to edit anytime."
      }
    >
      <Pencil className="w-3 h-3" />
    </Button>
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

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatScheduleDays(days: number[]): string {
  const sorted = [...days].sort();
  // Common case: a single contiguous run (e.g. Mon-Fri) — show as a range.
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isContiguous && sorted.length > 1) {
    return `${SHORT_DAY_NAMES[sorted[0]]}-${SHORT_DAY_NAMES[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => SHORT_DAY_NAMES[d]).join(", ");
}
