#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# PROTOCOL — 2-tier admin roles (Super Admin + Support Admin)
#
# Run from the ROOT of your protocol-habit_tracker checkout, AFTER
# protocol-admin-dashboard.sh AND protocol-admin-sidebar-branding.sh
# (this depends on files/props both of those add). Order relative to
# protocol-habit-analytics.sh and protocol-admin-nav-and-bugreport.sh
# doesn't matter.
#
# Adds:
#   - users.admin_role ("support_admin" | null). Super Admin is NEVER
#     written here -- it's always derived live from isSuperUser /
#     SUPER_USER_EMAILS, so the top tier can never be locked out by a bad
#     DB write.
#   - Support Admins can reach Overview, Users (read-only), and Support.
#     Everything else (Subscriptions, Referrals, Habit Analytics, System,
#     Audit Log, Admins) stays Super Admin-only and 401s/redirects for
#     Support Admins.
#   - /admin/admins -- Super Admin-only page to grant/revoke Support Admin
#   - Sidebar now only shows the sections the signed-in admin can reach
#   - The Suspend/Restore/Delete/Change-plan actions on a user's detail
#     page are hidden (not just blocked server-side) for Support Admins
#
# Next steps: pnpm db:push && pnpm install && pnpm dev
# ---------------------------------------------------------------------------

if [ ! -f "package.json" ] || [ ! -d "client" ] || [ ! -d "shared" ]; then
  echo "This doesn't look like the repo root (expected package.json, client/, shared/ here)."
  exit 1
fi
if ! grep -q "adminRole" client/src/components/admin/admin-shell.tsx 2>/dev/null; then
  echo "client/src/components/admin/admin-shell.tsx doesn't have the adminRole prop yet."
  echo "Run protocol-admin-dashboard.sh and protocol-admin-sidebar-branding.sh first."
  exit 1
fi

echo "Applying PROTOCOL admin roles update..."

PATCH_TMP="$(mktemp -d)"
trap 'rm -rf "$PATCH_TMP"' EXIT

patch_file() {
  local target="$1" old_file="$2" new_file="$3"
  node -e '
    const fs = require("fs");
    const [target, oldFile, newFile] = process.argv.slice(1);
    const content = fs.readFileSync(target, "utf8");
    const old = fs.readFileSync(oldFile, "utf8");
    const next = fs.readFileSync(newFile, "utf8");
    if (content.includes(next)) {
      console.log("Already applied, skipping: " + target);
      process.exit(0);
    }
    if (!content.includes(old)) {
      console.log("!! Could not find expected content in " + target + " -- skipping this patch.");
      console.log("!! Apply it by hand: see " + oldFile + " (find this) / " + newFile + " (replace with this).");
      process.exit(0);
    }
    fs.writeFileSync(target, content.split(old).join(next));
    console.log("Patched " + target);
  ' "$target" "$old_file" "$new_file"
}

# ---------------------------------------------------------------------------
# Patch: shared/models/auth.ts -- add admin_role column
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/auth_old.txt" << 'PROTOCOL_EOF'
  // Admin-controlled. Suspended users are blocked at resolveUser() --
  // their session still exists with Supabase, but every API route treats
  // them as unauthenticated. See lib/admin/storage.ts suspendUser/restoreUser.
  status: varchar("status", { enum: USER_STATUSES }).notNull().default("active"),
PROTOCOL_EOF
cat > "$PATCH_TMP/auth_new.txt" << 'PROTOCOL_EOF'
  // Admin-controlled. Suspended users are blocked at resolveUser() --
  // their session still exists with Supabase, but every API route treats
  // them as unauthenticated. See lib/admin/storage.ts suspendUser/restoreUser.
  status: varchar("status", { enum: USER_STATUSES }).notNull().default("active"),
  // Separate from isSuperUser (which only gates the existing plan-preview
  // feature). null = not an admin. This column NEVER holds "super_admin"
  // -- that tier is always derived live from isSuperUser / SUPER_USER_EMAILS
  // (see lib/admin/guard.ts), so the top tier can't be locked out by a bad
  // DB write. "support_admin" is DB-only, granted/revoked from /admin/admins.
  adminRole: varchar("admin_role", { enum: ADMIN_ROLES }),
PROTOCOL_EOF
patch_file "shared/models/auth.ts" "$PATCH_TMP/auth_old.txt" "$PATCH_TMP/auth_new.txt"

cat > "$PATCH_TMP/auth_const_old.txt" << 'PROTOCOL_EOF'
export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = typeof USER_STATUSES[number];
PROTOCOL_EOF
cat > "$PATCH_TMP/auth_const_new.txt" << 'PROTOCOL_EOF'
export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const ADMIN_ROLES = ["support_admin"] as const;
export type DbAdminRole = typeof ADMIN_ROLES[number];
PROTOCOL_EOF
patch_file "shared/models/auth.ts" "$PATCH_TMP/auth_const_old.txt" "$PATCH_TMP/auth_const_new.txt"

# ---------------------------------------------------------------------------
# Rewrite: lib/admin/guard.ts -- add role-aware admin context, keep
# requireAdmin (now "super_admin only") for backward compatibility with
# every route that already calls it
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/guard_old.txt" << 'PROTOCOL_EOF'
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";

/**
 * Resolves the current user AND checks they're a super user. Every
 * /api/admin/** route should call this first and 401 if it returns null.
 *
 * There's only one admin role today (super users, via SUPER_USER_EMAILS --
 * see require-user.ts). That's deliberate for now: finer-grained roles
 * (Support Admin, Analyst, etc.) are real product ideas but not worth
 * building until there's more than one admin. Add them here, not by
 * scattering new checks through individual routes.
 */
export async function requireAdmin(request: Request): Promise<ResolvedUser | null> {
  const user = await resolveUser(request);
  if (!user || !user.isSuperUser) return null;
  return user;
}
PROTOCOL_EOF
cat > "$PATCH_TMP/guard_new.txt" << 'PROTOCOL_EOF'
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { users } from "shared/schema";
import { eq } from "drizzle-orm";

export type AdminRole = "super_admin" | "support_admin";

export interface AdminContext {
  user: ResolvedUser;
  role: AdminRole;
}

/**
 * Effective admin role for the current request, or null if they aren't an
 * admin at all. "super_admin" is always derived live from isSuperUser
 * (env-controlled via SUPER_USER_EMAILS, see require-user.ts) -- never
 * read from the DB, so the top tier can't be locked out by a bad write.
 * users.admin_role in the DB only ever holds "support_admin".
 */
export async function getAdminContext(request: Request): Promise<AdminContext | null> {
  const user = await resolveUser(request);
  if (!user) return null;

  if (user.isSuperUser) {
    return { user, role: "super_admin" };
  }

  const [row] = await db.select({ adminRole: users.adminRole }).from(users).where(eq(users.id, user.id));
  if (row?.adminRole === "support_admin") {
    return { user, role: "support_admin" };
  }
  return null;
}

/** Either admin tier -- use for sections both roles can reach. */
export async function requireAnyAdmin(request: Request): Promise<AdminContext | null> {
  return getAdminContext(request);
}

/**
 * Super Admin only. Every existing /api/admin/** route already calls this
 * one, so keeping its name and Promise<ResolvedUser | null> signature
 * means none of them needed to change to keep their current (Super
 * Admin-only) behavior -- only the handful being opened up to Support
 * Admins were switched to requireAnyAdmin below.
 */
export async function requireAdmin(request: Request): Promise<ResolvedUser | null> {
  const ctx = await getAdminContext(request);
  if (!ctx || ctx.role !== "super_admin") return null;
  return ctx.user;
}
PROTOCOL_EOF
patch_file "client/src/lib/admin/guard.ts" "$PATCH_TMP/guard_old.txt" "$PATCH_TMP/guard_new.txt"

# ---------------------------------------------------------------------------
# Append: lib/admin/require-admin-page.ts -- page-level "either tier" guard
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/rap_old.txt" << 'PROTOCOL_EOF'
export async function requireAdminPage(): Promise<ResolvedUser> {
  const user = await resolveUser(new Request("http://localhost/admin"));
  if (!user || !user.isSuperUser) {
    redirect("/dashboard");
  }
  return user;
}
PROTOCOL_EOF
cat > "$PATCH_TMP/rap_new.txt" << 'PROTOCOL_EOF'
export async function requireAdminPage(): Promise<ResolvedUser> {
  const user = await resolveUser(new Request("http://localhost/admin"));
  if (!user || !user.isSuperUser) {
    redirect("/dashboard");
  }
  return user;
}

/** Either admin tier. Use this for the shared /admin layout guard. */
export async function requireAnyAdminPage(): Promise<AdminContext> {
  const ctx = await getAdminContext(new Request("http://localhost/admin"));
  if (!ctx) {
    redirect("/dashboard");
  }
  return ctx;
}
PROTOCOL_EOF
patch_file "client/src/lib/admin/require-admin-page.ts" "$PATCH_TMP/rap_old.txt" "$PATCH_TMP/rap_new.txt"

cat > "$PATCH_TMP/rap_import_old.txt" << 'PROTOCOL_EOF'
import { redirect } from "next/navigation";
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";
PROTOCOL_EOF
cat > "$PATCH_TMP/rap_import_new.txt" << 'PROTOCOL_EOF'
import { redirect } from "next/navigation";
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";
import { getAdminContext, type AdminContext } from "@/lib/admin/guard";
PROTOCOL_EOF
patch_file "client/src/lib/admin/require-admin-page.ts" "$PATCH_TMP/rap_import_old.txt" "$PATCH_TMP/rap_import_new.txt"

echo "Patched schema + guard + page-guard files."

# ---------------------------------------------------------------------------
# Patches: switch the shared-access routes from requireAdmin to
# requireAnyAdmin. Each of these follows the exact same two-line shape,
# so the same before/after pair applies to all of them.
# ---------------------------------------------------------------------------
open_up_route() {
  local file="$1"
  cat > "$PATCH_TMP/open_import_old.txt" << 'PROTOCOL_EOF'
import { requireAdmin } from "@/lib/admin/guard";
PROTOCOL_EOF
  cat > "$PATCH_TMP/open_import_new.txt" << 'PROTOCOL_EOF'
import { requireAnyAdmin } from "@/lib/admin/guard";
PROTOCOL_EOF
  patch_file "$file" "$PATCH_TMP/open_import_old.txt" "$PATCH_TMP/open_import_new.txt"

  cat > "$PATCH_TMP/open_call_old.txt" << 'PROTOCOL_EOF'
  const admin = await requireAdmin(request);
PROTOCOL_EOF
  cat > "$PATCH_TMP/open_call_new.txt" << 'PROTOCOL_EOF'
  const admin = await requireAnyAdmin(request);
PROTOCOL_EOF
  patch_file "$file" "$PATCH_TMP/open_call_old.txt" "$PATCH_TMP/open_call_new.txt"
}

open_up_route "client/src/app/api/admin/overview/route.ts"
open_up_route "client/src/app/api/admin/support/route.ts"
open_up_route "client/src/app/api/admin/support/[id]/route.ts"
open_up_route "client/src/app/api/admin/support/[id]/reply/route.ts"
open_up_route "client/src/app/api/admin/support/[id]/status/route.ts"

# users/route.ts (list) -- same import swap, but keep the variable name
# "admin" consistent with the rest of that file
cat > "$PATCH_TMP/users_import_old.txt" << 'PROTOCOL_EOF'
import { requireAdmin } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/storage";
PROTOCOL_EOF
cat > "$PATCH_TMP/users_import_new.txt" << 'PROTOCOL_EOF'
import { requireAnyAdmin } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/storage";
PROTOCOL_EOF
patch_file "client/src/app/api/admin/users/route.ts" "$PATCH_TMP/users_import_old.txt" "$PATCH_TMP/users_import_new.txt"
cat > "$PATCH_TMP/users_call_old.txt" << 'PROTOCOL_EOF'
  const admin = await requireAdmin(request);
PROTOCOL_EOF
cat > "$PATCH_TMP/users_call_new.txt" << 'PROTOCOL_EOF'
  const admin = await requireAnyAdmin(request);
PROTOCOL_EOF
patch_file "client/src/app/api/admin/users/route.ts" "$PATCH_TMP/users_call_old.txt" "$PATCH_TMP/users_call_new.txt"

# users/[id]/route.ts -- only the GET (view) opens up; DELETE stays
# Super Admin-only (requireAdmin, untouched)
cat > "$PATCH_TMP/userid_import_old.txt" << 'PROTOCOL_EOF'
import { requireAdmin } from "@/lib/admin/guard";
import { getUserDetail, logAdminAction } from "@/lib/admin/storage";
PROTOCOL_EOF
cat > "$PATCH_TMP/userid_import_new.txt" << 'PROTOCOL_EOF'
import { requireAdmin, requireAnyAdmin } from "@/lib/admin/guard";
import { getUserDetail, logAdminAction } from "@/lib/admin/storage";
PROTOCOL_EOF
patch_file "client/src/app/api/admin/users/[id]/route.ts" "$PATCH_TMP/userid_import_old.txt" "$PATCH_TMP/userid_import_new.txt"

cat > "$PATCH_TMP/userid_get_old.txt" << 'PROTOCOL_EOF'
export async function GET(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getUserDetail(id);
PROTOCOL_EOF
cat > "$PATCH_TMP/userid_get_new.txt" << 'PROTOCOL_EOF'
export async function GET(request: Request, { params }: RouteParams) {
  const admin = await requireAnyAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getUserDetail(id);
PROTOCOL_EOF
patch_file "client/src/app/api/admin/users/[id]/route.ts" "$PATCH_TMP/userid_get_old.txt" "$PATCH_TMP/userid_get_new.txt"

echo "Opened up Overview / Users (read) / Support to Support Admins."

# ---------------------------------------------------------------------------
# Append: lib/admin/storage.ts -- list/grant/revoke Support Admin
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/storage_import_old.txt" << 'PROTOCOL_EOF'
import {
  users,
  subscriptions,
  habits,
  referrals,
  referralRewards,
  adminAuditLog,
  systemEvents,
  type User,
  type Subscription,
  type PlanTier,
  type UserStatus,
  type AdminAuditLogEntry,
} from "shared/schema";
PROTOCOL_EOF
cat > "$PATCH_TMP/storage_import_new.txt" << 'PROTOCOL_EOF'
import {
  users,
  subscriptions,
  habits,
  referrals,
  referralRewards,
  adminAuditLog,
  systemEvents,
  type User,
  type Subscription,
  type PlanTier,
  type UserStatus,
  type AdminAuditLogEntry,
} from "shared/schema";
import type { AdminRole } from "./guard";
PROTOCOL_EOF
patch_file "client/src/lib/admin/storage.ts" "$PATCH_TMP/storage_import_old.txt" "$PATCH_TMP/storage_import_new.txt"

cat > "$PATCH_TMP/storage_tail_old.txt" << 'PROTOCOL_EOF'
export async function listAuditLog(limit: number, offset: number): Promise<{ rows: AdminAuditLogEntry[]; total: number }> {
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(adminAuditLog),
  ]);
  return { rows, total };
}
PROTOCOL_EOF
cat > "$PATCH_TMP/storage_tail_new.txt" << 'PROTOCOL_EOF'
export async function listAuditLog(limit: number, offset: number): Promise<{ rows: AdminAuditLogEntry[]; total: number }> {
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(adminAuditLog),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Admin management (Super Admin only)
// ---------------------------------------------------------------------------

export interface AdminListEntry {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: AdminRole;
  // "env" admins (Super Admin via SUPER_USER_EMAILS) can't be revoked
  // from this UI -- only show up once they've actually signed in.
  source: "env" | "database";
}

export async function listAdmins(): Promise<AdminListEntry[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isSuperUser: users.isSuperUser,
      adminRole: users.adminRole,
    })
    .from(users)
    .where(sql`${users.isSuperUser} = true OR ${users.adminRole} IS NOT NULL`);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.isSuperUser ? "super_admin" : "support_admin",
    source: r.isSuperUser ? "env" : "database",
  }));
}

export async function grantSupportAdmin(userId: string): Promise<void> {
  await db.update(users).set({ adminRole: "support_admin", updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function revokeSupportAdmin(userId: string): Promise<void> {
  await db.update(users).set({ adminRole: null, updatedAt: new Date() }).where(eq(users.id, userId));
}
PROTOCOL_EOF
patch_file "client/src/lib/admin/storage.ts" "$PATCH_TMP/storage_tail_old.txt" "$PATCH_TMP/storage_tail_new.txt"

# ---------------------------------------------------------------------------
# New files
# ---------------------------------------------------------------------------
mkdir -p client/src/app/api/admin/me client/src/app/api/admin/admins/\[id\] client/src/app/admin/admins client/src/hooks

cat > client/src/app/api/admin/me/route.ts << 'PROTOCOL_EOF'
import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/admin/guard";

export async function GET(request: Request) {
  const ctx = await requireAnyAdmin(request);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ email: ctx.user.email, role: ctx.role });
}
PROTOCOL_EOF

cat > client/src/app/api/admin/admins/route.ts << 'PROTOCOL_EOF'
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdmins, grantSupportAdmin, logAdminAction } from "@/lib/admin/storage";
import { db } from "@/lib/db";
import { users } from "shared/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listAdmins());
}

const inputSchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const [target] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!target) {
    return NextResponse.json({ message: "No user with that email has signed in yet" }, { status: 404 });
  }
  if (target.isSuperUser) {
    return NextResponse.json({ message: "This user is already a Super Admin (via env config)" }, { status: 400 });
  }

  await grantSupportAdmin(target.id);
  await logAdminAction(admin, "admin.grant_support_admin", "user", target.id, `Granted Support Admin to ${target.email}`);

  return NextResponse.json({ id: target.id, email: target.email, role: "support_admin" });
}
PROTOCOL_EOF

cat > "client/src/app/api/admin/admins/[id]/route.ts" << 'PROTOCOL_EOF'
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { revokeSupportAdmin, logAdminAction } from "@/lib/admin/storage";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await revokeSupportAdmin(id);
  await logAdminAction(admin, "admin.revoke_support_admin", "user", id, "Revoked Support Admin");

  return new NextResponse(null, { status: 204 });
}
PROTOCOL_EOF

cat > client/src/hooks/use-admin-role.ts << 'PROTOCOL_EOF'
"use client";

import { useQuery } from "@tanstack/react-query";

export interface AdminMe {
  email: string | null;
  role: "super_admin" | "support_admin";
}

export function useAdminRole() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: async (): Promise<AdminMe> => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load admin role");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}
PROTOCOL_EOF

cat > client/src/app/admin/admins/page.tsx << 'PROTOCOL_EOF'
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminEntry {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "super_admin" | "support_admin";
  source: "env" | "database";
}

async function fetchAdmins(): Promise<AdminEntry[]> {
  const res = await fetch("/api/admin/admins", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load admins");
  return res.json();
}

export default function AdminAdminsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admins"], queryFn: fetchAdmins });
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to grant access");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/admins/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admins"] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold tracking-tight">Admins</h1>
      <p className="text-sm text-muted-foreground">
        Super Admins are controlled by the <code>SUPER_USER_EMAILS</code> env var and can&apos;t be revoked here
        -- they only appear below once they&apos;ve signed in at least once. Support Admins are granted below and
        can see Overview, Users (read-only), and Support.
      </p>

      <div className="flex gap-2 max-w-md">
        <Input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={() => grantMutation.mutate()} disabled={!email.trim() || grantMutation.isPending}>
          Grant Support Admin
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No admins yet.
                </td>
              </tr>
            )}
            {data?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-2">{[a.firstName, a.lastName].filter(Boolean).join(" ") || "\u2014"}</td>
                <td className="px-4 py-2 text-muted-foreground">{a.email ?? "\u2014"}</td>
                <td className="px-4 py-2">
                  <Badge variant={a.role === "super_admin" ? "default" : "secondary"}>
                    {a.role === "super_admin" ? "Super Admin" : "Support Admin"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {a.source === "database" && (
                    <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(a.id)}>
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
PROTOCOL_EOF

echo "Wrote admin-management data layer, API routes, and /admin/admins page."

# ---------------------------------------------------------------------------
# Rewrite: app/admin/layout.tsx -- use the either-tier guard, pass the
# actual role slug (not a hardcoded display string) into the shell
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/layout_old.txt" << 'PROTOCOL_EOF'
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  // Only one admin tier exists today -- access is gated entirely by the
  // isSuperUser flag (see lib/admin/guard.ts and SUPER_USER_EMAILS). This
  // is passed as a prop rather than hardcoded in the shell so a real
  // multi-tier roles system later only needs to change what's passed here.
  return (
    <AdminShell adminEmail={admin.email} adminRole="Super Admin">
      {children}
    </AdminShell>
  );
}
PROTOCOL_EOF
cat > "$PATCH_TMP/layout_new.txt" << 'PROTOCOL_EOF'
import { requireAnyAdminPage } from "@/lib/admin/require-admin-page";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAnyAdminPage();
  return (
    <AdminShell adminEmail={user.email} adminRole={role}>
      {children}
    </AdminShell>
  );
}
PROTOCOL_EOF
patch_file "client/src/app/admin/layout.tsx" "$PATCH_TMP/layout_old.txt" "$PATCH_TMP/layout_new.txt"

# ---------------------------------------------------------------------------
# admin-shell.tsx -- filter the sidebar by role, format the role label,
# add the Admins nav entry
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/shell_import_old.txt" << 'PROTOCOL_EOF'
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
  ArrowLeft,
} from "lucide-react";
PROTOCOL_EOF
cat > "$PATCH_TMP/shell_import_new.txt" << 'PROTOCOL_EOF'
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
} from "lucide-react";
PROTOCOL_EOF
patch_file "client/src/components/admin/admin-shell.tsx" "$PATCH_TMP/shell_import_old.txt" "$PATCH_TMP/shell_import_new.txt"

cat > "$PATCH_TMP/shell_nav_old.txt" << 'PROTOCOL_EOF'
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
PROTOCOL_EOF
cat > "$PATCH_TMP/shell_nav_new.txt" << 'PROTOCOL_EOF'
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
PROTOCOL_EOF
patch_file "client/src/components/admin/admin-shell.tsx" "$PATCH_TMP/shell_nav_old.txt" "$PATCH_TMP/shell_nav_new.txt"

cat > "$PATCH_TMP/shell_navmap_old.txt" << 'PROTOCOL_EOF'
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => {
PROTOCOL_EOF
cat > "$PATCH_TMP/shell_navmap_new.txt" << 'PROTOCOL_EOF'
        <nav className="flex-1 p-2 space-y-1">
          {NAV.filter((item) => adminRole === "super_admin" || item.anyAdmin).map((item) => {
PROTOCOL_EOF
patch_file "client/src/components/admin/admin-shell.tsx" "$PATCH_TMP/shell_navmap_old.txt" "$PATCH_TMP/shell_navmap_new.txt"

cat > "$PATCH_TMP/shell_footer_old.txt" << 'PROTOCOL_EOF'
              {adminRole && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{adminRole}</p>
              )}
PROTOCOL_EOF
cat > "$PATCH_TMP/shell_footer_new.txt" << 'PROTOCOL_EOF'
              {adminRole && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {ROLE_LABELS[adminRole] ?? adminRole}
                </p>
              )}
PROTOCOL_EOF
patch_file "client/src/components/admin/admin-shell.tsx" "$PATCH_TMP/shell_footer_old.txt" "$PATCH_TMP/shell_footer_new.txt"

# ---------------------------------------------------------------------------
# users/[id]/page.tsx -- hide Suspend/Restore/Delete/Change-plan for
# Support Admins (the API already blocks these; this just stops showing
# buttons that would 401 if clicked)
# ---------------------------------------------------------------------------
cat > "$PATCH_TMP/userpage_import_old.txt" << 'PROTOCOL_EOF'
import { StatCard } from "@/components/admin/stat-card";
PROTOCOL_EOF
cat > "$PATCH_TMP/userpage_import_new.txt" << 'PROTOCOL_EOF'
import { StatCard } from "@/components/admin/stat-card";
import { useAdminRole } from "@/hooks/use-admin-role";
PROTOCOL_EOF
patch_file "client/src/app/admin/users/[id]/page.tsx" "$PATCH_TMP/userpage_import_old.txt" "$PATCH_TMP/userpage_import_new.txt"

cat > "$PATCH_TMP/userpage_query_old.txt" << 'PROTOCOL_EOF'
  const { data, isLoading } = useQuery({ queryKey: ["admin-user", id], queryFn: () => fetchDetail(id) });
PROTOCOL_EOF
cat > "$PATCH_TMP/userpage_query_new.txt" << 'PROTOCOL_EOF'
  const { data, isLoading } = useQuery({ queryKey: ["admin-user", id], queryFn: () => fetchDetail(id) });
  const { data: me } = useAdminRole();
  const isSuperAdmin = me?.role === "super_admin";
PROTOCOL_EOF
patch_file "client/src/app/admin/users/[id]/page.tsx" "$PATCH_TMP/userpage_query_old.txt" "$PATCH_TMP/userpage_query_new.txt"

cat > "$PATCH_TMP/userpage_actions_old.txt" << 'PROTOCOL_EOF'
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {user.status === "active" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Suspend account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend this account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {name} will be signed out of the app everywhere and unable to sign back in until restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => suspendMutation.mutate()}>Suspend</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" size="sm" onClick={() => restoreMutation.mutate()}>
              Restore account
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete this account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes {name}&apos;s profile, habits, and history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete permanently</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Change plan (override)</h2>
        <p className="text-xs text-muted-foreground max-w-md">
          This only changes what PROTOCOL thinks this user&apos;s plan is -- it does not touch Paystack. Use for
          comps or support fixes, not to grant paid access without real payment. The next real Paystack webhook for
          this user overwrites this.
        </p>
        <div className="flex gap-3 items-center">
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="premium_plus">Premium Plus</SelectItem>
            </SelectContent>
          </Select>
          {plan !== "free" && (
            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => changePlanMutation.mutate()} disabled={changePlanMutation.isPending}>
            Apply
          </Button>
        </div>
      </section>
PROTOCOL_EOF
cat > "$PATCH_TMP/userpage_actions_new.txt" << 'PROTOCOL_EOF'
      {isSuperAdmin && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
            <div className="flex flex-wrap gap-3">
              {user.status === "active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Suspend account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend this account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {name} will be signed out of the app everywhere and unable to sign back in until restored.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => suspendMutation.mutate()}>Suspend</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button variant="outline" size="sm" onClick={() => restoreMutation.mutate()}>
                  Restore account
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently delete this account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes {name}&apos;s profile, habits, and history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete permanently</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Change plan (override)
            </h2>
            <p className="text-xs text-muted-foreground max-w-md">
              This only changes what PROTOCOL thinks this user&apos;s plan is -- it does not touch Paystack. Use
              for comps or support fixes, not to grant paid access without real payment. The next real Paystack
              webhook for this user overwrites this.
            </p>
            <div className="flex gap-3 items-center">
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium_plus">Premium Plus</SelectItem>
                </SelectContent>
              </Select>
              {plan !== "free" && (
                <Select value={interval} onValueChange={setIntervalValue}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={() => changePlanMutation.mutate()} disabled={changePlanMutation.isPending}>
                Apply
              </Button>
            </div>
          </section>
        </>
      )}
PROTOCOL_EOF
patch_file "client/src/app/admin/users/[id]/page.tsx" "$PATCH_TMP/userpage_actions_old.txt" "$PATCH_TMP/userpage_actions_new.txt"

echo ""
echo "-----------------------------------------------------------------"
echo "Done."
echo "  users.admin_role column added -- run: pnpm db:push"
echo "  Support Admins can now reach Overview, Users (read-only), Support"
echo "  Everything else stays Super Admin-only"
echo "  /admin/admins -- grant/revoke Support Admin (Super Admin only)"
echo "  Sidebar + user-detail actions now match what the signed-in admin"
echo "  can actually do"
echo ""
echo "Next: pnpm db:push && pnpm install && pnpm dev"
echo "-----------------------------------------------------------------"
