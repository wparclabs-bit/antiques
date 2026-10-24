import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { ItemForm } from "../item-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function NewItemPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Record an Item
        </h1>
        <p className="text-sm text-muted-foreground">
          A Draft is a fine start — fill in what you know now, finish the rest
          later.
        </p>
      </header>
      <ItemForm mode="create" />
    </main>
  );
}
