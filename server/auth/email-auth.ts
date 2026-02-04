import { db } from "../db";
import { users } from "../../shared/models/auth";
import { eq } from "drizzle-orm";

export interface EmailUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.SESSION_SECRET || "default-secret");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

export async function createEmailUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<EmailUser> {
  const passwordHash = await hashPassword(password);
  
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      provider: "email",
      firstName: firstName || null,
      lastName: lastName || null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash,
        provider: "email",
        firstName: firstName || users.firstName,
        lastName: lastName || users.lastName,
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

export async function verifyEmailUser(
  email: string,
  password: string
): Promise<EmailUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user || !user.passwordHash) {
    return null;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    provider: user.provider!,
  };
}

export async function getUserById(id: string): Promise<EmailUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    provider: user.provider!,
  };
}

export async function getUserByEmail(email: string): Promise<EmailUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    provider: user.provider!,
  };
}

export async function updateUserProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; profileImageUrl?: string }
): Promise<void> {
  await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
