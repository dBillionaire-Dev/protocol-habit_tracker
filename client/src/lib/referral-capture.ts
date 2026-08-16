"use client";

// Client-side only — stores a referral code captured from ?ref= in
// localStorage until it can be attributed server-side after a real
// signup. Never trusted as-is: the actual attribution (and all its
// fraud guards — no self-referral, immutable once set, etc.) happens
// entirely server-side in lib/referrals.ts.

const REF_STORAGE_KEY = "protocol:pendingReferralCode";

export function captureReferralCodeFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.trim()) {
    window.localStorage.setItem(REF_STORAGE_KEY, ref.trim());
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REF_STORAGE_KEY);
}

export function clearPendingReferralCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REF_STORAGE_KEY);
}
