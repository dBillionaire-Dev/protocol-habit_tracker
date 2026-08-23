"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut, Shield, Trash2, Loader2, User as UserIcon, Crown, Sparkles,
  FlaskConical, HelpCircle, Menu, LayoutDashboard, BarChart3, History as HistoryIcon,
  Sparkle, Users, KeyRound, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useBillingStatus, useSetPreviewPlan } from "@/hooks/use-billing";
import { planDisplayName, isPaidPlan } from "@/lib/entitlements";
import { ManageSubscriptionDialog } from "@/components/manage-subscription-dialog";
import { NotificationSettingsDialog } from "@/components/notification-settings-dialog";
import { EnableNotificationsBanner } from "@/components/enable-notifications-banner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useConfirmationWindowForegroundNotify } from "@/hooks/use-confirmation-window-notify";
import { useNotificationPermission } from "@/hooks/use-push-notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getPendingReferralCode, clearPendingReferralCode } from "@/lib/referral-capture";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
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

// Same 6 links as the desktop nav below (kept as a separate, explicit
// list rather than sharing markup, since the desktop version renders
// inline `<Link>`s styled for a horizontal bar and this renders full-width
// rows with icons — different enough visually that a shared array of
// plain {href,label} pairs is clearer than forcing one markup template to
// serve both).
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/ai", label: "AI", icon: Sparkle },
  { href: "/referrals", label: "Referrals", icon: Users },
] as const;

export function LayoutShell({ children }: LayoutShellProps) {
  const { user, logout, deleteAccount, isDeletingAccount, deleteAccountError } = useAuth();
  const { data: billing } = useBillingStatus();
  const { mutate: setPreviewPlan, isPending: isSettingPreview } = useSetPreviewPlan();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [manageSubOpen, setManageSubOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pathname = usePathname();

  const isGuest = user?.provider === "guest";
  const plan = billing?.plan ?? "free";
  const isPaid = isPaidPlan(plan);
  const isSuperUser = billing?.isSuperUser ?? false;

  // Singleton — see the hook's own comment for why this must be called
  // exactly once, here, rather than inside HabitCard/DayConfirmationCard.
  useConfirmationWindowForegroundNotify();
  const isPreviewing = isSuperUser && !!billing?.previewPlan;

  // Attempts to attribute a pending ?ref= code (captured on the landing
  // page) once the user is confirmed logged in with a real account.
  // Safe to fire on every mount across every page — the server-side
  // attribution is idempotent (only ever applies once per account), and
  // this clears local storage after a definitive response so it stops
  // retrying once resolved.
  const attributionAttempted = useRef(false);
  useEffect(() => {
    if (isGuest || !user || attributionAttempted.current) return;
    const code = getPendingReferralCode();
    if (!code) return;

    attributionAttempted.current = true;
    apiFetch("/api/referrals/attribute", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then(() => clearPendingReferralCode())
      .catch(() => {
        // Leave the code in storage to retry on a future mount rather
        // than silently losing it on a transient network error.
        attributionAttempted.current = false;
      });
  }, [isGuest, user]);
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
              <Link
                href="/referrals"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Refer
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-1">
            {/* Mobile hamburger — spec section 10. Desktop nav above is
                `hidden sm:flex`, which means below that breakpoint it was
                simply invisible with NO alternative access at all: mobile
                users had no way to reach Analytics, History, AI, or
                Referrals except by typing the URL directly. This is the
                fix, not just a cosmetic addition. `sm:hidden` mirrors the
                desktop nav's own breakpoint so exactly one of the two is
                ever visible at a time. */}
            {!isGuest && user && (
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    aria-label="Open navigation menu"
                    data-testid="button-mobile-menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      PROTOCOL
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 mt-4" aria-label="Main navigation">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-border/40">
                    {!isPaid && (
                      <Link
                        href="/pricing"
                        onClick={() => setMobileNavOpen(false)}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        Upgrade Plan
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setMobileNavOpen(false);
                        setManageSubOpen(true);
                      }}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Crown className="w-4 h-4" />
                      Manage Subscription
                    </button>
                    <button
                      onClick={() => {
                        setMobileNavOpen(false);
                        setNotificationsOpen(true);
                      }}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Bell className="w-4 h-4" />
                      Notifications
                    </button>
                    <Link
                      href="/support"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Support
                    </Link>
                    <button
                      onClick={() => {
                        setMobileNavOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
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
              {!isGuest && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setManageSubOpen(true);
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
              {/* Spec section 14: only email/password accounts have a
                  Protocol-side password to change — Google accounts
                  authenticate entirely through Google and have nothing
                  here to update. Guests have no real account at all. */}
              {!isGuest && user?.provider === "email" && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setChangePasswordOpen(true);
                  }}
                  data-testid="menu-item-change-password"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Change Password
                </DropdownMenuItem>
              )}
              {!isGuest && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setNotificationsOpen(true);
                  }}
                  data-testid="menu-item-notifications"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </DropdownMenuItem>
              )}
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
          </div>

          <ManageSubscriptionDialog open={manageSubOpen} onOpenChange={setManageSubOpen} />

          <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

          <NotificationSettingsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />

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

      <OfflineIndicator />

      {/* Main Content */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        <EnableNotificationsBanner onOpenSettings={() => setNotificationsOpen(true)} />
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

const MIN_PASSWORD_LENGTH = 8;

// Spec section 14's "Change Password" — for an already-signed-in
// email/password user, distinct from the forgot-password flow (which
// covers someone who's locked out and has no active session at all).
// Calls the same useAuth().updatePassword mutation (Supabase's
// updateUser({password}) just needs an active session either way, and
// this dialog's user already has one).
function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { updatePassword, isUpdatingPassword, updatePasswordError } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  function handleSubmit() {
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
      onSuccess: () => {
        setPassword("");
        setConfirmPassword("");
        onOpenChange(false);
        toast({ title: "✓ Password updated" });
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPassword("");
          setConfirmPassword("");
          setFormError("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Change Password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          {(formError || updatePasswordError) && (
            <p className="text-sm text-destructive">
              {formError || (updatePasswordError instanceof Error ? updatePasswordError.message : "")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdatingPassword}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdatingPassword || !password || !confirmPassword}>
            {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Update Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
