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
//   2.95s         RESOLVE begins -- but only once `appReady` is true (see
//                 below). If the app isn't ready yet, this holds here
//                 with a gentle idle pulse instead of starting the
//                 morph, so we never yank the user into a half-loaded
//                 page. A hard cap prevents an indefinite hang if the
//                 ready signal never arrives.
//   RESOLVE (0.6s morph + fade) -- shield shrinks/slides onto the real
//                 header logo's measured position, fading with the
//                 backdrop to reveal the real (now-ready) page.
const LETTERS_AT = 1900;
const RESOLVE_AT = 2950;
// Safety net: if `appReady` never turns true, stop waiting and resolve
// anyway after this much *additional* time, rather than hanging forever.
const MAX_EXTRA_WAIT = 4000;
// How long after the resolve morph begins before we call onComplete --
// covers the 0.6s translate/scale/fade plus a hair of buffer.
const RESOLVE_TAIL = 700;

const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

// Geometry measured directly from rendering the real glyphs at these
// exact font settings so the "P" -> "Protocol" split lines up
// pixel-accurately instead of guessing at kerning.
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
  /**
   * Whether the underlying app (auth check, critical data, etc.) has
   * finished loading. Defaults to true (fixed-timer behavior) so this
   * is safe to omit. Pass your real readiness state -- e.g.
   * `appReady={!isAuthLoading}` -- to have the splash wait for actual
   * data instead of always assuming 2.95s is enough.
   *
   * The splash always plays its full choreography up to the "word
   * formed" hold regardless of this prop -- only the final resolve/morph
   * step (which reveals the real page) waits on it, and only up to
   * MAX_EXTRA_WAIT before proceeding anyway.
   */
  appReady?: boolean;
}

interface MorphTarget {
  dx: number;
  dy: number;
  scale: number;
}

export function ProtocolSplash({ onComplete, appReady = true }: ProtocolSplashProps) {
  const shouldReduceMotion = useReducedMotion();
  const iconBoxRef = useRef<HTMLDivElement>(null);
  const appReadyRef = useRef(appReady);
  const resolvedRef = useRef(false);

  const [lettersFormed, setLettersFormed] = useState(false);
  const [waitingForReady, setWaitingForReady] = useState(false);
  const [morphTarget, setMorphTarget] = useState<MorphTarget | null>(null);
  const [revealed, setRevealed] = useState(false);
  const beginResolveRef = useRef<() => void>(() => {});

  useEffect(() => {
    appReadyRef.current = appReady;
  }, [appReady]);

  // Single source of truth for "start the resolve/morph phase" -- both
  // the scheduled attempt and the appReady-just-turned-true watcher call
  // this same function via the ref, so there's exactly one place that
  // measures the target and kicks off the morph.
  beginResolveRef.current = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setWaitingForReady(false);

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
    window.setTimeout(onComplete, RESOLVE_TAIL);
  };

  // Mount-once timers: letters phase, and the resolve attempt/fallback.
  useEffect(() => {
    if (shouldReduceMotion) {
      const t = window.setTimeout(onComplete, 250);
      return () => window.clearTimeout(t);
    }

    const lettersTimer = window.setTimeout(() => setLettersFormed(true), LETTERS_AT);

    let maxWaitTimer: number | undefined;
    const resolveTimer = window.setTimeout(() => {
      if (appReadyRef.current) {
        beginResolveRef.current();
      } else {
        setWaitingForReady(true);
        maxWaitTimer = window.setTimeout(() => beginResolveRef.current(), MAX_EXTRA_WAIT);
      }
    }, RESOLVE_AT);

    return () => {
      window.clearTimeout(lettersTimer);
      window.clearTimeout(resolveTimer);
      if (maxWaitTimer) window.clearTimeout(maxWaitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, shouldReduceMotion]);

  // If we're sitting in the idle "waiting for ready" hold and the app
  // becomes ready, resolve immediately instead of waiting out the full
  // MAX_EXTRA_WAIT fallback.
  useEffect(() => {
    if (waitingForReady && appReady && !resolvedRef.current) {
      beginResolveRef.current();
    }
  }, [waitingForReady, appReady]);

  const resolving = revealed && morphTarget !== null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="status"
      aria-live="polite"
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.15 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Screen readers get a plain, real status message. Everything
          visual below (including the "P"/"rotocol" glyphs, which are a
          decorative animation, not semantic text) is hidden from
          assistive tech so it isn't announced letter-by-letter. */}
      <span className="sr-only">Loading Protocol</span>

      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 1 }}
        animate={{ opacity: revealed ? 0 : 1 }}
        transition={{ duration: shouldReduceMotion ? 0.15 : 0.55, ease: [0.4, 0, 0.2, 1] }}
        aria-hidden="true"
      />

      <motion.div
        className="relative flex items-center justify-center"
        aria-hidden="true"
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
                : waitingForReady
                  ? { scale: [1, 1.03, 1], opacity: [1, 0.85, 1] }
                  : { scale: [1, 1.045, 1], rotate: [0, -1.2, 0, 1.2, 0] }
          }
          transition={
            resolving
              ? { duration: 0.6, ease: [0.4, 0, 0.2, 1], times: [0, 0.75, 1] }
              : waitingForReady
                ? { duration: 1.1, ease: "easeInOut", repeat: Infinity }
                : { delay: 0.75, duration: 0.8, ease: [0.4, 0, 0.2, 1], times: [0, 0.35, 0.55, 0.8, 1] }
          }
        >
          <svg viewBox="0 0 24 24" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <path d={shieldPath} fill="#000000" />

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
