"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  requireOwner,
  setSessionCookie,
} from "@/lib/auth/session";

// Form actions return this so the page can show what went wrong.
export type AuthFormState = { error: string | null };

// inviteCataloger also reports which account it created so the form can
// confirm success.
export type InviteFormState = {
  error: string | null;
  invitedEmail: string | null;
};

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Deliberately vague: never reveal whether the email exists.
    return { error: "Invalid email or password." };
  }

  setSessionCookie(await createSession(user.id));
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function inviteCataloger(
  _prevState: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  await requireOwner();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", invitedEmail: null };
  }
  if (name.length === 0) {
    return { error: "Enter a name for the new account.", invitedEmail: null };
  }
  if (password.length < 8) {
    return {
      error: "Choose a password of at least 8 characters.",
      invitedEmail: null,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with this email already exists.",
      invitedEmail: null,
    };
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "CATALOGER",
    },
  });

  revalidatePath("/");
  return { error: null, invitedEmail: email };
}
