"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Timeline (non-reduced-motion):
//   0.00 - 0.70s  entrance (fade/scale/settle)
//   0.40 - 1.50s  ripples + glow pulse
//   0.85 - 1.75s  settle wiggle
//   1.75 - 2.15s  hold
//   2.15 - 2.75s  "resolve" -- text fades, icon shrinks/slides onto the
//                 real header logo's measured position, then fades as the
//                 white backdrop fades with it, revealing the actual page
//                 (which has been mounted underneath the whole time).
const RESOLVE_AT = 2150;
const SPLASH_DURATION = 2850;

// True vector shield + wordmark -- same source used to generate the
// manifest icons (protocol-mark*.svg). This is your original Lucide
// "shield" path, filled directly rather than stroked, which is why it
// has the rounded double-peak top rather than a single sharp point.
// Rendered as real SVG (not a raster <Image>) so it's crisp at any size
// on any screen -- the earlier PNG approach was inherently soft because
// the source asset itself was a blurry raster.
const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

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
        // Measure the real header/landing logo (data-app-logo-icon) right
        // before the resolve phase starts, so the target is accurate even
        // if fonts/images shifted layout after mount. Falls back to a
        // plain fade (no morph) if the target isn't found for any reason.
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
      {/* Backdrop is a separate layer from the icon so it can fade
          independently during the resolve phase, revealing the real page
          (already mounted underneath) right as the icon lands on the
          real logo's position. */}
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
            viewBox="0 0 24 24"
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
              style={{ transformOrigin: "12px 12px" }}
              transition={{ duration: shouldReduceMotion ? 0.15 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.text
              x="12"
              y="15.1"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize="3.05"
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
