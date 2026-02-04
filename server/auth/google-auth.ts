import { db } from "../db";
import { users } from "../../shared/models/auth";
import { eq } from "drizzle-orm";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = `${process.env.APP_URL || "http://localhost:5000"}/api/auth/google/callback`;

export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID || "",
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGoogleCallback(code: string): Promise<GoogleUser | null> {
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID || "",
        client_secret: GOOGLE_CLIENT_SECRET || "",
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Failed to exchange Google code for tokens");
      return null;
    }

    const tokens = await tokenResponse.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      console.error("No ID token in Google response");
      return null;
    }

    // Decode and verify the ID token
    const userInfo = await verifyGoogleToken(idToken);
    return userInfo;
  } catch (error) {
    console.error("Google callback error:", error);
    return null;
  }
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
  try {
    // Decode the JWT token (without verification since we can't use google-auth-library)
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      console.error("Invalid Google ID token format");
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));

    // Verify the token
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error("Google ID token expired");
      return null;
    }

    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      console.error("Invalid Google token issuer");
      return null;
    }

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      console.error("Invalid Google token audience");
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      firstName: payload.given_name || "",
      lastName: payload.family_name || "",
      profileImageUrl: payload.picture || null,
    };
  } catch (error) {
    console.error("Google token verification failed:", error);
    return null;
  }
}

export async function createOrGetGoogleUser(googleUser: GoogleUser): Promise<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
}> {
  const [user] = await db
    .insert(users)
    .values({
      id: googleUser.id,
      email: googleUser.email.toLowerCase(),
      provider: "google",
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      profileImageUrl: googleUser.profileImageUrl,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: googleUser.email.toLowerCase(),
        provider: "google",
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        profileImageUrl: googleUser.profileImageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    id: user.id,
    email: user.email!,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    provider: user.provider!,
  };
}

// Helper function to decode base64
function atob(str: string): string {
  return Buffer.from(str, "base64").toString("utf-8");
}
