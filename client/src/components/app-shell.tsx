"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ProtocolSplash } from "@/components/protocol-splash";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <>
      {children}

      <AnimatePresence mode="wait">
        {showSplash && <ProtocolSplash onComplete={handleSplashComplete} />}
      </AnimatePresence>
    </>
  );
}
