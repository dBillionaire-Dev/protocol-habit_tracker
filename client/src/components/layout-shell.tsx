"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Shield, Trash2, Loader2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isGuest = user?.provider === "guest";
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
                  <p className="text-sm font-medium leading-none truncate">{displayName}</p>
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
