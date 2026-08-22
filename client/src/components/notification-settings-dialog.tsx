"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPermission,
  usePushSubscription,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-push-notifications";
import type { NotificationCategory } from "shared/schema";

const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  habitReminders: {
    label: "Habit reminders",
    description: "Nudges for protocols you haven't logged yet today.",
  },
  confirmationWindowOpen: {
    label: "Confirmation window opening",
    description: "The moment your 9PM-midnight confirmation window opens.",
  },
  confirmationWindowReminder: {
    label: "Confirmation window reminders",
    description: "A reminder if the window is open and you haven't confirmed yet.",
  },
  trialEnding: {
    label: "Trial ending",
    description: "When a Pro or Premium Plus trial is about to expire.",
  },
  subscriptionReminders: {
    label: "Subscription reminders",
    description: "Renewal and billing-related updates.",
  },
  streakReminders: {
    label: "Streak reminders",
    description: "Heads up before a long streak is at risk.",
  },
  importantAnnouncements: {
    label: "Important Protocol updates",
    description: "Rare, significant announcements about the app itself.",
  },
};

// Spec section 13: "allow users to manage notification preferences."
// Every category here has a real, working toggle — but only
// confirmationWindowOpen currently has a wired server-side trigger (see
// api/cron/confirmation-window-push). habitReminders, trialEnding
// (trial reminders currently go out over EMAIL via Resend, not push —
// see lib/trial-reminders.ts), subscriptionReminders, and
// streakReminders are flagged in the UI as "coming soon" rather than
// silently implying they already do something when toggled.
const WIRED_CATEGORIES: readonly NotificationCategory[] = ["confirmationWindowOpen"];

export function NotificationSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { permission, request } = useNotificationPermission();
  const { isSubscribed, isChecked, subscribe, isSubscribing, subscribeError, unsubscribe, isUnsubscribing } = usePushSubscription();
  const { data: prefs } = useNotificationPreferences();
  const { mutate: updatePrefs, isPending: isUpdatingPrefs } = useUpdateNotificationPreferences();

  async function handleEnable() {
    const result = await request();
    if (result === "granted") subscribe();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </DialogTitle>
          <DialogDescription>
            Get nudged the moment your confirmation window opens, so a missed day never sneaks
            past you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {permission === "unsupported" && (
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support push notifications.
            </p>
          )}

          {permission === "denied" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                <BellOff className="w-4 h-4" />
                Notifications are blocked
              </div>
              You've blocked notifications for Protocol in your browser. Re-enable them from your
              browser's site settings to turn this back on — we can't re-prompt you directly.
            </div>
          )}

          {permission === "default" && (
            <Button className="w-full" onClick={handleEnable} disabled={isSubscribing}>
              {isSubscribing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
              Enable Notifications
            </Button>
          )}

          {permission === "granted" && isChecked && !isSubscribed && (
            <Button className="w-full" onClick={() => subscribe()} disabled={isSubscribing}>
              {isSubscribing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
              Turn On Push Notifications
            </Button>
          )}
          {subscribeError && (
            <p className="text-sm text-destructive">
              {subscribeError instanceof Error ? subscribeError.message : "Something went wrong."}
            </p>
          )}

          {permission === "granted" && isSubscribed && (
            <>
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <span className="text-sm text-emerald-500 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Push notifications on
                </span>
                <Button variant="ghost" size="sm" onClick={() => unsubscribe()} disabled={isUnsubscribing}>
                  {isUnsubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Turn off"}
                </Button>
              </div>

              <div className="space-y-3 pt-2">
                {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => {
                  const isWired = WIRED_CATEGORIES.includes(category);
                  const { label, description } = CATEGORY_LABELS[category];
                  return (
                    <div key={category} className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-sm font-normal flex items-center gap-2">
                          {label}
                          {!isWired && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">
                              Coming soon
                            </span>
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        checked={prefs?.[category] ?? true}
                        disabled={isUpdatingPrefs || !isWired}
                        onCheckedChange={(checked) => updatePrefs({ [category]: checked })}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
