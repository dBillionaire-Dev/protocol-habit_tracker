"use client";

const GUEST_MODE_KEY = "protocol:guestMode";
// Set once, the moment guest mode is first entered -- lets the server
// (see lib/auth/require-user.ts) enforce a real 1-day expiry on guest
// sessions instead of trusting the flag indefinitely. Exported so
// guest-storage.ts can enforce the same 1-day limit on guest HABIT DATA
// using this exact same timestamp, rather than tracking a second,
// separate expiry clock that could drift out of sync with the session
// one.
export const GUEST_STARTED_AT_KEY = "protocol:guestStartedAt";
export const GUEST_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
}

export function setGuestMode(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(GUEST_MODE_KEY, "true");
    // Only stamp a fresh start time if one isn't already running --
    // calling setGuestMode(true) again on an already-active guest
    // session (e.g. a re-render, or apiFetch being called repeatedly)
    // must NOT push the expiry back out, or guest mode would never
    // actually expire in practice.
    if (!window.localStorage.getItem(GUEST_STARTED_AT_KEY)) {
      window.localStorage.setItem(GUEST_STARTED_AT_KEY, new Date().toISOString());
    }
  } else {
    window.localStorage.removeItem(GUEST_MODE_KEY);
    window.localStorage.removeItem(GUEST_STARTED_AT_KEY);
  }
}

/**
 * Thin fetch wrapper for our own Next.js Route Handlers (same origin now
 * that Express is gone). Real user auth rides on the Supabase session
 * cookie automatically; guest mode is intentionally stateless, so we
 * attach both the flag and its start time ourselves -- the server is the
 * one that actually enforces the 1-day expiry using that timestamp.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (isGuestMode()) {
    headers.set("X-Guest-Mode", "true");
    const startedAt = window.localStorage.getItem(GUEST_STARTED_AT_KEY);
    if (startedAt) {
      headers.set("X-Guest-Started-At", startedAt);
    }
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
}
