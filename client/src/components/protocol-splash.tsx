"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SPLASH_DURATION = 1450;
const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

interface ProtocolSplashProps {
  onComplete: () => void;
}

export function ProtocolSplash({ onComplete }: ProtocolSplashProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(
      onComplete,
      shouldReduceMotion ? 250 : SPLASH_DURATION,
    );

    return () => window.clearTimeout(timer);
  }, [onComplete, shouldReduceMotion]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
      aria-label="Loading Protocol"
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 1.015 }
      }
      transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="relative flex items-center justify-center"
        initial={
          shouldReduceMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.82, y: 14 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0.15 : 0.65,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {!shouldReduceMotion && (
          <motion.div
            className="absolute h-32 w-32 rounded-full border border-black/10"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: [0, 0.35, 0], scale: [0.65, 1.2, 1.35] }}
            transition={{ delay: 0.35, duration: 0.9, ease: "easeOut" }}
          />
        )}

        <motion.div
          className="relative h-28 w-28"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.035, 1] }}
          transition={{ delay: 0.72, duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <motion.path
              d={shieldPath}
              fill="#000000"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </svg>

          <motion.span
            className="absolute inset-0 flex items-center justify-center pt-1 text-[11px] font-semibold tracking-[0.02em] text-white"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0.05 : 0.38,
              duration: shouldReduceMotion ? 0.15 : 0.38,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            Protocol
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
