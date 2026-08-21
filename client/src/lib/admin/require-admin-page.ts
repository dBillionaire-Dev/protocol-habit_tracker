import { redirect } from "next/navigation";
import { resolveUser, type ResolvedUser } from "@/lib/auth/require-user";

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
