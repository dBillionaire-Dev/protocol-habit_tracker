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

async function loginWithEmail(email: string, password: string): Promise<void> {
  setGuestMode(false);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

async function signupWithEmail(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<void> {
  setGuestMode(false);
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

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          showOnboarding: user.showOnboarding,
        }
      : null,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    loginAsGuest: guestLoginMutation.mutate,
    isGuestLoggingIn: guestLoginMutation.isPending,
    loginWithEmail: emailLoginMutation.mutate,
    isEmailLoggingIn: emailLoginMutation.isPending,
    signupWithEmail: emailSignupMutation.mutate,
    isEmailSigningUp: emailSignupMutation.isPending,
    loginWithGoogle: googleLoginMutation.mutate,
    isGoogleLoggingIn: googleLoginMutation.isPending,
  };
}
