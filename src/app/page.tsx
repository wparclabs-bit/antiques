import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { listItems } from "@/lib/catalog/actions";
import { getAttentionRows, getStateCounts } from "@/lib/attention";
import { CATEGORY_TEMPLATES } from "@/lib/catalog/categories";
import {
  categoryLabel,
  formatIdr,
  formatMoney,
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

// One pill style for the stage chips; active chips invert.
function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
    : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground";
}

// The Ledger home (ticket 10): the catalog IS the dashboard. A thin
// "Needs attention" strip derived from the records sits on top; the stage
// chips carry the counts; the photo ledger fills the rest.
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

  const [items, attentionRows, stateCounts] = await Promise.all([
    listItems({ q, category, state, view }),
    getAttentionRows(),
    getStateCounts(view),
  ]);

  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          The family archive
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.name} ({user.email})
        </p>
      </header>

      {attentionRows.length > 0 ? (
        <section
          aria-label="Needs attention"
          className="rounded-xl border border-border bg-muted/40 p-4"
        >
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs attention
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {attentionRows.map((row) => (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  <span className="font-medium">{row.count}</span>{" "}
                  {row.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

        {/* Stage chips with counts — the lifecycle at a glance. */}
        <div className="flex flex-wrap gap-2">
          <Link href={viewUrl(view, { q, category })} className={chipClass(state === undefined)}>
            All stages
          </Link>
          {(Object.entries(STATE_LABELS) as [ItemState, string][])
            .filter(([value]) => stateCounts[value] > 0)
            .map(([value, label]) => (
              <Link
                key={value}
                href={viewUrl(view, { q, category, state: value })}
                className={chipClass(state === value)}
              >
                {label}{" "}
                <span className={state === value ? "opacity-70" : "opacity-60"}>
                  {stateCounts[value]}
                </span>
              </Link>
            ))}
        </div>

        <form method="get" action="/" className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value={view} />
          {state ? <input type="hidden" name="state" value={state} /> : null}
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name, detail, condition, provenance…"
            className="w-full sm:w-72"
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
                      {item.costBasisIdr !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Cost {formatIdr(item.costBasisIdr)}
                        </span>
                      ) : null}
                      {/* The sale record (ticket 07) — the family's own
                          sold prices, compounding in the Catalog. */}
                      {item.sale ? (
                        <span className="text-xs text-muted-foreground">
                          Sold {formatMoney(item.sale.price, item.sale.currency)} ·{" "}
                          {item.sale.marketplaceName}
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
    </main>
  );
}
