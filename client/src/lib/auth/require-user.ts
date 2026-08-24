import { createClient } from "@/lib/supabase/server";
import { storage } from "@/lib/storage";

export const GUEST_USER_ID = "guest-demo-user";

// Guest mode has no real session/cookie -- it's a client-trusted header
// (see below), so this is the only expiry mechanism it has. Chosen to
// match real accounts' rough session lifetime rather than persisting
// indefinitely just because the browser still has the flag set.
const GUEST_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

// Real accounts get their OWN independent 7-day enforcement, on top of
// whatever Supabase's own refresh-token lifetime is configured to (which
// this app doesn't control/verify). Compared against users.lastLoginAt,
// which is only stamped at an actual sign-in event -- see that column's
// comment in shared/models/auth.ts for why it's not just "last request".
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * - Guest mode: the client sends `X-Guest-Mode: true` plus
 *   `X-Guest-Started-At` (an ISO timestamp set once, when guest mode was
 *   first entered). No Supabase call, no DB row — stateless, but now
 *   time-boxed: a guest "session" older than GUEST_SESSION_MAX_AGE_MS is
 *   treated as expired even if the client-side flag is still set,
 *   exactly like a real session would be. Missing or unparseable
 *   timestamp fails closed (treated as expired) rather than granting an
 *   unverifiable indefinite session.
 * - Real users: reads the Supabase session from cookies (via the server
 *   client + middleware-refreshed cookies) and upserts a matching row in
 *   our local `users` profile table so habits have somewhere to attach.
 *
 * Returns null if there's no valid session and it's not (valid) guest
 * mode — callers should respond 401.
 */
export async function resolveUser(
  request: Request,
): Promise<ResolvedUser | null> {
  if (request.headers.get("X-Guest-Mode") === "true") {
    const startedAtHeader = request.headers.get("X-Guest-Started-At");
    const startedAt = startedAtHeader ? Date.parse(startedAtHeader) : NaN;

    if (Number.isNaN(startedAt)) {
      // Can't verify how old this guest session is -- fail closed rather
      // than trust an unbounded/unverifiable session.
      return null;
    }
    if (Date.now() - startedAt > GUEST_SESSION_MAX_AGE_MS) {
      return null; // guest session expired
    }
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

  // Independent 7-day enforcement, regardless of whether the underlying
  // Supabase session cookie is still technically valid -- see
  // SESSION_MAX_AGE_MS above. A null lastLoginAt (never logged in via
  // the mark-login path -- e.g. an account that predates this column)
  // is treated the same as "expired": both require a fresh sign-in
  // rather than silently trusting an unverifiable session age.
  const lastLoginMs = profile.lastLoginAt ? new Date(profile.lastLoginAt).getTime() : null;
  if (lastLoginMs === null || Date.now() - lastLoginMs > SESSION_MAX_AGE_MS) {
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
