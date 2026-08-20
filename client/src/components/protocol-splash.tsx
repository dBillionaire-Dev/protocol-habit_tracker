"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Timeline (non-reduced-motion):
const RESOLVE_AT = 2150;
const SPLASH_DURATION = 2850;

const shieldPath =
  "M100 8 C 108 28, 128 40, 168 44 C 172 44.4, 175 48, 175 52 L 175 108 C 175 152, 148 178, 102 194.5 C 100.7 195, 99.3 195, 98 194.5 C 52 178, 25 152, 25 108 L 25 52 C 25 48, 28 44.4, 32 44 C 72 40, 92 28, 100 8 Z";

interface ProtocolSplashProps {
  onComplete: () => void;
}

interface MorphTarget {
  dx: number;
  dy: number;
  scale: number;
}

export function ProtocolSplash({ onComplete }: ProtocolSplashProps) {
  const shouldReduceMotion = useReducedMotion();
  const iconBoxRef = useRef<HTMLDivElement>(null);
  const [morphTarget, setMorphTarget] = useState<MorphTarget | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const completeTimer = window.setTimeout(
      onComplete,
      shouldReduceMotion ? 250 : SPLASH_DURATION,
    );

    let resolveTimer: number | undefined;
    if (!shouldReduceMotion) {
      resolveTimer = window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>("[data-app-logo-icon]");
        const iconBox = iconBoxRef.current;
        if (target && iconBox) {
          const targetRect = target.getBoundingClientRect();
          const iconRect = iconBox.getBoundingClientRect();
          const targetCx = targetRect.left + targetRect.width / 2;
          const targetCy = targetRect.top + targetRect.height / 2;
          const iconCx = iconRect.left + iconRect.width / 2;
          const iconCy = iconRect.top + iconRect.height / 2;
          setMorphTarget({
            dx: targetCx - iconCx,
            dy: targetCy - iconCy,
            scale: targetRect.width / iconRect.width,
          });
        }
        setRevealed(true);
      }, RESOLVE_AT);
    }

    return () => {
      window.clearTimeout(completeTimer);
      if (resolveTimer) window.clearTimeout(resolveTimer);
    };
  }, [onComplete, shouldReduceMotion]);

  const resolving = revealed && morphTarget !== null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-label="Loading Protocol"
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0 }
      }
      transition={{ duration: shouldReduceMotion ? 0.15 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 1 }}
        animate={{ opacity: revealed ? 0 : 1 }}
        transition={{ duration: shouldReduceMotion ? 0.15 : 0.55, ease: [0.4, 0, 0.2, 1] }}
      />

      <motion.div
        className="relative flex items-center justify-center"
        initial={
          shouldReduceMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.82, y: 14 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0.15 : 0.7,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {!shouldReduceMotion && !revealed && (
          <>
            {/* Outer ripple -- widest, slowest, most delayed */}
            <motion.div
              className="absolute rounded-full border border-black/10"
              style={{ width: "min(94vw, 470px)", height: "min(94vw, 470px)" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.3, 0], scale: [0.6, 1.15, 1.3] }}
              transition={{ delay: 1.0, duration: 1.1, ease: "easeOut" }}
            />
            {/* Inner ripple -- tighter, fires earlier, gives a two-pulse feel */}
            <motion.div
              className="absolute rounded-full border border-black/[0.08]"
              style={{ width: "min(78vw, 390px)", height: "min(78vw, 390px)" }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: [0, 0.4, 0], scale: [0.55, 1.05, 1.2] }}
              transition={{ delay: 0.4, duration: 0.95, ease: "easeOut" }}
            />
            {/* Soft glow pulse behind the mark */}
            <motion.div
              className="absolute rounded-full bg-black/[0.03] blur-2xl"
              style={{ width: "min(60vw, 300px)", height: "min(60vw, 300px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6] }}
              transition={{ delay: 0.55, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            />
          </>
        )}

        <motion.div
          ref={iconBoxRef}
          className="relative"
          style={{
            width: "min(73vw, 360px)",
            height: "min(73vw, 360px)",
            transformOrigin: "center center",
          }}
          animate={
            shouldReduceMotion
              ? undefined
              : resolving
                ? { x: morphTarget!.dx, y: morphTarget!.dy, scale: morphTarget!.scale, opacity: [1, 1, 0] }
                : { scale: [1, 1.045, 1], rotate: [0, -1.2, 0, 1.2, 0] }
          }
          transition={
            resolving
              ? { duration: 0.6, ease: [0.4, 0, 0.2, 1], times: [0, 0.75, 1] }
              : { delay: 0.85, duration: 0.9, ease: [0.4, 0, 0.2, 1], times: [0, 0.35, 0.55, 0.8, 1] }
          }
        >
          <motion.svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <motion.path
              d={shieldPath}
              fill="#000000"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ transformOrigin: "100px 100px" }}
              transition={{ duration: shouldReduceMotion ? 0.15 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.text
              x="100"
              y="118"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize="26"
              fill="#ffffff"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{
                opacity: shouldReduceMotion ? 1 : resolving ? 0 : 1,
                y: 0,
              }}
              transition={{
                delay: shouldReduceMotion ? 0.05 : resolving ? 0 : 0.5,
                duration: shouldReduceMotion ? 0.15 : resolving ? 0.25 : 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              Protocol
            </motion.text>
          </motion.svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
