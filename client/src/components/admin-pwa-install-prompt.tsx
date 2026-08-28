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
