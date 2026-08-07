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
}

const GUEST_PROFILE: ResolvedUser = {
  id: GUEST_USER_ID,
  email: "guest@demo.app",
  firstName: "Guest",
  lastName: "User",
  profileImageUrl: null,
  provider: "guest",
};

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
  });

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileImageUrl: profile.profileImageUrl,
    provider: profile.provider ?? provider,
  };
}
