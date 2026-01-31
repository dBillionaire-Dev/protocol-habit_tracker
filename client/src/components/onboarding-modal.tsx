import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OnboardingModalProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to the Habit Protocol System</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            <p className="text-muted-foreground">
              This app is built to enforce discipline, not just track habits.
              Everything works on <strong>protocols, streaks, debt, and daily confirmation windows</strong>.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Habit Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-primary">1. Building Habits</h4>
                  <p className="text-muted-foreground mb-2">
                    These are habits you must actively do. Examples: studying, coding, exercising.
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>You must execute the habit's protocol within its time window</li>
                    <li>Executing a protocol: Increases your streak, reduces any existing debt</li>
                    <li>Missing a protocol: Breaks the streak, increases debt</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-destructive">2. Avoidance Habits</h4>
                  <p className="text-muted-foreground mb-2">
                    These are habits you must avoid completely. Examples: no junk food, no gambling, no porn.
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>You do not log actions for these habits</li>
                    <li>If you avoid the habit for the entire day: The day is confirmed as a <strong>Clean Day</strong>, your streak increases</li>
                    <li>If you perform the habit: The streak breaks immediately, debt increases</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Day Confirmation Window</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Every day has a <strong>confirmation window</strong>.</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>When the window is open: You will see "Window Open" with a countdown timer</li>
                  <li>During this time: Building habits are confirmed as completed, Avoidance habits are confirmed as clean days</li>
                </ul>
                <p className="text-orange-500">Missing the confirmation window may affect your streak and debt.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Streak System</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Each habit has its <strong>own streak</strong></li>
                  <li>Streaks are habit-specific and independent of other habits</li>
                  <li>Longest streaks are stored permanently and do not reset when you break a streak</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Debt System</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Debt represents missed responsibility.</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Debt increases when: A protocol is missed, or an avoidance habit is violated</li>
                  <li>Debt decreases when: Protocols are executed, or clean days are confirmed</li>
                </ul>
                <p className="mt-2">Debt is tracked <strong>per habit</strong>, not globally.</p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 text-sm">
                <p className="font-medium">
                  This app rewards <strong>consistency</strong>, not perfection.
                  The goal is accountability, awareness, and long-term discipline.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              data-testid="checkbox-dont-show"
            />
            <label
              htmlFor="dont-show"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Don't show this again
            </label>
          </div>
          <Button onClick={handleClose} data-testid="button-understand">
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
