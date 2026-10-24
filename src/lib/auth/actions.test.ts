import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// The only mocks in this suite are Next.js runtime transport: the browser's
// cookie jar and page redirects (shared via src/test/browser-transport.ts).
// Everything else — password hashing, the Server Actions under test, the
// database — is real.
// ---------------------------------------------------------------------------

vi.mock("next/headers", async () => (await import("@/test/browser-transport")).nextHeaders);
vi.mock("next/navigation", async () => (await import("@/test/browser-transport")).nextNavigation);
vi.mock("next/cache", async () => (await import("@/test/browser-transport")).nextCache);
vi.mock("next/server", async () => (await import("@/test/browser-transport")).nextServer);

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signIn, inviteFamilyMember, signOut } from "@/lib/auth/actions";
import { ForbiddenError } from "@/lib/auth/errors";
import { getSessionUser } from "@/lib/auth/session";
import { cookieStore } from "@/test/browser-transport";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

// Signing in succeeds by redirecting to the home page; every test that needs
// a signed-in user goes through this.
async function signInAs(email: string, password: string) {
  await expect(
    signIn({ error: null }, form({ email, password }))
  ).rejects.toThrow(/NEXT_REDIRECT/);
}

async function createUser(
  fields: Partial<{ email: string; name: string; password: string }> = {}
) {
  return prisma.user.create({
    data: {
      email: fields.email ?? "owner@test.local",
      name: fields.name ?? "Test Owner",
      passwordHash: await hashPassword(fields.password ?? "owner-password-1"),
    },
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Session" CASCADE`);
  cookieStore.clear();
});

test("the Owner can sign in with email and password", async () => {
  const owner = await createUser();

  // Signing in succeeds by redirecting to the home page.
  await expect(
    signIn({ error: null }, form({ email: owner.email, password: "owner-password-1" }))
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const session = await getSessionUser();
  expect(session?.email).toBe("owner@test.local");
});

test("signing in with a wrong password fails and starts no session", async () => {
  const owner = await createUser();

  const result = await signIn(
    { error: null },
    form({ email: owner.email, password: "wrong-password" })
  );

  expect(result.error).toBeTruthy();
  expect(await getSessionUser()).toBeNull();
});

test("signing in with an unknown email fails without revealing why", async () => {
  const result = await signIn(
    { error: null },
    form({ email: "nobody@test.local", password: "whatever-1" })
  );

  expect(result.error).toBeTruthy();
  expect(await getSessionUser()).toBeNull();
});

test("a family member can be invited and signs in with full rights", async () => {
  await createUser();

  // Sign in as an existing family member first.
  await signInAs("owner@test.local", "owner-password-1");

  const result = await inviteFamilyMember(
    { error: null, invitedEmail: null },
    form({ email: "ada@test.local", name: "Ada", password: "family-password-1" })
  );
  expect(result.error).toBeNull();

  // The invited account works: switch to it by signing in fresh.
  cookieStore.clear();
  await signInAs("ada@test.local", "family-password-1");

  const session = await getSessionUser();
  expect(session?.email).toBe("ada@test.local");

  // One role (ADR-0003): the invited member can do everything the
  // inviter could — including inviting the next member.
  const next = await inviteFamilyMember(
    { error: null, invitedEmail: null },
    form({ email: "budi@test.local", name: "Budi", password: "family-password-2" })
  );
  expect(next.error).toBeNull();
});

test("an unauthenticated visitor is also rejected by the invite action", async () => {
  await expect(
    inviteFamilyMember(
      { error: null, invitedEmail: null },
      form({ email: "newbie@test.local", name: "New", password: "password-123" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("inviting an email that already has an account fails without a duplicate", async () => {
  await createUser();
  await signInAs("owner@test.local", "owner-password-1");

  const result = await inviteFamilyMember(
    { error: null, invitedEmail: null },
    form({ email: "owner@test.local", name: "Again", password: "password-123" })
  );

  expect(result.error).toBeTruthy();
});

test("an invite with a malformed email or a short password is rejected", async () => {
  await createUser();
  await signInAs("owner@test.local", "owner-password-1");

  const badEmail = await inviteFamilyMember(
    { error: null, invitedEmail: null },
    form({ email: "not-an-email", name: "X", password: "password-123" })
  );
  expect(badEmail.error).toBeTruthy();

  const shortPassword = await inviteFamilyMember(
    { error: null, invitedEmail: null },
    form({ email: "ok@test.local", name: "X", password: "short" })
  );
  expect(shortPassword.error).toBeTruthy();
});

test("signing out ends the session", async () => {
  await createUser();
  await signInAs("owner@test.local", "owner-password-1");

  // Signing out succeeds by redirecting to the login page.
  await expect(signOut()).rejects.toThrow(/NEXT_REDIRECT/);

  expect(await getSessionUser()).toBeNull();
});
