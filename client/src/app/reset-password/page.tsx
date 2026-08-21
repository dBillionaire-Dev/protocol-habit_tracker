"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

// Spec section 14: the last two steps of the flow ("Set new password" ->
// "Success" -> "Sign in"). By the time this page loads, /auth/callback
// has already exchanged the recovery link's code for a session (see that
// route) — so `user` being present here (via useAuth's underlying
// /api/auth/user check, which reads that same session cookie) IS the
// signal that this is a valid, still-active recovery link. No separate
// token-validity check needed on this page.
export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, isLoading, updatePassword, isUpdatingPassword, updatePasswordError } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "invalid_or_expired_link") {
      setLinkInvalid(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // If the callback redirect didn't carry an explicit error but there's
  // still no session by the time loading settles, treat it the same way
  // — covers a code that failed to exchange for any other reason.
  useEffect(() => {
    if (!isLoading && !user && !linkInvalid) {
      setLinkInvalid(true);
    }
  }, [isLoading, user, linkInvalid]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }

    updatePassword(password, {
      onSuccess: async () => {
        // Explicit "Success -> Sign in" step per the spec's flow — sign
        // out the temporary recovery session so the person consciously
        // signs back in with their new password, rather than silently
        // staying logged in via the recovery link's session.
        await createClient().auth.signOut();
        setSuccess(true);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Shield className="w-8 h-8 mx-auto" />
          <h1 className="text-xl font-bold tracking-tight">
            {success ? "Password updated" : "Set a new password"}
          </h1>
        </div>

        {linkInvalid && !success ? (
          <div className="space-y-4 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Button asChild className="w-full h-11">
              <a href="/forgot-password">Request a new link</a>
            </Button>
          </div>
        ) : success ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Your password has been updated. Sign in with your new password to continue.
            </p>
            <Button className="w-full h-11" onClick={() => router.push("/")}>
              Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            {(formError || updatePasswordError) && (
              <p className="text-sm text-destructive">
                {formError || (updatePasswordError instanceof Error ? updatePasswordError.message : "")}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={isUpdatingPassword}>
              {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
