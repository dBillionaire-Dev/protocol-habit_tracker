"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Share2, Check, Gift, Lock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutShell } from "@/components/layout-shell";
import { useReferralStats } from "@/hooks/use-referrals";
import { planDisplayName } from "@/lib/entitlements";
import { toast } from "@/hooks/use-toast";

export default function ReferralsPage() {
  const { data, isLoading, error } = useReferralStats();
  const [copied, setCopied] = useState(false);
  const isLocked = (error as (Error & { code?: string }) | null)?.code === "FEATURE_LOCKED";

  // Spec section 12: "the referral share button should actually open
  // sharing options... [fallback] copy the referral link to the
  // clipboard, show a success toast/message." The button already used
  // the real Web Share API with a clipboard fallback, so it was never
  // decorative — but the fallback path gave NO visible feedback when
  // clicked from the Share button specifically (only the separate Copy
  // button's own icon flipped to a checkmark, which someone who clicked
  // Share, not Copy, could easily miss entirely), and clipboard writes
  // had no error handling at all. Both fixed below with an explicit toast
  // and a try/catch.
  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "✓ Referral link copied" });
    } catch {
      toast({
        title: "Couldn't copy the link",
        description: "Select and copy it manually from the box above.",
        variant: "destructive",
      });
    }
  }

  async function handleShare() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "PROTOCOL",
          // The link is embedded in `text` too, not just passed via
          // `url` — some share targets (many messaging apps' share
          // intents in particular) only surface one of the two
          // depending on their own implementation, so relying on `url`
          // alone risks the recipient never seeing the link at all.
          text: `I've been using PROTOCOL to stay disciplined, join me: ${data.referralLink}`,
          url: data.referralLink,
        });
      } catch (err) {
        // AbortError means the user closed the native share sheet
        // themselves — not an error worth surfacing. Anything else
        // (e.g. a share target rejecting the payload) falls back to
        // clipboard so the action still does SOMETHING rather than
        // silently failing.
        if (err instanceof Error && err.name === "AbortError") return;
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }

  if (isLocked) {
    return (
      <LayoutShell>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">Create an account to refer friends</h1>
          <Button asChild>
            <Link href="/">Sign Up</Link>
          </Button>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" />
            Refer & Earn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite friends to PROTOCOL. When they join and stick with it, you earn free access.
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {data && (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">Your referral link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted rounded-md px-3 py-2 truncate">
                    {data.referralLink}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total invited" value={String(data.totalInvited)} />
              <StatCard label="Signed up" value={String(data.signedUp)} />
              <StatCard label="Qualified" value={String(data.qualified)} />
              <StatCard label="Upgraded" value={String(data.paidConversions)} />
            </div>

            {data.bonusPlan && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Gift className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-sm">
                    You have <span className="font-semibold">{planDisplayName(data.bonusPlan)}</span> access
                    from referral rewards, {data.bonusDaysRemaining} day{data.bonusDaysRemaining !== 1 ? "s" : ""} remaining.
                  </p>
                </CardContent>
              </Card>
            )}

            {data.nextMilestone && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Next reward
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    Get {data.nextMilestone.qualifiedNeeded - data.qualified} more qualified referral
                    {data.nextMilestone.qualifiedNeeded - data.qualified !== 1 ? "s" : ""} to earn{" "}
                    <span className="font-semibold">{data.nextMilestone.days} days of Pro</span>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A referral qualifies once your friend creates their first protocol.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p>1. Share your link, anyone who signs up through it is credited to you.</p>
                <p>2. Once they create their first protocol, the referral qualifies.</p>
                <p>3. If they later upgrade to Pro or Premium Plus, you get 1 month free of that same tier.</p>
                <p>4. Reach 3 or 10 qualified referrals for bonus Pro time on top.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </LayoutShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <span className="text-xl font-mono font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}
