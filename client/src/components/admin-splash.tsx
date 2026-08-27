"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Adapted directly from components/protocol-splash.tsx — same
// choreography/timing/morph mechanism, retargeted for "Protocol Admin":
//   - "P" -> "Admin" split geometry re-measured from scratch (see below)
//     rather than reusing the original's numbers, since "A"/"dmin" have
//     different glyph widths than "P"/"rotocol" and reusing the P/rotocol
//     offsets would visibly misalign the split.
//   - Shield color is the admin accent red (#b91c1c / Tailwind red-700),
//     not the neutral foreground/background theme tokens the main splash
//     uses — this has to match admin-shell.tsx's now-also-red header
//     Shield icon (see that file), since this splash's final act morphs
//     directly onto that element. A themed black/white shield morphing
//     into a red header icon would visibly jump color at the exact
//     moment it's supposed to look seamless.
// See that file for the full timeline comment and behavior notes not
// repeated here.
const LETTERS_AT = 1900;
const RESOLVE_AT = 2950;
const MAX_EXTRA_WAIT = 4000;
const RESOLVE_TAIL = 700;

const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

const ADMIN_SHIELD_FILL = "#b91c1c";
const ADMIN_TEXT_FILL = "#ffffff";

// Geometry re-measured (not reused from protocol-splash.tsx) via actual
// glyph advance-width measurement in Liberation Sans Bold — a
// metric-compatible substitute for the Arial/Helvetica this renders
// with in-browser — at font-size 3.05 in this 24-unit viewBox, so the
// "A" -> "Admin" split lines up as precisely as the original "P" ->
// "Protocol" one does, rather than guessing offsets for a different word.
//
// Measured advance widths at font-size 3.05: "A" = 2.2026, "Admin" =
// 9.4881. "Admin" centered the same way "Protocol" was in the original
// (visual center around x=12.19) gives the two constants below.
const A_FINAL_X = 7.45;
const A_FINAL_Y = 13.05;
const A_FINAL_SIZE = 3.05;
const DMIN_X = 9.65;
const WORD_Y = 13.05;
const WORD_SIZE = 3.05;

// Center of the small "A" glyph once part of "Admin" (A_FINAL_X + half
// its measured width; y-offset from baseline matches the original's
// cap-height-to-center offset, which is font-size-driven rather than
// glyph-specific, so it carries over unchanged).
const A_CENTER = { x: 8.55, y: 12.0 };
// Where a single big standalone letter sits centered in the shield —
// this is a property of the SHIELD, not the letter, so it's identical
// to the original's BIG_P_CENTER regardless of which glyph is drawn there.
const BIG_A_CENTER = { x: 12.15, y: 11.3 };
const BIG_A_SIZE = 9;

const A_INITIAL_DX = BIG_A_CENTER.x - A_CENTER.x;
const A_INITIAL_DY = BIG_A_CENTER.y - A_CENTER.y;
const A_INITIAL_SCALE = BIG_A_SIZE / A_FINAL_SIZE;

interface AdminSplashProps {
  onComplete: () => void;
  appReady?: boolean;
}

interface MorphTarget {
  dx: number;
  dy: number;
  scale: number;
}

export function AdminSplash({ onComplete, appReady = true }: AdminSplashProps) {
  const shouldReduceMotion = useReducedMotion();
  const iconBoxRef = useRef<HTMLDivElement>(null);
  const appReadyRef = useRef(appReady);
  const resolvedRef = useRef(false);
  const naturalIconRef = useRef<{ cx: number; cy: number; width: number } | null>(null);

  const [lettersFormed, setLettersFormed] = useState(false);
  const [waitingForReady, setWaitingForReady] = useState(false);
  const [morphTarget, setMorphTarget] = useState<MorphTarget | null>(null);
  const [revealed, setRevealed] = useState(false);
  const beginResolveRef = useRef<() => void>(() => {});

  useEffect(() => {
    appReadyRef.current = appReady;
  }, [appReady]);

  beginResolveRef.current = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setWaitingForReady(false);

    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY = 80;

    const finish = (target: HTMLElement | null) => {
      const iconBox = iconBoxRef.current;
      if (target && iconBox) {
        const targetRect = target.getBoundingClientRect();
        const iconRect = iconBox.getBoundingClientRect();
        const targetCx = targetRect.left + targetRect.width / 2;
        const targetCy = targetRect.top + targetRect.height / 2;
        const iconCx = iconRect.left + iconRect.width / 2;
        const iconCy = iconRect.top + iconRect.height / 2;
        naturalIconRef.current = { cx: iconCx, cy: iconCy, width: iconRect.width };
        setMorphTarget({
          dx: targetCx - iconCx,
          dy: targetCy - iconCy,
          scale: targetRect.width / iconRect.width,
        });
      } else {
        // eslint-disable-next-line no-console
        console.error(
          '[AdminSplash] Could not find [data-app-logo-icon] in the DOM -- ' +
          "falling back to a plain fade instead of morphing onto the logo. " +
          "Make sure the admin header logo element has the data-app-logo-icon attribute.",
        );
      }
      setRevealed(true);
      window.setTimeout(onComplete, RESOLVE_TAIL);
    };

    const attempt = (n: number) => {
      const target = document.querySelector<HTMLElement>("[data-app-logo-icon]");
      if (target || n >= MAX_ATTEMPTS) {
        finish(target);
      } else {
        window.setTimeout(() => attempt(n + 1), RETRY_DELAY);
      }
    };
    attempt(0);
  };

  useEffect(() => {
    if (!(revealed && morphTarget !== null)) return;

    const remeasure = () => {
      const target = document.querySelector<HTMLElement>("[data-app-logo-icon]");
      const natural = naturalIconRef.current;
      if (!target || !natural) return;
      const targetRect = target.getBoundingClientRect();
      const targetCx = targetRect.left + targetRect.width / 2;
      const targetCy = targetRect.top + targetRect.height / 2;
      setMorphTarget({
        dx: targetCx - natural.cx,
        dy: targetCy - natural.cy,
        scale: targetRect.width / natural.width,
      });
    };

    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
    };
  }, [revealed, morphTarget]);

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
      <span className="sr-only">Loading Protocol Admin</span>

      <motion.div
        className="absolute inset-0 bg-background"
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
              className="absolute rounded-full border"
              style={{ width: "min(94vw, 470px)", height: "min(94vw, 470px)", borderColor: "rgba(185,28,28,0.12)" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.3, 0], scale: [0.6, 1.15, 1.3] }}
              transition={{ delay: 0.9, duration: 1.1, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full border"
              style={{ width: "min(78vw, 390px)", height: "min(78vw, 390px)", borderColor: "rgba(185,28,28,0.09)" }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: [0, 0.4, 0], scale: [0.55, 1.05, 1.2] }}
              transition={{ delay: 0.35, duration: 0.95, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full blur-2xl"
              style={{ width: "min(60vw, 300px)", height: "min(60vw, 300px)", backgroundColor: "rgba(185,28,28,0.05)" }}
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
            <path d={shieldPath} fill={ADMIN_SHIELD_FILL} />

            <motion.text
              x={A_FINAL_X}
              y={A_FINAL_Y}
              textAnchor="start"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize={A_FINAL_SIZE}
              fill={ADMIN_TEXT_FILL}
              style={{ transformOrigin: `${A_CENTER.x}px ${A_CENTER.y}px` }}
              initial={
                shouldReduceMotion
                  ? { x: 0, y: 0, scale: 1 }
                  : { x: A_INITIAL_DX, y: A_INITIAL_DY, scale: A_INITIAL_SCALE }
              }
              animate={
                shouldReduceMotion
                  ? { x: 0, y: 0, scale: 1, opacity: 1 }
                  : lettersFormed
                    ? { x: 0, y: 0, scale: 1, opacity: resolving ? 0 : 1 }
                    : { x: A_INITIAL_DX, y: A_INITIAL_DY, scale: A_INITIAL_SCALE, opacity: 1 }
              }
              transition={
                resolving
                  ? { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
                  : { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
              }
            >
              A
            </motion.text>

            <motion.text
              x={DMIN_X}
              y={WORD_Y}
              textAnchor="start"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight={700}
              fontSize={WORD_SIZE}
              fill={ADMIN_TEXT_FILL}
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
              dmin
            </motion.text>
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
