import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getShippingSettings } from "@/lib/shipping/actions";
import { CATEGORY_TEMPLATES } from "@/lib/catalog/categories";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// The page reads the session cookie, so it must render per request.
export const instant = false;

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// The Export page (ticket 10): pick a category and a marketplace, get one
// ZIP with a folder per listed item — listing.txt (title, description,
// price) plus photos sized for that marketplace — and a manifest of what
// was skipped. Built for the PC sessions where marketplace posting happens.
export default async function ExportPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const settings = await getShippingSettings();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Catalog
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Export listing kits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One ZIP per category and marketplace: a folder for every item
            that has a listing there, each holding the copy-ready text
            (title, description, price) and the photos as files, sized for
            that marketplace. A manifest lists anything skipped and why.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Download a batch</CardTitle>
          <CardDescription>
            Items without a listing on the chosen marketplace are skipped
            and named in the manifest — record their listings first if you
            want them in the batch. Larger categories take a few seconds to
            pack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action="/export/download"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-category">Category</Label>
              <select
                id="export-category"
                name="category"
                required
                defaultValue=""
                className={selectClass}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {CATEGORY_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-marketplace">Marketplace</Label>
              <select
                id="export-marketplace"
                name="marketplaceId"
                required
                defaultValue=""
                className={selectClass}
              >
                <option value="" disabled>
                  Choose a marketplace…
                </option>
                {(settings?.marketplaces ?? []).map((marketplace) => (
                  <option key={marketplace.id} value={marketplace.id}>
                    {marketplace.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Download kits (ZIP)</Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        For a single item, use the <strong>Download kit</strong> button on
        that listing — same ZIP contents, without picking a category.
      </p>
    </main>
  );
}
