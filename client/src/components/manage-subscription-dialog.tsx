"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Loader2, Sparkles, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBillingStatus, useCancelSubscription, useStartCheckout } from "@/hooks/use-billing";
import { planDisplayName } from "@/lib/entitlements";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// Spec section 4: the previous "Manage Subscription" surface was really
// just a hardcoded "Cancel Pro subscription?" AlertDialog — it didn't
// know Premium Plus existed, didn't show renewal/expiry, and (a real bug
// found while fixing this) told the user they'd keep access until their
// billing period ended while the backend silently downgraded them to
// Free immediately. This is a proper Dialog now: current plan/status,
// active trial info, real renewal or grace-period-expiry date, and
// upgrade paths for every plan, including Premium Plus everywhere Pro
// used to be the only option handled.
//
// Uses the plain shadcn Dialog (not AlertDialog) as the outer surface
// specifically because DialogContent already ships a top-right close X,
// and Radix's Dialog already closes on Escape and on an outside click by
// default (see components/ui/dialog.tsx) — exactly what spec section 4's
// "Modal Close Button" subsection asks for. The destructive "confirm
// cancel" step nested inside deliberately stays an AlertDialog, since a
// destructive confirmation SHOULDN'T have an accidental-dismiss escape
// hatch — that distinction is intentional, not an oversight.
export function ManageSubscriptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: billing } = useBillingStatus();
  const { mutate: cancelSubscription, isPending: isCancelling } = useCancelSubscription();
  const { mutate: startCheckout, isPending: isCheckingOut, variables: checkoutVariables } = useStartCheckout();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  if (!billing) return null;

  const { plan, realPlan, status, currentPeriodEnd, cancelAtPeriodEnd, billingInterval, activeTrial } = billing;
  const isPaidRealPlan = realPlan === "pro" || realPlan === "premium_plus";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Manage Subscription
            </DialogTitle>
            <DialogDescription>Your current plan and billing status.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current plan + status */}
            <div className="rounded-lg border border-border/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{planDisplayName(realPlan)}</span>
                {isPaidRealPlan && billingInterval && (
                  <span className="text-xs text-muted-foreground capitalize">{billingInterval} billing</span>
                )}
              </div>
              {isPaidRealPlan && cancelAtPeriodEnd && currentPeriodEnd && (
                <p className="text-sm text-amber-500">
                  Cancels on {formatDate(currentPeriodEnd)} — you&apos;ll return to Free after that.
                </p>
              )}
              {isPaidRealPlan && !cancelAtPeriodEnd && status === "active" && currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">Renews on {formatDate(currentPeriodEnd)}.</p>
              )}
              {realPlan === "free" && (
                <p className="text-sm text-muted-foreground">
                  3 protocols, debt &amp; streak tracking, the daily confirmation window.
                </p>
              )}
              {status === "past_due" && (
                <p className="text-sm text-destructive">
                  Your last payment failed. Update your payment method to keep your plan.
                </p>
              )}
            </div>

            {/* Active trial (separate from the real plan above — see
                trial-banner.tsx for the same pattern used on /pricing) */}
            {activeTrial && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Trying {planDisplayName(activeTrial.grantsPlan)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Trial ends {formatDate(activeTrial.endsAt)}.{" "}
                  {activeTrial.returnsToPlan === "free"
                    ? "You'll return to Free unless you subscribe."
                    : `You'll return to ${planDisplayName(activeTrial.returnsToPlan)} unless you upgrade.`}
                </p>
              </div>
            )}

            {/* Upgrade paths — every plan below Premium Plus can upgrade */}
            <div className="space-y-2">
              {realPlan === "free" && (
                <>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => startCheckout({ tier: "pro", interval: "monthly" })}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut && checkoutVariables?.tier === "pro" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Upgrade to Pro
                  </Button>
                  <Button
                    className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => startCheckout({ tier: "premium_plus", interval: "monthly" })}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut && checkoutVariables?.tier === "premium_plus" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Upgrade to Premium Plus
                  </Button>
                </>
              )}
              {realPlan === "pro" && !cancelAtPeriodEnd && (
                <Button
                  className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => startCheckout({ tier: "premium_plus", interval: billingInterval ?? "monthly" })}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Upgrade to Premium Plus
                </Button>
              )}
              {realPlan === "free" && (
                <Link href="/pricing" onClick={() => onOpenChange(false)}>
                  <Button variant="ghost" className="w-full">See full plan comparison</Button>
                </Link>
              )}
            </div>

            {/* Cancel — the one supported "downgrade" path. We don't
                offer a direct Premium Plus -> Pro switch button: there's
                no seamless Paystack plan-change call wired up for that,
                and faking one that just cancels-then-hopes would be
                misleading. Cancelling (grace period to currentPeriodEnd)
                plus starting a fresh Pro checkout from /pricing covers
                the same outcome honestly. */}
            {isPaidRealPlan && !cancelAtPeriodEnd && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={() => setCancelConfirmOpen(true)}
              >
                Cancel subscription
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {planDisplayName(realPlan)} subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {currentPeriodEnd
                ? `You'll keep ${planDisplayName(realPlan)} access until ${formatDate(currentPeriodEnd)}, then drop back to the Free plan (3 active protocols).`
                : `You'll keep ${planDisplayName(realPlan)} access until your current billing period ends, then drop back to the Free plan (3 active protocols).`}{" "}
              Your existing protocols beyond the Free limit won&apos;t be deleted, but you won&apos;t
              be able to create new ones until you&apos;re back under the limit or resubscribe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep {planDisplayName(realPlan)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelSubscription(undefined, {
                  onSuccess: () => {
                    setCancelConfirmOpen(false);
                  },
                });
              }}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
