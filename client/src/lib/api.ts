"use client";

const GUEST_MODE_KEY = "protocol:guestMode";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
}

export function setGuestMode(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(GUEST_MODE_KEY, "true");
  } else {
    window.localStorage.removeItem(GUEST_MODE_KEY);
  }
}

/**
 * Thin fetch wrapper for our own Next.js Route Handlers (same origin now
 * that Express is gone). Real user auth rides on the Supabase session
 * cookie automatically; the only thing we need to add ourselves is the
 * guest-mode header, since guest mode is intentionally stateless.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (isGuestMode()) {
    headers.set("X-Guest-Mode", "true");
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
