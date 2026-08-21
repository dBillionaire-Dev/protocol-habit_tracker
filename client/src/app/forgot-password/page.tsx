"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

// Spec section 14: Forgot Password entry point — email in, Supabase Auth
// sends the reset link (see requestPasswordReset in hooks/use-auth.ts).
// Never reveals whether the email is actually registered (same message
// either way) — confirming account existence via a password-reset form
// is a common account-enumeration vector, and Supabase's own
// resetPasswordForEmail already behaves this way (it doesn't error on an
// unknown email), so this just doesn't contradict that by branching UI
// on it.
export default function ForgotPasswordPage() {
  const { requestPasswordReset, isRequestingPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    requestPasswordReset(email, {
      onSuccess: () => setSubmitted(true),
      onError: () => {
        // Deliberately generic — see the file-level comment on why this
        // never differs based on whether the email exists.
        setSubmitted(true);
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Shield className="w-8 h-8 mx-auto" />
          <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email on your account and we'll send a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="text-foreground">{email}</span>, a reset
              link is on its way. Check your inbox (and spam folder).
            </p>
            <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
              Send another link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={isRequestingPasswordReset}>
              {isRequestingPasswordReset ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Reset Link
            </Button>
          </form>
        )}

        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
