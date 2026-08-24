"use client";

import { useState } from "react";
import { Users, Flame, Check, X, Loader2, Clock, ArrowRight } from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useHabits } from "@/hooks/use-habits";
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

// Spec section 18. SCOPE (see the habitPartnerships table comment in
// shared/schema.ts for the full reasoning): Build habits only, each
// side links one of their own pre-existing habits — nothing is cloned
// or auto-created, so individual streaks/debt/history are completely
// unaffected by any of this.
export default function PartnersPage() {
  const { data: billing } = useBillingStatus();
  const { data: partnerships, isLoading } = usePartnerships();
  const [acceptDialogFor, setAcceptDialogFor] = useState<PartnershipView | null>(null);

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

        {partnerships && <PartnershipSections partnerships={partnerships} onAccept={(p) => setAcceptDialogFor(p)} />}
      </div>

      {acceptDialogFor && (
        <AcceptPartnershipDialog partnership={acceptDialogFor} onClose={() => setAcceptDialogFor(null)} />
      )}
    </LayoutShell>
  );
}

function PartnershipSections({
  partnerships,
  onAccept,
}: {
  partnerships: PartnershipView[];
  onAccept: (p: PartnershipView) => void;
}) {
  const { mutate: decline, isPending: isDeclining } = useDeclinePartnership();
  const { mutate: cancel, isPending: isCancelling } = useCancelPartnership();
  const { mutate: end, isPending: isEnding } = useEndPartnership();

  const accepted = partnerships.filter((p) => p.status === "accepted");
  const pending = partnerships.filter((p) => p.status === "pending");
  const past = partnerships.filter((p) => ["declined", "cancelled", "ended"].includes(p.status));

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
                onAccept={() => onAccept(p)}
                onDecline={() => decline(p.id)}
                onCancel={() => cancel(p.id)}
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
  isBusy,
}: {
  partnership: PartnershipView;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
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
      <PendingActions onAccept={onAccept} onDecline={onDecline} onCancel={onCancel} isBusy={isBusy} />
    </div>
  );
}

// Whether the current viewer is the one who SENT this invite (can only
// cancel) or the one who RECEIVED it (can accept/decline) is resolved
// server-side by each route's own ownership check (only the initiator
// can cancel; only the invited partner can accept/decline) — a mis-click
// on the wrong action simply gets a clear error back rather than
// silently doing the wrong thing, so showing all three actions here is
// safe.
function PendingActions({
  onAccept,
  onDecline,
  onCancel,
  isBusy,
}: {
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAccept} disabled={isBusy}>
        <Check className="w-3 h-3 mr-1" />
        Accept
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onDecline} disabled={isBusy}>
        <X className="w-3 h-3 mr-1" />
        Decline
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onCancel} disabled={isBusy}>
        Cancel
      </Button>
    </div>
  );
}

function AcceptPartnershipDialog({ partnership, onClose }: { partnership: PartnershipView; onClose: () => void }) {
  const { data: habits } = useHabits();
  const { mutate: accept, isPending, error } = useAcceptPartnership();
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");

  const buildHabits = (habits ?? []).filter((h) => h.type === "build");

  function handleAccept() {
    if (!selectedHabitId) return;
    accept(
      { id: partnership.id, habitId: Number(selectedHabitId) },
      {
        onSuccess: () => {
          toast({ title: "✓ Streak partnership started" });
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Accept streak partnership</DialogTitle>
          <DialogDescription>
            Choose one of your own Build protocols to link. Your streak and history stay entirely
            your own — only the shared streak is derived from both.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {buildHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't have any Build protocols yet — create one first, then come back to accept.
            </p>
          ) : (
            <Select value={selectedHabitId} onValueChange={setSelectedHabitId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a protocol" />
              </SelectTrigger>
              <SelectContent>
                {buildHabits.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error && <p className="text-sm text-destructive mt-2">{error instanceof Error ? error.message : ""}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAccept} disabled={!selectedHabitId || isPending}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
