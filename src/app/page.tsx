import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteForm } from "./invite-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Seller&rsquo;s Cockpit
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.name} ({user.email}) ·{" "}
            {user.role === "OWNER" ? "Owner" : "Cataloger"}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Every Item the family has ever recorded — including sold ones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No Items yet. Cataloging arrives with the next ticket; for now this
            page proves the cockpit is live and you are signed in.
          </p>
        </CardContent>
      </Card>

      {user.role === "OWNER" ? <InviteForm /> : null}
    </main>
  );
}
