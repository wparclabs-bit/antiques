import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getSaleLog } from "@/lib/sales/actions";
import { formatDate, formatMoney } from "@/lib/catalog/display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The page reads the session cookie, so it must render per request.
export const instant = false;

// The Sale log (ticket 10): every sale the family has ever recorded,
// newest first — the compounding price database made visible. Sales are
// recorded on the Item (the record IS the Sold step); this page is the
// family-wide view over them.
export default async function SaleLogPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const entries = await getSaleLog();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Catalog
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sale log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every sale the family has recorded — what each piece actually
            sold for, where, and when. Prices compound here with every sale.
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sales recorded yet</CardTitle>
            <CardDescription>
              Recording a sale is part of marking an item Sold — open the
              item&rsquo;s page and use the Lifecycle card when a piece has
              been paid for.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="flex flex-col divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.itemId}>
                  <Link
                    href={`/items/${entry.itemId}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    {entry.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.thumbnailUrl}
                        alt={entry.itemName}
                        className="size-14 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.6rem] leading-tight text-muted-foreground">
                        No photo
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {entry.itemName}
                      </span>
                      <span className="text-sm">
                        {formatMoney(entry.price, entry.currency)}{" "}
                        <span className="text-muted-foreground">
                          · {entry.marketplaceName} ·{" "}
                          {formatDate(entry.soldOn)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
