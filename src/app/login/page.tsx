import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function LoginPage() {
  // Already signed in? Nothing to do here.
  if (await getSessionUser()) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
