"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBillingStatus, useStartCheckout, useStartTrial } from "@/hooks/use-billing";
import { DISPLAY_PRICING, formatNaira } from "@/lib/paystack/plans";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/trial-banner";
import { toast } from "@/hooks/use-toast";
import { TRIAL_CONFIG, type TrialType } from "shared/schema";

type Interval = "monthly" | "annual";

const FEATURES: Record<"free" | "pro" | "premium_plus", string[]> = {
  free: [
    "3 protocols total",
    "Debt & streak tracking",
    "Daily confirmation window",
  ],
  pro: [
    "Unlimited protocols",
    "Everything in Free",
    "Priority on new features",
  ],
  premium_plus: [
    "Everything in Pro",
    "AI-powered insights (coming soon)",
    "AI support chat (coming soon)",
  ],
};

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const { data: billing } = useBillingStatus();
  const { mutate: startCheckout, isPending, variables } = useStartCheckout();
  const { mutate: startTrial, isPending: isTrialPending, variables: trialVariables } = useStartTrial();

  const currentPlan = billing?.plan ?? "free";
  const eligibleTrials = new Set(billing?.eligibleTrials ?? []);
  // Only one trial can run at a time — while one is active, don't offer
  // to start a different one (starting a second would just be rejected
  // server-side; hiding the button here is the friendlier UX).
  const canStartAnyTrial = !billing?.activeTrial;

  function handleStartTrial(trialType: TrialType) {
    startTrial(trialType, {
      onSuccess: (data) => {
        toast({
          title: "✓ Trial started",
          description: `Your ${TRIAL_CONFIG[trialType].days}-day trial ends ${new Date(data.endsAt).toLocaleDateString()}.`,
        });
      },
      onError: (err) => {
        toast({ title: "Couldn't start trial", description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-5 h-5" />
            <span>PROTOCOL</span>
          </Link>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-12">
        {billing?.activeTrial && (
          <TrialBanner
            trial={billing.activeTrial}
            onUpgrade={() =>
              startCheckout({
                tier: billing.activeTrial!.grantsPlan as "pro" | "premium_plus",
                interval,
              })
            }
            isUpgradePending={isPending}
          />
        )}

        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="text-muted-foreground">Prices in NGN. Cancel anytime.</p>

          <div className="inline-flex items-center gap-1 bg-muted rounded-lg p-1 mt-4">
            <button
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                interval === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                interval === "annual" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
              onClick={() => setInterval("annual")}
            >
              Annual <span className="text-emerald-500 font-semibold">BEST VALUE</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <Card className={cn(currentPlan === "free" && "border-primary")}>
            <CardHeader>
              <CardTitle className="text-lg">Free</CardTitle>
              <p className="text-3xl font-mono font-bold">₦0</p>
              <p className="text-xs text-muted-foreground">forever</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {FEATURES.free.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {currentPlan === "free" ? (
                <Button className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  Included
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className={cn(currentPlan === "pro" && "border-primary")}>
            <CardHeader>
              <CardTitle className="text-lg">Pro</CardTitle>
              <p className="text-3xl font-mono font-bold">
                {formatNaira(DISPLAY_PRICING.pro[interval])}
              </p>
              <p className="text-xs text-muted-foreground">
                per {interval === "monthly" ? "month" : "year"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {FEATURES.pro.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {currentPlan === "pro" ? (
                <Button className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => startCheckout({ tier: "pro", interval })}
                    disabled={isPending}
                  >
                    {isPending && variables?.tier === "pro" ? "Redirecting..." : "Choose Pro"}
                  </Button>
                  {canStartAnyTrial && eligibleTrials.has("pro_from_free") && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleStartTrial("pro_from_free")}
                      disabled={isTrialPending}
                    >
                      {isTrialPending && trialVariables === "pro_from_free"
                        ? "Starting..."
                        : `Try free for ${TRIAL_CONFIG.pro_from_free.days} days`}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Premium Plus */}
          <Card className={cn(currentPlan === "premium_plus" && "border-primary", "border-amber-500/30")}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Premium Plus
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  AI
                </span>
              </CardTitle>
              <p className="text-3xl font-mono font-bold">
                {formatNaira(DISPLAY_PRICING.premium_plus[interval])}
              </p>
              <p className="text-xs text-muted-foreground">
                per {interval === "monthly" ? "month" : "year"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {FEATURES.premium_plus.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {currentPlan === "premium_plus" ? (
                <Button className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() => startCheckout({ tier: "premium_plus", interval })}
                    disabled={isPending}
                  >
                    {isPending && variables?.tier === "premium_plus" ? "Redirecting..." : "Choose Premium Plus"}
                  </Button>
                  {canStartAnyTrial && eligibleTrials.has("premium_plus_from_free") && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleStartTrial("premium_plus_from_free")}
                      disabled={isTrialPending}
                    >
                      {isTrialPending && trialVariables === "premium_plus_from_free"
                        ? "Starting..."
                        : `Try free for ${TRIAL_CONFIG.premium_plus_from_free.days} days`}
                    </Button>
                  )}
                  {canStartAnyTrial && eligibleTrials.has("premium_plus_from_pro") && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleStartTrial("premium_plus_from_pro")}
                      disabled={isTrialPending}
                    >
                      {isTrialPending && trialVariables === "premium_plus_from_pro"
                        ? "Starting..."
                        : `Try free for ${TRIAL_CONFIG.premium_plus_from_pro.days} days`}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
