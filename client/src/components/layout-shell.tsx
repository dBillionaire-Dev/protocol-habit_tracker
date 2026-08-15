"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Shield, Trash2, Loader2, User as UserIcon, Crown, Sparkles, FlaskConical, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/hooks/use-auth";
import { useBillingStatus, useCancelSubscription, useSetPreviewPlan } from "@/hooks/use-billing";
import { planDisplayName, isPaidPlan } from "@/lib/entitlements";
import type { PlanTier } from "shared/schema";

interface LayoutShellProps {
  children: React.ReactNode;
}

function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const f = firstName?.trim()?.[0];
  const l = lastName?.trim()?.[0];
  if (f || l) return `${f ?? ""}${l ?? ""}`.toUpperCase();
  return email?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function LayoutShell({ children }: LayoutShellProps) {
  const { user, logout, deleteAccount, isDeletingAccount, deleteAccountError } = useAuth();
  const { data: billing } = useBillingStatus();
  const { mutate: cancelSubscription, isPending: isCancelling } = useCancelSubscription();
  const { mutate: setPreviewPlan, isPending: isSettingPreview } = useSetPreviewPlan();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isGuest = user?.provider === "guest";
  const plan = billing?.plan ?? "free";
  const isPaid = isPaidPlan(plan);
  const isSuperUser = billing?.isSuperUser ?? false;
  const isPreviewing = isSuperUser && !!billing?.previewPlan;
  const displayName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : isGuest
        ? "Guest"
        : user?.email ?? "Account";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-5 h-5" />
            <span>PROTOCOL</span>
          </Link>

          {!isGuest && user && (
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/history"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                History
              </Link>
              <Link
                href="/ai"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                AI
              </Link>
              <Link
                href="/support"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Support
              </Link>
            </nav>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                data-testid="button-profile-menu"
              >
                <Avatar className="h-8 w-8">
                  {user?.profileImageUrl ? (
                    <AvatarImage src={user.profileImageUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback>
                    {isGuest ? <UserIcon className="h-4 w-4" /> : initials(user?.firstName, user?.lastName, user?.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none truncate">{displayName}</p>
                    {isPaid && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        <Crown className="w-3 h-3" />
                        {planDisplayName(plan)}
                      </span>
                    )}
                    {isPreviewing && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
                        <FlaskConical className="w-3 h-3" />
                        Preview
                      </span>
                    )}
                  </div>
                  {!isGuest && user?.email && (
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                  {isGuest && (
                    <p className="text-xs leading-none text-muted-foreground">
                      Guest session, nothing here is saved to an account
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isSuperUser && (
                <>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal pb-0">
                    Preview as (testing only)
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={billing?.previewPlan ?? "live"}
                    onValueChange={(value) => setPreviewPlan(value === "live" ? null : (value as PlanTier))}
                  >
                    <DropdownMenuRadioItem value="live" disabled={isSettingPreview} data-testid="menu-preview-live">
                      Live (full access)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="free" disabled={isSettingPreview} data-testid="menu-preview-free">
                      Free
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="pro" disabled={isSettingPreview} data-testid="menu-preview-pro">
                      Pro
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="premium_plus" disabled={isSettingPreview} data-testid="menu-preview-premium-plus">
                      Premium Plus
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isGuest && !isPaid && (
                <DropdownMenuItem asChild data-testid="menu-item-upgrade">
                  <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Link>
                </DropdownMenuItem>
              )}
              {!isGuest && isPaid && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setCancelConfirmOpen(true);
                  }}
                  data-testid="menu-item-manage-subscription"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Manage Subscription
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild data-testid="menu-item-support">
                <Link href="/support" onClick={() => setMenuOpen(false)}>
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()} data-testid="menu-item-sign-out">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
              {!isGuest && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  data-testid="menu-item-delete-account"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Pro subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll keep Pro access until your current billing period
                  ends, then drop back to the free plan (3 active
                  protocols). Your existing protocols beyond the free
                  limit won't be deleted, but you won't be able to create
                  new ones until you're back under the limit or resubscribe.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCancelling}>Keep {planDisplayName(plan)}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    cancelSubscription(undefined, { onSuccess: () => setCancelConfirmOpen(false) });
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

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and every habit,
                  streak, and debt record attached to it. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteAccountError && (
                <p className="text-sm text-destructive">
                  {deleteAccountError.message}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingAccount}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    deleteAccount();
                  }}
                  disabled={isDeletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete account"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Preview mode banner — impossible to miss while testing as a
          different tier, so a super user never mistakes it for their
          real account state. */}
      {isPreviewing && (
        <div className="bg-purple-500/10 border-b border-purple-500/20 text-purple-400 text-sm py-2 text-center font-medium">
          <FlaskConical className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Previewing as {planDisplayName(billing?.previewPlan ?? "free")} — this is not your real plan
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 mt-auto">
        <div className="container max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground font-mono">
          DISCIPLINE EQUALS FREEDOM
        </div>
      </footer>
    </div>
  );
}
