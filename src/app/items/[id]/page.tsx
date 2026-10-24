import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getItem } from "@/lib/catalog/actions";
import { templateFor } from "@/lib/catalog/categories";
import { missingForCataloged } from "@/lib/catalog/validation";
import {
  categoryLabel,
  formatIdr,
  STATE_LABELS,
} from "@/lib/catalog/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AddPhotosForm,
  CatalogButton,
  CostBasisForm,
  RemovePhotoButton,
} from "./item-forms";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function ItemPage({
  params,
}: PageProps<"/items/[id]">) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const item = await getItem(id);
  if (!item) {
    notFound();
  }

  const template = templateFor(item.category);
  const missing =
    item.state === "DRAFT"
      ? missingForCataloged({
          category: item.category,
          attributes: item.attributes,
          photoCount: item.photos.length,
        })
      : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Catalog
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {item.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{STATE_LABELS[item.state]}</Badge>
              <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
              {item.fiftyYearsOld ? (
                <Badge variant="outline">50+ years — SKBCB needed abroad</Badge>
              ) : null}
            </div>
          </div>
          <Button variant="outline" render={<Link href={`/items/${id}/edit`} />}>
            Edit
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            Stored once; marketplace-sized variants are derived automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {item.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No photos yet. At least one is needed before this item can be
              marked Cataloged.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {item.photos.map((photo) => (
                <li key={photo.id} className="flex flex-col gap-2">
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={item.name}
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
                      Photo stored — display needs Cloudinary configured (see
                      README)
                    </div>
                  )}
                  <RemovePhotoButton photoId={photo.id} />
                </li>
              ))}
            </ul>
          )}
          <AddPhotosForm itemId={item.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{template.label} details</CardTitle>
          {item.state === "DRAFT" && missing.length > 0 ? (
            <CardDescription>
              Still needed to Catalog: {missing.join(", ")}.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {template.fields.map((field) => {
              const value = item.attributes[field.key];
              return (
                <div key={field.key} className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {field.label}
                    {field.unit ? ` (${field.unit})` : ""}
                  </dt>
                  <dd className="text-sm">
                    {value === undefined
                      ? "—"
                      : `${value}${field.unit ? ` ${field.unit}` : ""}`}
                  </dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Condition</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">
              {item.conditionNotes ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">
              {item.provenance ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {user.role === "OWNER" ? (
        <Card>
          <CardHeader>
            <CardTitle>Cost basis</CardTitle>
            <CardDescription>
              {item.costBasisIdr === null
                ? "Not set yet."
                : `Currently ${formatIdr(item.costBasisIdr)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostBasisForm itemId={item.id} costBasisIdr={item.costBasisIdr} />
          </CardContent>
        </Card>
      ) : null}

      {item.state === "DRAFT" ? (
        <Card>
          <CardHeader>
            <CardTitle>Finish the record</CardTitle>
            <CardDescription>
              {missing.length === 0
                ? "Everything needed is here."
                : `Still needed: ${missing.join(", ")}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogButton itemId={item.id} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
