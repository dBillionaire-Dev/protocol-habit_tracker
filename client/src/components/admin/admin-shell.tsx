"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Users,
  CreditCard,
  Link2,
  BarChart3,
  Ticket,
  Activity,
  ScrollText,
  ShieldCheck,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// anyAdmin: true = both Super Admin and Support Admin can see this link.
// Anything without it is Super Admin-only (matches the server-side gate
// on the route/page itself -- this list only controls what's *shown*,
// the real enforcement lives in lib/admin/guard.ts).
const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, anyAdmin: true },
  { href: "/admin/users", label: "Users", icon: Users, anyAdmin: true },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/referrals", label: "Referrals", icon: Link2 },
  { href: "/admin/habit-analytics", label: "Habit Analytics", icon: BarChart3 },
  { href: "/admin/support", label: "Support", icon: Ticket, anyAdmin: true },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
};

export function AdminShell({
  adminEmail,
  adminRole,
  children,
}: {
  adminEmail: string | null;
  adminRole?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on every navigation so it doesn't stay open after
  // tapping a link on a small screen.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const visibleNav = NAV.filter((item) => adminRole === "super_admin" || item.anyAdmin);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile top bar -- hidden at lg and above, where the sidebar is
          always visible as a normal static column instead. */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-border bg-background flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-700" data-app-logo-icon />
          <span className="font-bold tracking-tight text-sm">PROTOCOL Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-56 shrink-0 border-r border-border flex flex-col bg-background",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-700" data-app-logo-icon />
            <span className="font-bold tracking-tight">PROTOCOL</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Admin</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border space-y-1">
          {adminEmail && (
            <div className="px-3 py-1">
              <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
              {adminRole && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {ROLE_LABELS[adminRole] ?? adminRole}
                </p>
              )}
            </div>
          )}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 pt-20 lg:p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
