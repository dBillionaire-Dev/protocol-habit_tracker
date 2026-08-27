"use client";

import { useEffect, useState } from "react";
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
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);
  const [applePlatform, setApplePlatform] = useState<ApplePlatform>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
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
  }, []);

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

  if (!visible) {
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
