import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { ForbiddenError } from "@/lib/auth/errors";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "CATALOGER";
};

// The browser holds a random token in a cookie; the database only ever sees
// its SHA-256 hash, so a database leak does not leak usable sessions.
function tokenToSessionId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.create({
    data: { id: tokenToSessionId(token), userId, expiresAt },
  });
  return token;
}

// Who is asking? Used by pages and Server Actions alike.
export async function getSessionUser(): Promise<SessionUser | null> {
  // Every session check is per-request work — the clock in the expiry
  // comparison below must never be evaluated while prerendering a static
  // shell (cacheComponents), so declare the dynamic boundary first.
  await connection();

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: tokenToSessionId(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  const { user } = session;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    // Secure cookies need HTTPS; local development runs on http://localhost.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: tokenToSessionId(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

// Guards used by Server Actions: an action that must not run for the current
// caller throws instead of returning, so the rejection cannot be ignored.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ForbiddenError("You must be signed in to do that.");
  }
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") {
    throw new ForbiddenError("Only the Owner can do that.");
  }
  return user;
}
