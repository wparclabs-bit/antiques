import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { listItems } from "@/lib/catalog/actions";
import { CATEGORY_TEMPLATES } from "@/lib/catalog/categories";
import {
  categoryLabel,
  formatIdr,
  isKnownCategory,
  STATE_LABELS,
} from "@/lib/catalog/display";
import type { ItemState } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InviteForm } from "./invite-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

function isKnownState(value: string): value is ItemState {
  return value in STATE_LABELS;
}

// The Catalog vs Inventory tabs keep the other filters when switching view.
function viewUrl(
  view: "catalog" | "inventory",
  filters: { q: string; category?: string; state?: string }
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.state) params.set("state", filters.state);
  params.set("view", view);
  return `/?${params.toString()}`;
}

export default async function HomePage({
  searchParams,
}: PageProps<"/">) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category =
    typeof sp.category === "string" && isKnownCategory(sp.category)
      ? sp.category
      : undefined;
  const state =
    typeof sp.state === "string" && isKnownState(sp.state) ? sp.state : undefined;
  const view = sp.view === "inventory" ? "inventory" : "catalog";

  const items = await listItems({ q, category, state, view });

  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/clearance" />}>
            SKBCB clearance
          </Button>
          {user.role === "OWNER" ? (
            <Button variant="outline" render={<Link href="/settings" />}>
              Shipping & pricing
            </Button>
          ) : null}
          <Button render={<Link href="/items/new" />}>Record an Item</Button>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Catalog or Inventory"
          className="flex gap-2"
        >
          <Button
            variant={view === "catalog" ? "default" : "outline"}
            size="sm"
            render={<Link href={viewUrl("catalog", { q, category, state })} />}
          >
            Catalog
          </Button>
          <Button
            variant={view === "inventory" ? "default" : "outline"}
            size="sm"
            render={<Link href={viewUrl("inventory", { q, category, state })} />}
          >
            Inventory
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {view === "catalog"
            ? "Every Item ever recorded, including sold ones."
            : "The Items the family currently owns."}
        </p>

        <form method="get" action="/" className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value={view} />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="w-full sm:w-56"
            aria-label="Search by name"
          />
          <select
            name="category"
            defaultValue={category ?? ""}
            aria-label="Filter by category"
            className={selectClass}
          >
            <option value="">All categories</option>
            {CATEGORY_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <select
            name="state"
            defaultValue={state ?? ""}
            aria-label="Filter by lifecycle state"
            className={selectClass}
          >
            <option value="">All states</option>
            {Object.entries(STATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>
      </section>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{q || category || state ? "No matches" : "No Items yet"}</CardTitle>
            <CardDescription>
              {q || category || state
                ? "Nothing in the catalog matches these filters — try clearing them."
                : "Start recording the collection piece by piece. Records save as Drafts, so a partial start is fine."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full transition-colors hover:border-ring">
                <Link href={`/items/${item.id}`} className="block">
                  <CardContent className="flex gap-4 p-4">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="size-20 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.65rem] leading-tight text-muted-foreground">
                        {item.photoCount > 0 ? "Photo stored" : "No photo yet"}
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="font-medium break-words">
                        {item.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">
                          {STATE_LABELS[item.state]}
                        </Badge>
                        <Badge variant="outline">
                          {categoryLabel(item.category)}
                        </Badge>
                      </div>
                      {user.role === "OWNER" && item.costBasisIdr !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Cost {formatIdr(item.costBasisIdr)}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {user.role === "OWNER" ? <InviteForm /> : null}
    </main>
  );
}
