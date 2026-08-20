"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Timeline (non-reduced-motion):
//   0.00 - 0.65s  entrance -- shield + big centered "P" appear together,
//                 continuing directly from what the native launch icon
//                 already showed (same shield, same big "P").
//   0.35 - 1.35s  ripples + glow pulse
//   0.75 - 1.55s  settle wiggle
//   1.55 - 1.90s  hold
//   1.90 - 2.60s  LETTERS -- the big "P" shrinks + slides left into its
//                 place as the first letter of "Protocol", while the
//                 remaining letters ("rotocol") fade/slide into place
//                 beside it.
//   2.60 - 2.95s  hold with the full word formed
//   2.95 - 3.55s  RESOLVE -- text fades, shield shrinks/slides onto the
//                 real header logo's measured position, then fades with
//                 the backdrop, revealing the actual page underneath.
const LETTERS_AT = 1900;
const RESOLVE_AT = 2950;
const SPLASH_DURATION = 3750;

// Same Lucide "shield" path as the manifest icons, filled directly
// rather than stroked (see protocol-mark*.svg).
const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

// Geometry measured directly from rendering the real glyphs at these
// exact font settings (see conversation) so the "P" -> "Protocol" split
// lines up pixel-accurately instead of guessing at kerning.
//   Final word "Protocol", centered, font-size 3.05: spans x 6.01-17.95
//   Final "P" (as first letter): ink center ~= (7.065, 12.0)
//   Big launch "P" (x=12 y=14.4 font-size 9, matches icon-only asset):
//     ink center ~= (12.15, 11.30)
const P_FINAL_X = 6.01;
const P_FINAL_Y = 13.05;
const P_FINAL_SIZE = 3.05;
const ROTOCOL_X = 8.05;
const WORD_Y = 13.05;
const WORD_SIZE = 3.05;

const P_CENTER = { x: 7.065, y: 12.0 };
const BIG_P_CENTER = { x: 12.15, y: 11.3 };
const BIG_P_SIZE = 9;

const P_INITIAL_DX = BIG_P_CENTER.x - P_CENTER.x;
const P_INITIAL_DY = BIG_P_CENTER.y - P_CENTER.y;
const P_INITIAL_SCALE = BIG_P_SIZE / P_FINAL_SIZE;

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
  const [lettersFormed, setLettersFormed] = useState(false);
  const [morphTarget, setMorphTarget] = useState<MorphTarget | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const completeTimer = window.setTimeout(
      onComplete,
      shouldReduceMotion ? 250 : SPLASH_DURATION,
    );

    let lettersTimer: number | undefined;
    let resolveTimer: number | undefined;

    if (!shouldReduceMotion) {
      lettersTimer = window.setTimeout(() => setLettersFormed(true), LETTERS_AT);

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
      if (lettersTimer) window.clearTimeout(lettersTimer);
      if (resolveTimer) window.clearTimeout(resolveTimer);
    };
  }, [onComplete, shouldReduceMotion]);

  const resolving = revealed && morphTarget !== null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-label="Loading Protocol"
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.15 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Backdrop is a separate layer so it can fade independently during
          the resolve phase, revealing the real page (already mounted
          underneath) right as the icon lands on the real logo's position. */}
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
          duration: shouldReduceMotion ? 0.15 : 0.65,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {!shouldReduceMotion && !revealed && (
          <>
            <motion.div
              className="absolute rounded-full border border-black/10"
              style={{ width: "min(94vw, 470px)", height: "min(94vw, 470px)" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.3, 0], scale: [0.6, 1.15, 1.3] }}
              transition={{ delay: 0.9, duration: 1.1, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full border border-black/[0.08]"
              style={{ width: "min(78vw, 390px)", height: "min(78vw, 390px)" }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: [0, 0.4, 0], scale: [0.55, 1.05, 1.2] }}
              transition={{ delay: 0.35, duration: 0.95, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full bg-black/[0.03] blur-2xl"
              style={{ width: "min(60vw, 300px)", height: "min(60vw, 300px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6] }}
              transition={{ delay: 0.5, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            />
          </>
        )}

        <motion.div
          ref={iconBoxRef}
          className="relative"
          style={{ width: "min(73vw, 360px)", height: "min(73vw, 360px)", transformOrigin: "center center" }}
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
              : { delay: 0.75, duration: 0.8, ease: [0.4, 0, 0.2, 1], times: [0, 0.35, 0.55, 0.8, 1] }
          }
        >
          <svg viewBox="0 0 24 24" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <path d={shieldPath} fill="#000000" />

            {/* "P" -- rendered at its TRUE final position/size (first
                letter of "Protocol"), then given an inverse transform so
                it *starts* looking exactly like the big centered "P" on
                the native launch icon. Animating that transform back to
                identity is what makes it shrink + slide into place. */}
            <motion.text
              x={P_FINAL_X}
              y={P_FINAL_Y}
              textAnchor="start"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize={P_FINAL_SIZE}
              fill="#ffffff"
              style={{ transformOrigin: `${P_CENTER.x}px ${P_CENTER.y}px` }}
              initial={
                shouldReduceMotion
                  ? { x: 0, y: 0, scale: 1 }
                  : { x: P_INITIAL_DX, y: P_INITIAL_DY, scale: P_INITIAL_SCALE }
              }
              animate={
                shouldReduceMotion
                  ? { x: 0, y: 0, scale: 1, opacity: 1 }
                  : lettersFormed
                    ? { x: 0, y: 0, scale: 1, opacity: resolving ? 0 : 1 }
                    : { x: P_INITIAL_DX, y: P_INITIAL_DY, scale: P_INITIAL_SCALE, opacity: 1 }
              }
              transition={
                resolving
                  ? { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
                  : { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
              }
            >
              P
            </motion.text>

            {/* "rotocol" -- fades and slides in beside the "P" once it
                lands, completing the word. */}
            <motion.text
              x={ROTOCOL_X}
              y={WORD_Y}
              textAnchor="start"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize={WORD_SIZE}
              fill="#ffffff"
              initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 1.4 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1, x: 0 }
                  : lettersFormed
                    ? { opacity: resolving ? 0 : 1, x: 0 }
                    : { opacity: 0, x: 1.4 }
              }
              transition={
                resolving
                  ? { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                  : { delay: 0.18, duration: 0.5, ease: [0.16, 1, 0.3, 1] }
              }
            >
              rotocol
            </motion.text>
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
