import { createClient } from "@/lib/supabase/server";
import { storage } from "@/lib/storage";

export const GUEST_USER_ID = "guest-demo-user";

export interface ResolvedUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
  isSuperUser: boolean;
}

const GUEST_PROFILE: ResolvedUser = {
  id: GUEST_USER_ID,
  email: "guest@demo.app",
  firstName: "Guest",
  lastName: "User",
  profileImageUrl: null,
  provider: "guest",
  isSuperUser: false,
};

// Comma-separated allow-list, e.g. "you@gmail.com,other@gmail.com".
// Recomputed on every login (not hand-edited in the DB), so removing an
// email from this env var revokes super-user access on that person's
// next login too — no manual DB cleanup needed either direction.
function isSuperUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowList = (process.env.SUPER_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
}

/**
 * Resolves the current user for a Route Handler / Server Action.
 *
 * - Guest mode: the client sends `X-Guest-Mode: true`; no Supabase call,
 *   no DB row — fully stateless demo user.
 * - Real users: reads the Supabase session from cookies (via the server
 *   client + middleware-refreshed cookies) and upserts a matching row in
 *   our local `users` profile table so habits have somewhere to attach.
 *
 * Returns null if there's no valid session and it's not guest mode —
 * callers should respond 401.
 */
export async function resolveUser(
  request: Request,
): Promise<ResolvedUser | null> {
  if (request.headers.get("X-Guest-Mode") === "true") {
    return GUEST_PROFILE;
  }

  const supabase = await createClient();
  const {
    data: { user: supaUser },
  } = await supabase.auth.getUser();

  if (!supaUser) {
    return null;
  }

  const meta = supaUser.user_metadata ?? {};
  const provider = supaUser.app_metadata?.provider ?? "email";

  const profile = await storage.upsertUser({
    id: supaUser.id,
    email: supaUser.email ?? null,
    provider,
    firstName: meta.given_name ?? meta.first_name ?? null,
    lastName: meta.family_name ?? meta.last_name ?? null,
    profileImageUrl: meta.avatar_url ?? meta.picture ?? null,
    isSuperUser: isSuperUserEmail(supaUser.email),
  });

  // Suspended accounts keep a valid Supabase session but are treated as
  // unauthenticated everywhere in the app -- this is the single place
  // that enforces it, since every route resolves the user through here.
  if (profile.status === "suspended") {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileImageUrl: profile.profileImageUrl,
    provider: profile.provider ?? provider,
    isSuperUser: profile.isSuperUser,
  };
}
