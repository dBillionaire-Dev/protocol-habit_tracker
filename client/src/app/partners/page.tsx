"use client";

import { Users, Flame, Check, X, Loader2, Clock } from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useBillingStatus } from "@/hooks/use-billing";
import { hasFeature } from "@/lib/entitlements";
import {
  usePartnerships,
  useAcceptPartnership,
  useDeclinePartnership,
  useCancelPartnership,
  useEndPartnership,
  type PartnershipView,
} from "@/hooks/use-partnerships";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PartnersPage() {
  const { data: billing } = useBillingStatus();
  const { data: partnerships, isLoading } = usePartnerships();

  const hasAccess = hasFeature(billing?.plan ?? "free", "streak_partners");

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" />
            Streak Partners
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Team up on a Build protocol — your shared streak only grows on days you both show up.
          </p>
        </div>

        {!hasAccess && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 text-sm">
              Streak Partners is a Pro and Premium Plus feature.{" "}
              <a href="/pricing" className="underline underline-offset-2 font-medium">
                See plans
              </a>
              .
            </CardContent>
          </Card>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {partnerships && <PartnershipSections partnerships={partnerships} />}
      </div>
    </LayoutShell>
  );
}

function PartnershipSections({ partnerships }: { partnerships: PartnershipView[] }) {
  const { mutate: accept, isPending: isAccepting, variables: acceptingId } = useAcceptPartnership();
  const { mutate: decline, isPending: isDeclining } = useDeclinePartnership();
  const { mutate: cancel, isPending: isCancelling } = useCancelPartnership();
  const { mutate: end, isPending: isEnding } = useEndPartnership();

  const accepted = partnerships.filter((p) => p.status === "accepted");
  const pending = partnerships.filter((p) => p.status === "pending");
  const past = partnerships.filter((p) => ["declined", "cancelled", "ended"].includes(p.status));

  function handleAccept(p: PartnershipView) {
    accept(p.id, {
      onSuccess: () => {
        toast({
          title: "✓ Streak partnership started",
          description: `"${p.initiatorHabitName}" was added to your protocols, synced with theirs.`,
        });
      },
    });
  }

  if (partnerships.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No streak partners yet. Invite someone from a Build protocol's menu on your dashboard.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {accepted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {accepted.map((p) => (
              <ActivePartnershipCard key={p.id} partnership={p} onEnd={() => end(p.id)} isEnding={isEnding} />
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <PendingPartnershipRow
                key={p.id}
                partnership={p}
                onAccept={() => handleAccept(p)}
                onDecline={() => decline(p.id)}
                onCancel={() => cancel(p.id)}
                isAccepting={isAccepting && acceptingId === p.id}
                isBusy={isDeclining || isCancelling}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past</h2>
          <div className="space-y-2">
            {past.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3 text-sm text-muted-foreground">
                <span>
                  {p.initiatorHabitName} — {p.status}
                </span>
                <span className="text-xs">{p.respondedAt ? formatDate(p.respondedAt) : p.endedAt ? formatDate(p.endedAt) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActivePartnershipCard({
  partnership,
  onEnd,
  isEnding,
}: {
  partnership: PartnershipView;
  onEnd: () => void;
  isEnding: boolean;
}) {
  const p = partnership;
  return (
    <Card className={!p.sharedTrackingActive ? "opacity-60" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Flame className={p.currentSharedStreak > 0 ? "w-4 h-4 text-emerald-500" : "w-4 h-4 text-muted-foreground"} />
            {p.currentSharedStreak}-day shared streak
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={onEnd} disabled={isEnding}>
            {isEnding ? <Loader2 className="w-3 h-3 animate-spin" /> : "End"}
          </Button>
        </CardTitle>
        <CardDescription>
          {p.initiatorHabitName}
          {p.partnerHabitName && p.partnerHabitName !== p.initiatorHabitName ? ` / ${p.partnerHabitName}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!p.sharedTrackingActive && (
          <p className="text-xs text-amber-500">
            Paused — both people need an active Pro or Premium Plus plan for shared tracking to run.
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">You</span>
          <span className={p.initiatorCompletedToday ? "text-emerald-500" : "text-muted-foreground"}>
            {p.initiatorCompletedToday ? "Done today" : "Not yet today"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{p.partnerEmail}</span>
          <span className={p.partnerCompletedToday ? "text-emerald-500" : "text-muted-foreground"}>
            {p.partnerCompletedToday ? "Done today" : "Not yet today"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">Best: {p.bestSharedStreak} days</p>
      </CardContent>
    </Card>
  );
}

function PendingPartnershipRow({
  partnership,
  onAccept,
  onDecline,
  onCancel,
  isAccepting,
  isBusy,
}: {
  partnership: PartnershipView;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  isAccepting: boolean;
  isBusy: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3">
      <div className="flex items-center gap-3 text-sm">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <div>
          <p>
            <span className="font-medium">{partnership.initiatorHabitName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {partnership.initiatorEmail} / {partnership.partnerEmail}
          </p>
        </div>
      </div>
      {/* Whether the current viewer is the one who SENT this invite
          (can only cancel) or the one who RECEIVED it (can accept/
          decline) is resolved server-side by each route's own ownership
          check — a mis-click on the wrong action simply gets a clear
          error back rather than silently doing the wrong thing, so
          showing all three actions here is safe. Accepting is now a
          single click — no habit-picker dialog — since
          storage.acceptPartnership auto-creates a matching habit for
          you (see that method's comment). */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAccept} disabled={isBusy || isAccepting}>
          {isAccepting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
          Accept
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onDecline} disabled={isBusy || isAccepting}>
          <X className="w-3 h-3 mr-1" />
          Decline
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onCancel} disabled={isBusy || isAccepting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
