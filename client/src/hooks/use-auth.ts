"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
  showOnboarding?: string;
}

async function fetchUser(attempt = 0): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fetchUser(1);
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }

  // Redirect to home
  window.location.href = "/";
}

async function loginAsGuest(): Promise<AuthUser> {
  const response = await fetch("/api/auth/guest", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to login as guest");
  }

  return response.json();
}

async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch("/api/auth/email/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  return response.json();
}

async function signupWithEmail(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<AuthUser> {
  const response = await fetch("/api/auth/email/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, firstName, lastName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Signup failed");
  }

  return response.json();
}

async function loginWithGoogle(): Promise<void> {
  window.location.href = "/api/auth/google";
}

export function useAuth() {
  const queryClient = useQueryClient();
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

      window.location.assign("/dashboard");
    },
  });

  const emailLoginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginWithEmail(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      window.location.assign("/dashboard");
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
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      window.location.assign("/dashboard");
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
