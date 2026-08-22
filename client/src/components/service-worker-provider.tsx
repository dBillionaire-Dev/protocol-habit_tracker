"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Restoring intent that had been accidentally pasted into the middle
    // of sw.js's fetch handler instead of here (where it actually does
    // something) — the service worker's cache-first strategy fights
    // Next.js dev's own fast-refresh/stale-chunk behavior, causing
    // reload loops. Skip registering it in development entirely.
    if (process.env.NODE_ENV === "development") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  return <>{children}</>;
}
