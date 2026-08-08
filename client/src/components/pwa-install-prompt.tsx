"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);

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
      sessionStorage.setItem("pwa-install-dismissed", "true");
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [visible]);

  const handleInstall = async () => {
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
    sessionStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!visible || !installPrompt) {
    return null;
  }

  return (
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
            <Download className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold">
              Install Protocol
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Install Protocol for quicker access and a better app-like
              experience.
            </p>

            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={handleInstall}
            >
              <Download className="mr-2 h-4 w-4" />
              Install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
