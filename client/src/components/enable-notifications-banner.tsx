"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationPermission, usePushSubscription } from "@/hooks/use-push-notifications";
import { isGuestMode } from "@/lib/api";

const DISMISS_KEY = "protocol:notif-banner-dismissed";
// Shown after a short delay rather than the instant the page mounts —
// spec section 13's "ask for permission at an appropriate time, not
// immediately on page load." This is a deliberately simple version of
// that: a few seconds into an actual dashboard session, not the literal
// first paint. A more elaborate "after their Nth habit completion"
// trigger could replace this later without changing anything else here.
const SHOW_DELAY_MS = 4000;

export function EnableNotificationsBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { permission, request } = useNotificationPermission();
  const { subscribe, isSubscribing } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isGuestMode()) return; // no account to subscribe against
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (dismissed || permission !== "default") return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dismissed, permission]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleEnable() {
    const result = await request();
    if (result === "granted") {
      subscribe();
      dismiss();
    } else if (result === "denied") {
      // Nothing more to do — browsers won't re-prompt after a denial,
      // and re-showing this banner every session would just be noise.
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-sm">
          Get notified the moment your confirmation window opens.{" "}
          <button onClick={onOpenSettings} className="underline underline-offset-2 hover:text-foreground">
            Manage in settings
          </button>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={handleEnable} disabled={isSubscribing}>
          Enable
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
