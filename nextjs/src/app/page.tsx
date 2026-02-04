"use client";

import { useState } from "react";
import { Shield, Lock, Activity, TrendingUp, User, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const { loginAsGuest, isGuestLoggingIn, loginWithGoogle, isGoogleLoggingIn } = useAuth();
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Import dynamically to avoid circular dependencies
      const response = await fetch("/api/auth/email/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Authentication failed");
      }

      // If login (not signup), use login endpoint
      if (!isSignUp) {
        const loginResponse = await fetch("/api/auth/email/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        if (!loginResponse.ok) {
          const error = await loginResponse.json();
          throw new Error(error.message || "Login failed");
        }
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError("");
    loginWithGoogle();
  };

  const handleGuestLogin = () => {
    setError("");
    loginAsGuest();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel: Branding */}
      <div className="lg:w-1/2 bg-zinc-950 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-red-500 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8" />
            <span className="text-xl font-bold tracking-widest">PROTOCOL</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.1]">
            DISCIPLINE<br />IS NOT A<br />GAME.
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            A serious framework for tracking habits. 
            Accumulate debt for failures. 
            Stack penalties for missed targets. 
            Accountability is the only metric that matters.
          </p>
        </div>

        <div className="relative z-10 mt-12 grid grid-cols-2 gap-8 text-sm font-mono text-zinc-500">
          <div>
            <p className="text-white mb-2 font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" /> 
              AVOIDANCE DEBT
            </p>
            Bad habits aren't just reset. They accrue debt that must be paid down.
          </div>
          <div>
            <p className="text-white mb-2 font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              PENALTY STACKING
            </p>
            Miss a daily task? Tomorrow it gets harder. The standard increases until you execute.
          </div>
        </div>
      </div>

      {/* Right Panel: Auth */}
      <div className="lg:w-1/2 bg-background p-8 lg:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Access Terminal</h2>
            <p className="text-muted-foreground">Identify yourself to access your protocols.</p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-4">
            {/* Google Sign In */}
            <Button 
              className="w-full h-12 text-base bg-white hover:bg-gray-100 text-black border border-gray-300 shadow-sm"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoggingIn}
            >
              {isGoogleLoggingIn ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Authenticate with Google
            </Button>

            {/* Replit Sign In */}
            <Button className="w-full h-12 text-base shadow-lg" asChild>
              <a href="/api/login">
                <Lock className="w-4 h-4 mr-2" />
                Authenticate with Replit
              </a>
            </Button>

                        {/* Email/Password Toggle */}
            <Button 
              variant="outline" 
              className="w-full h-12 text-base"
              onClick={() => {
                setShowAuthForm(!showAuthForm);
                setIsSignUp(false);
                setError("");
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              {showAuthForm ? "Back" : "Continue with Email"}
            </Button>

            {/* Email/Password Form */}
            {showAuthForm && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                {isSignUp && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <Button type="submit" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {isSignUp ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setIsSignUp(false)}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Don't have an account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setIsSignUp(true)}
                      >
                        Sign up
                      </button>
                    </>
                  )}
                </p>
              </form>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Guest Mode */}
            <Button 
              variant="ghost" 
              className="w-full h-12 text-muted-foreground"
              onClick={handleGuestLogin}
              disabled={isGuestLoggingIn}
            >
              {isGuestLoggingIn ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              Continue as Guest
            </Button>
            
            <p className="text-xs text-center text-muted-foreground px-8">
              By authenticating, you agree to accept full responsibility for your actions and inactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
