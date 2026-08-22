"use client";

import { useEffect, useRef } from "react";
import { useConfirmationWindow } from "@/components/day-confirmation-card";
import { useNotificationPreferences } from "@/hooks/use-push-notifications";
import { isGuestMode } from "@/lib/api";

// Spec section 15: "trigger a notification when the user becomes
// eligible to confirm the relevant day," for whoever has the app OPEN
// right when the window opens (the closed-app case is covered
// separately by the server-side cron, api/cron/confirmation-window-push).
//
// MUST be mounted exactly ONCE, high in the tree (see LayoutShell) —
// NOT inside HabitCard or DayConfirmationCard themselves. Both of those
// already call the shared useConfirmationWindow() hook, and HabitCard
// renders once per habit; putting this effect inside either of them
// would fire one local notification per open habit card, directly
// violating "do not send duplicate notifications."
export function useConfirmationWindowForegroundNotify() {
  const { isWindowOpen } = useConfirmationWindow();
  const { data: prefs } = useNotificationPreferences();
  const wasOpenRef = useRef(isWindowOpen);
  // Guards against firing again on a page reload that happens to occur
  // while the window is already open — only the false->true EDGE should
  // notify, not "window is currently open" as a steady state.
  const notifiedTodayRef = useRef<string | null>(null);

  useEffect(() => {
    const justOpened = !wasOpenRef.current && isWindowOpen;
    wasOpenRef.current = isWindowOpen;
    if (!justOpened) return;
    if (isGuestMode()) return; // no preferences row to check for guests
    if (prefs && !prefs.confirmationWindowOpen) return;
    if (typeof window === "undefined" || Notification.permission !== "granted") return;

    const today = new Date().toISOString().split("T")[0];
    if (notifiedTodayRef.current === today) return;
    notifiedTodayRef.current = today;

    const fire = (registration?: ServiceWorkerRegistration) => {
      const title = "Your confirmation window is open";
      const options = {
        body: "Confirm today's clean days before the window closes at midnight.",
        icon: "/android-chrome-192x192.png",
        tag: "confirmation-window-open",
      };
      if (registration) {
        registration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(fire).catch(() => fire());
    } else {
      fire();
    }
  }, [isWindowOpen, prefs]);
}
