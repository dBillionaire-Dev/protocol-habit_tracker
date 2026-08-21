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
