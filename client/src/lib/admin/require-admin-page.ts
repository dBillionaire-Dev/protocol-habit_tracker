import { redirect } from "next/navigation";
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";
import { getAdminContext, type AdminContext } from "@/lib/admin/guard";

/**
 * Page-level (Server Component) equivalent of lib/admin/guard.ts's
 * requireAdmin for Route Handlers. resolveUser only reads the
 * X-Guest-Mode header off the Request it's given (everything else comes
 * from the Supabase cookie via next/headers), and guests should never be
 * admins, so a bare Request with no special headers is all it needs here.
 */
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
