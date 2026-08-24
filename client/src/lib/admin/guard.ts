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
 * means most of them didn't need to change to keep their current (Super
 * Admin-only) behavior -- only the handful opened up to Support Admins
 * were switched to requireAnyAdmin.
 */
export async function requireAdmin(request: Request): Promise<ResolvedUser | null> {
  const ctx = await getAdminContext(request);
  if (!ctx || ctx.role !== "super_admin") return null;
  return ctx.user;
}
