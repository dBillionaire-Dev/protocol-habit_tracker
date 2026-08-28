#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# PROTOCOL — Admin PWA install prompt
#
# Built directly against the protocol-habit_tracker-main.zip you most
# recently uploaded — re-verified against that exact copy before this
# was generated.
#
# ROOT CAUSE of "no install prompt on /admin": components/pwa-install-prompt.tsx
# is mounted ONCE at the root layout, wrapping the entire app including
# /admin. It has zero awareness of /admin's separate manifest/identity —
# hardcoded "Install Protocol" text, one global beforeinstallprompt
# listener. Even where it might technically fire on /admin, it was
# actively WRONG there (offering to install the main app while looking
# at the admin console), not just missing something admin-specific.
#
# THE FIX:
#   - pwa-install-prompt.tsx: now path-aware (usePathname()) and skips
#     entirely under /admin — both the beforeinstallprompt listener setup
#     and the rendered UI, with isAdminRoute in the effect's dependency
#     array so navigating between /admin and elsewhere within the same
#     session correctly attaches/detaches the listener rather than
#     leaving a stale one.
#   - NEW admin-pwa-install-prompt.tsx: the real fix — a full,
#     independent counterpart with its own beforeinstallprompt listener,
#     its own sessionStorage dismiss key ("admin-pwa-install-dismissed",
#     separate from the main one so dismissing one doesn't suppress the
#     other), "Install Protocol Admin" text throughout (including the
#     Apple manual-install instructions), and the red admin accent color
#     instead of the main app's theme-token primary color. Only renders
#     under /admin (inverse guard of the fix above).
#   - admin-app-shell.tsx: mounts the new component, parallel to how
#     AdminSplash is already mounted there.
#
# ONE THING WORTH KNOWING, not a limitation of this code specifically:
# a browser's `beforeinstallprompt` installability check generally
# re-evaluates on an actual page LOAD/navigation, not necessarily on
# every soft, client-side SPA route transition within an already-open
# tab. If you click a link into /admin from somewhere else in the app
# that's already loaded, the browser may not immediately re-fire the
# event for admin's manifest. For a reliable test: do a hard refresh, or
# open /admin directly in a fresh tab, rather than just soft-navigating
# there from an already-open session.
#
# Verified: `tsc --noEmit` clean (aside from the pre-existing, unrelated
# errors already flagged in the README's "Known Issues" section — none
# touched by this patch) and a full `pnpm build` compiles successfully.
#
# No schema change — no `pnpm db:push` needed.
#
# Run this from the ROOT of your protocol-habit_tracker repo.
# ============================================================================

REPO_ROOT="$(pwd)"

if [ ! -f "$REPO_ROOT/client/package.json" ] || [ ! -f "$REPO_ROOT/shared/schema.ts" ]; then
  echo "❌ This doesn't look like the protocol-habit_tracker repo root."
  echo "   cd into the repo (where client/ and shared/ live) and re-run."
  exit 1
fi

echo "→ Writing updated files..."

mkdir -p "$(dirname "client/src/components/pwa-install-prompt.tsx")"
cat > "client/src/components/pwa-install-prompt.tsx" << 'PROTOCOL_EOF_MARKER'
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X, Share, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

type ApplePlatform = "ios" | "macos" | null;

export function PWAInstallPrompt() {
  const pathname = usePathname();
  // Mounted once at the root layout, so without this guard it wraps
  // /admin too — and since it's hardcoded to "Install Protocol" with no
  // awareness of the separate "Protocol Admin" PWA (see
  // admin-pwa-install-prompt.tsx, its proper counterpart), showing it
  // there would be actively wrong, not just redundant: it'd offer to
  // install the MAIN app while the person is looking at /admin.
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);
  const [applePlatform, setApplePlatform] = useState<ApplePlatform>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isAdminRoute) return;

    // Don't show inside an already-installed PWA.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) {
      return;
    }

    // Don't show again after the user dismissed it during this session.
    if (sessionStorage.getItem("pwa-install-dismissed") === "true") {
      return;
    }

    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform || "";

    // iPhone / iPad / iPod.
    // iPadOS 13+ can report itself as Mac, so also check touch points.
    const isIOS =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Safari on macOS.
    const isSafari =
      /Safari/i.test(userAgent) &&
      !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent);

    const isMacOS = /Macintosh|Mac OS X/i.test(userAgent);

    if (isIOS) {
      setApplePlatform("ios");
      setVisible(true);
      return;
    }

    if (isMacOS && isSafari) {
      setApplePlatform("macos");
      setVisible(true);
      return;
    }

    // Chromium browsers on Android, Windows, Linux and macOS.
    // These use the native browser installation prompt.
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const installEvent = event as BeforeInstallPromptEvent;

      setInstallPrompt(installEvent);
      setVisible(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
    // isAdminRoute included so navigating between /admin and everywhere
    // else within the same session correctly attaches/detaches this
    // listener rather than leaving a stale one from before the guard
    // above took effect.
  }, [isAdminRoute]);

  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => {
      setVisible(false);
      setShowInstructions(false);
      sessionStorage.setItem("pwa-install-dismissed", "true");
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [visible]);

  const handleInstall = async () => {
    // Apple devices don't expose beforeinstallprompt.
    if (applePlatform) {
      setShowInstructions(true);
      return;
    }

    if (!installPrompt) return;

    await installPrompt.prompt();

    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setVisible(false);
    }

    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowInstructions(false);
    sessionStorage.setItem("pwa-install-dismissed", "true");
  };

  const handleCloseInstructions = () => {
    setShowInstructions(false);
  };

  if (isAdminRoute || !visible) {
    return null;
  }

  return (
    <>
      {/* Main install prompt */}
      <div
        role="alert"
        className="fixed bottom-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="relative rounded-xl border bg-background p-4 shadow-lg">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-3 pr-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {applePlatform === "macos" ? (
                <Monitor className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold">Install Protocol</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Install Protocol for quicker/offline access and a better app-like
                experience.
              </p>

              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={handleInstall}
              >
                {applePlatform ? (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    How to Install
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Install
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Apple installation instructions */}
      {showInstructions && applePlatform && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-protocol-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleCloseInstructions}
              aria-label="Close installation instructions"
              className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex items-center gap-3 pr-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {applePlatform === "ios" ? (
                  <Smartphone className="h-6 w-6" />
                ) : (
                  <Monitor className="h-6 w-6" />
                )}
              </div>

              <div>
                <h2
                  id="install-protocol-title"
                  className="text-lg font-bold"
                >
                  Install Protocol
                </h2>
                <p className="text-sm text-muted-foreground">
                  {applePlatform === "ios"
                    ? "Add Protocol to your Home Screen"
                    : "Add Protocol to your Dock"}
                </p>
              </div>
            </div>

            {applePlatform === "ios" ? (
              <div className="space-y-4">
                <InstallStep
                  number="1"
                  title="Tap the Share button"
                  description="In Safari, tap the Share button at the bottom of the screen."
                  icon={<Share className="h-4 w-4" />}
                />

                <InstallStep
                  number="2"
                  title="Add to Home Screen"
                  description='Scroll down and select "Add to Home Screen".'
                />

                <InstallStep
                  number="3"
                  title="Tap Add"
                  description='Tap "Add" in the top-right corner to install Protocol.'
                />

                <div className="mt-6 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                  Protocol will appear on your Home Screen and open like an
                  app.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <InstallStep
                  number="1"
                  title="Open the Safari menu"
                  description='In Safari, open the "File" menu or the Share menu.'
                />

                <InstallStep
                  number="2"
                  title="Add to Dock"
                  description='Select "Add to Dock".'
                />

                <InstallStep
                  number="3"
                  title="Confirm"
                  description='Click "Add" to install Protocol as a Mac web app.'
                />

                <div className="mt-6 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                  Protocol will appear in your Dock and Applications folder.
                </div>
              </div>
            )}

            <Button
              type="button"
              className="mt-6 w-full"
              onClick={handleCloseInstructions}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function InstallStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>

        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
PROTOCOL_EOF_MARKER
echo "  ✓ client/src/components/pwa-install-prompt.tsx"

mkdir -p "$(dirname "client/src/components/admin-pwa-install-prompt.tsx")"
cat > "client/src/components/admin-pwa-install-prompt.tsx" << 'PROTOCOL_EOF_MARKER'
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X, Share, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

// Adapted directly from components/pwa-install-prompt.tsx — same
// beforeinstallprompt/Apple-instructions logic, retargeted for
// "Protocol Admin" specifically. This is what was actually missing
// before: the main PWAInstallPrompt is mounted once at the ROOT layout
// (wrapping /admin too), hardcoded to "Install Protocol" with no
// awareness that /admin has its own separate manifest/identity — it's
// now guarded to skip /admin entirely (see that file), and THIS
// component is what actually offers to install "Protocol Admin" there.
//
// Mounted inside AdminAppShell (parallel to how AdminSplash is), so it
// only ever renders under /admin.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

type ApplePlatform = "ios" | "macos" | null;

const DISMISS_KEY = "admin-pwa-install-dismissed";

export function AdminPWAInstallPrompt() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);
  const [applePlatform, setApplePlatform] = useState<ApplePlatform>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!isAdminRoute) return;

    // Don't show inside an already-installed PWA (this check alone
    // can't distinguish "installed as Protocol" from "installed as
    // Protocol Admin" — display-mode: standalone is true for either.
    // In practice this only matters if someone installs one and then
    // browses to the other's route inside that installed window, an
    // edge case not worth more complexity than the main app's own
    // version of this same check).
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) {
      return;
    }

    if (sessionStorage.getItem(DISMISS_KEY) === "true") {
      return;
    }

    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform || "";

    const isIOS =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isSafari =
      /Safari/i.test(userAgent) &&
      !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent);

    const isMacOS = /Macintosh|Mac OS X/i.test(userAgent);

    if (isIOS) {
      setApplePlatform("ios");
      setVisible(true);
      return;
    }

    if (isMacOS && isSafari) {
      setApplePlatform("macos");
      setVisible(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(installEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => {
      setVisible(false);
      setShowInstructions(false);
      sessionStorage.setItem(DISMISS_KEY, "true");
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [visible]);

  const handleInstall = async () => {
    if (applePlatform) {
      setShowInstructions(true);
      return;
    }

    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setVisible(false);
    }

    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowInstructions(false);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  const handleCloseInstructions = () => {
    setShowInstructions(false);
  };

  if (!isAdminRoute || !visible) {
    return null;
  }

  return (
    <>
      <div
        role="alert"
        className="fixed bottom-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="relative rounded-xl border bg-background p-4 shadow-lg">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-3 pr-5">
            {/* Red accent, matching the rest of the Protocol Admin
                identity (admin-shell's header icon, admin-splash's
                shield) rather than the main app's theme-token primary
                color used in pwa-install-prompt.tsx. */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-700/10 text-red-700">
              {applePlatform === "macos" ? (
                <Monitor className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold">Install Protocol Admin</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Install Protocol Admin for quicker access to the admin console, separate
                from the main Protocol app.
              </p>

              <Button
                type="button"
                size="sm"
                className="mt-3 bg-red-700 hover:bg-red-800 text-white"
                onClick={handleInstall}
              >
                {applePlatform ? (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    How to Install
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Install
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showInstructions && applePlatform && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-protocol-admin-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleCloseInstructions}
              aria-label="Close installation instructions"
              className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex items-center gap-3 pr-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-700/10 text-red-700">
                {applePlatform === "ios" ? (
                  <Smartphone className="h-6 w-6" />
                ) : (
                  <Monitor className="h-6 w-6" />
                )}
              </div>

              <div>
                <h2 id="install-protocol-admin-title" className="text-lg font-bold">
                  Install Protocol Admin
                </h2>
                <p className="text-sm text-muted-foreground">
                  {applePlatform === "ios"
                    ? "Add Protocol Admin to your Home Screen"
                    : "Add Protocol Admin to your Dock"}
                </p>
              </div>
            </div>

            {applePlatform === "ios" ? (
              <div className="space-y-4">
                <InstallStep
                  number="1"
                  title="Tap the Share button"
                  description="In Safari, tap the Share button at the bottom of the screen."
                  icon={<Share className="h-4 w-4" />}
                />
                <InstallStep
                  number="2"
                  title="Add to Home Screen"
                  description='Scroll down and select "Add to Home Screen".'
                />
                <InstallStep
                  number="3"
                  title="Tap Add"
                  description='Tap "Add" in the top-right corner to install Protocol Admin.'
                />
                <div className="mt-6 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                  Protocol Admin will appear on your Home Screen as its own app, separate
                  from Protocol.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <InstallStep
                  number="1"
                  title="Open the Safari menu"
                  description='In Safari, open the "File" menu or the Share menu.'
                />
                <InstallStep number="2" title="Add to Dock" description='Select "Add to Dock".' />
                <InstallStep
                  number="3"
                  title="Confirm"
                  description='Click "Add" to install Protocol Admin as a Mac web app.'
                />
                <div className="mt-6 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                  Protocol Admin will appear in your Dock and Applications folder, separate
                  from Protocol.
                </div>
              </div>
            )}

            <Button type="button" className="mt-6 w-full bg-red-700 hover:bg-red-800 text-white" onClick={handleCloseInstructions}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function InstallStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white">
        {number}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>

        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
PROTOCOL_EOF_MARKER
echo "  ✓ client/src/components/admin-pwa-install-prompt.tsx"

mkdir -p "$(dirname "client/src/components/admin-app-shell.tsx")"
cat > "client/src/components/admin-app-shell.tsx" << 'PROTOCOL_EOF_MARKER'
"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AdminSplash } from "@/components/admin-splash";
import { AdminPWAInstallPrompt } from "@/components/admin-pwa-install-prompt";

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
      <AdminPWAInstallPrompt />
      <AnimatePresence mode="wait">
        {showSplash && <AdminSplash onComplete={handleSplashComplete} />}
      </AnimatePresence>
    </>
  );
}
PROTOCOL_EOF_MARKER
echo "  ✓ client/src/components/admin-app-shell.tsx"


echo "✓ All files written."
echo ""
echo "Next steps:"
echo "  1. pnpm dev            # try it locally"
echo "  2. Test with a HARD refresh or fresh tab on /admin — soft"
echo "     client-side navigation there may not re-trigger the browser's"
echo "     installability check (see the note at the top of this script)."
echo ""
echo "No pnpm db:push needed — no schema change in this patch."
