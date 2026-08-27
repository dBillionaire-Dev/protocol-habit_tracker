"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AdminSplash } from "@/components/admin-splash";

// Separate session-storage key from AppShell's "protocol-splash-shown" —
// deliberately so a person visiting both the main app and /admin in the
// same browser session/tab sees BOTH splashes once each, rather than
// visiting one suppressing the other.
const SPLASH_SESSION_KEY = "protocol-admin-splash-shown";

interface AdminAppShellProps {
  children: React.ReactNode;
}

// No appReady/useAuth() plumbing here, unlike AppShell — app/admin/layout.tsx
// is an async Server Component that already calls requireAnyAdminPage()
// and redirects away before this ever mounts on the client, so by the
// time this renders, the page is already known-authorized. There's no
// equivalent client-side "still checking auth" state to wait on, so this
// just uses AdminSplash's default fixed-timer behavior (appReady=true).
export function AdminAppShell({ children }: AdminAppShellProps) {
  // Same reasoning as AppShell: always start true so the first client
  // render matches the server-rendered output exactly, and only read
  // sessionStorage after hydration, in an effect — see that file's
  // comment for why doing this any other way risks a hydration mismatch.
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
        {showSplash && <AdminSplash onComplete={handleSplashComplete} />}
      </AnimatePresence>
    </>
  );
}
