"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, isGuestMode, setGuestMode } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
  showOnboarding?: string;
}

async function fetchUser(): Promise<AuthUser | null> {
  const response = await apiFetch("/api/auth/user");

  if (response.status === 401) {
    // A 401 while we believe we're in guest mode can only mean the
    // server-side guest expiry (see require-user.ts) rejected a stale
    // X-Guest-Started-At timestamp -- clear the local flag/timestamp so
    // the next "Continue as Guest" click actually starts a fresh
    // session instead of silently reusing the same expired timestamp
    // (setGuestMode(true) only stamps a new start time when none is
    // already present, so a leftover stale one would otherwise block
    // guest mode from ever working again).
    if (isGuestMode()) {
      setGuestMode(false);
    }
    return null;
  }
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function logout(): Promise<void> {
  const wasGuest = isGuestMode();
  setGuestMode(false);

  if (!wasGuest) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  await apiFetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

async function deleteAccount(): Promise<void> {
  const response = await apiFetch("/api/auth/user", { method: "DELETE" });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete account");
  }
  setGuestMode(false);
  window.location.href = "/home";
}

async function loginAsGuest(): Promise<AuthUser> {
  setGuestMode(true);
  const response = await apiFetch("/api/auth/guest", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to login as guest");
  }
  return response.json();
}

/**
 * Kicks off Supabase's hosted Google OAuth flow. Supabase redirects back to
 * /auth/callback with a code, which a Route Handler exchanges for a
 * session (see app/auth/callback/route.ts). No manual token handling here.
 */
async function loginWithGoogle(): Promise<void> {
  setGuestMode(false);
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

// Spec section 14: sends the recovery email via Supabase Auth's own
// password-reset flow (rather than rolling a custom token system) —
// Supabase handles token generation, expiry, and the reset email itself.
// redirectTo points at the SAME /auth/callback route already used for
// Google OAuth (see app/auth/callback/route.ts), with `next` set so it
// lands on /reset-password once the recovery code is exchanged for a
// session, instead of the OAuth flow's default /dashboard.
async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
  if (error) throw new Error(error.message);
}

// Used by BOTH the "set a new password" step of the forgot-password flow
// (where the recovery-link exchange already established a temporary
// session) and the signed-in "Change Password" action — Supabase's
// updateUser doesn't distinguish between the two; either way it just
// requires an active session, which both callers already have.
async function updatePassword(newPassword: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

async function checkExistingProvider(
  email: string,
): Promise<{ exists: boolean; provider: string | null }> {
  const res = await apiFetch(`/api/auth/check-provider?email=${encodeURIComponent(email)}`);
  if (!res.ok) return { exists: false, provider: null };
  return res.json();
}

function providerLabel(provider: string): string {
  return provider === "google" ? "Google Sign-In" : provider === "email" ? "email and password" : provider;
}

async function loginWithEmail(email: string, password: string): Promise<void> {
  setGuestMode(false);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) {
    // Stamp lastLoginAt for the 7-day session-enforcement check in
    // require-user.ts. Awaited here, before this function returns, so
    // the mutation's onSuccess (and any redirect that follows it) never
    // fires before the timestamp is actually set -- see mark-login's own
    // comment for why it can't just happen lazily on the next
    // /api/auth/user check instead.
    //
    // Best-effort: if this specific call fails (network blip), the sign-in
    // itself already succeeded and shouldn't be undone over it -- the
    // person just won't get the 7-day grace period until their next
    // successful login, rather than being blocked from this one.
    try {
      await apiFetch("/api/auth/mark-login", { method: "POST" });
    } catch (err) {
      console.error("Failed to mark login timestamp:", err);
    }
    return;
  }

  // Give a clearer message than "invalid credentials" if this email is
  // actually registered via Google rather than a wrong password.
  const check = await checkExistingProvider(email);
  if (check.exists && check.provider === "google") {
    throw new Error(
      `This email is registered via ${providerLabel(check.provider)}. Use "Authenticate with Google" instead.`,
    );
  }
  throw new Error(error.message);
}

async function signupWithEmail(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<void> {
  setGuestMode(false);

  // Block signup up front if this email is already registered via a
  // different method — otherwise Supabase would create a second, separate
  // account for the same person.
  const check = await checkExistingProvider(email);
  if (check.exists && check.provider && check.provider !== "email") {
    throw new Error(
      `This email is already registered via ${providerLabel(check.provider)}. Sign in that way instead.`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) throw new Error(error.message);
}

export function useAuth() {
  const queryClient = useQueryClient();

  // Keep react-query's cached user in sync with Supabase auth state
  // changes (e.g. session refresh, sign-out in another tab).
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const guestLoginMutation = useMutation({
    mutationFn: loginAsGuest,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      window.location.href = "/dashboard";
    },
  });

  const emailLoginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginWithEmail(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const emailSignupMutation = useMutation({
    mutationFn: ({
      email,
      password,
      firstName,
      lastName,
    }: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => signupWithEmail(email, password, firstName, lastName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const googleLoginMutation = useMutation({
    mutationFn: loginWithGoogle,
  });

  const requestPasswordResetMutation = useMutation({
    mutationFn: requestPasswordReset,
  });

  const updatePasswordMutation = useMutation({
    mutationFn: updatePassword,
  });

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          showOnboarding: user.showOnboarding,
          provider: user.provider,
        }
      : null,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    deleteAccount: deleteAccountMutation.mutate,
    isDeletingAccount: deleteAccountMutation.isPending,
    deleteAccountError: deleteAccountMutation.error,
    loginAsGuest: guestLoginMutation.mutate,
    isGuestLoggingIn: guestLoginMutation.isPending,
    loginWithEmail: emailLoginMutation.mutate,
    isEmailLoggingIn: emailLoginMutation.isPending,
    signupWithEmail: emailSignupMutation.mutate,
    isEmailSigningUp: emailSignupMutation.isPending,
    loginWithGoogle: googleLoginMutation.mutate,
    isGoogleLoggingIn: googleLoginMutation.isPending,
    requestPasswordReset: requestPasswordResetMutation.mutate,
    isRequestingPasswordReset: requestPasswordResetMutation.isPending,
    requestPasswordResetError: requestPasswordResetMutation.error,
    updatePassword: updatePasswordMutation.mutate,
    isUpdatingPassword: updatePasswordMutation.isPending,
    updatePasswordError: updatePasswordMutation.error,
  };
}
