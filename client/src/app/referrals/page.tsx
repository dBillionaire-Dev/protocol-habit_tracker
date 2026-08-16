"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Share2, Check, Gift, Lock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutShell } from "@/components/layout-shell";
import { useReferralStats } from "@/hooks/use-referrals";
import { planDisplayName } from "@/lib/entitlements";

export default function ReferralsPage() {
  const { data, isLoading, error } = useReferralStats();
  const [copied, setCopied] = useState(false);
  const isLocked = (error as (Error & { code?: string }) | null)?.code === "FEATURE_LOCKED";

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "PROTOCOL",
          text: "I've been using PROTOCOL to stay disciplined, join me:",
          url: data.referralLink,
        });
      } catch {
        // user cancelled the share sheet — no-op
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
