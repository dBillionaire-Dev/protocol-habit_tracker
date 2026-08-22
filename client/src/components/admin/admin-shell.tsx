"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Link2,
  BarChart3,
  Ticket,
  Activity,
  ScrollText,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/referrals", label: "Referrals", icon: Link2 },
  { href: "/admin/habit-analytics", label: "Habit Analytics", icon: BarChart3 },
  { href: "/admin/support", label: "Support", icon: Ticket },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="font-mono text-xs tracking-widest text-muted-foreground">PROTOCOL</p>
          <p className="font-bold tracking-tight">Admin</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => {
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
          {adminEmail && <p className="px-3 py-1 text-xs text-muted-foreground truncate">{adminEmail}</p>}
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
