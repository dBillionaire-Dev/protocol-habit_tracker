"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ProtocolSplash } from "@/components/protocol-splash";
import { useAuth } from "@/hooks/use-auth";

const SPLASH_SESSION_KEY = "protocol-splash-shown";

interface AppShellProps {
  children: React.ReactNode;
  /**
   * Optional override for app-readiness. By default this is derived
   * automatically from useAuth()'s isLoading, so you don't need to pass
   * anything -- the splash will wait for the real auth check on its own.
   * Only pass this explicitly if AppShell needs to wait on something
   * beyond auth too (e.g. a critical data fetch), in which case combine
   * them yourself: appReady={!isAuthLoading && !isCriticalDataLoading}.
   */
  appReady?: boolean;
}

export function AppShell({ children, appReady }: AppShellProps) {
  // Always start true so the very first client render matches the
  // server-rendered output exactly (server has no sessionStorage access
  // and would always produce "true" here). Reading sessionStorage
  // happens in an effect below, AFTER hydration -- never during the
  // initial render -- which avoids a server/client mismatch. Doing this
  // via useState(() => window-check) instead would only agree with the
  // server on a person's very first-ever visit; on any later visit in
  // the same tab (sessionStorage flag already set), the client's first
  // render would disagree with the server's, and React's hydration
  // mismatch recovery can blank the page or leave the tree half-mounted
  // -- which also breaks the splash's own timers.
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1") {
        setShowSplash(false);
      }
    } catch {
      // sessionStorage can throw in some locked-down/private-browsing
      // contexts -- fail open and just show the splash rather than crash.
    }
  }, []);

  const { isLoading: isAuthLoading } = useAuth();
  const resolvedAppReady = appReady !== undefined ? appReady : !isAuthLoading;

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      // Same as above -- if storage isn't available, the splash will
      // just play again next time, which is a harmless fallback.
    }
  }, []);

  return (
    <>
      {children}
      <AnimatePresence mode="wait">
        {showSplash && (
          <ProtocolSplash onComplete={handleSplashComplete} appReady={resolvedAppReady} />
        )}
      </AnimatePresence>
    </>
  );
}
