import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getItem, type ItemDetail } from "@/lib/catalog/actions";
import { getComparables, getSoldSearchLinks, getValuation } from "@/lib/valuation/actions";
import { getShippingSettings, estimateShipping, type ShippingEstimateView } from "@/lib/shipping/actions";
import { templateFor } from "@/lib/catalog/categories";
import { missingForCataloged } from "@/lib/catalog/validation";
import {
  categoryLabel,
  formatDate,
  formatIdr,
  formatMoney,
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
import {
  AddPhotosForm,
  CatalogButton,
  CostBasisForm,
  RemovePhotoButton,
} from "./item-forms";
import { SkbcbForm, TransitionForm } from "./lifecycle-forms";
import {
  AddComparableForm,
  RemoveComparableButton,
  SetValuationForm,
} from "./valuation-forms";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function ItemPage({
  params,
  searchParams,
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

  // The estimate form GETs back to this page with its choices as params —
  // same pattern as the catalog filters.
  const sp = await searchParams;
  const zone = typeof sp.zone === "string" && sp.zone !== "" ? sp.zone : null;
  const marketplaceId =
    typeof sp.marketplace === "string" && sp.marketplace !== "" ? sp.marketplace : null;
  const declaredRaw = typeof sp.declared === "string" ? sp.declared.trim() : "";
  const declaredValueIdr = /^\d{1,10}$/.test(declaredRaw) ? Number(declaredRaw) : null;

  const template = templateFor(item.category);
  const missing =
    item.state === "DRAFT"
      ? missingForCataloged({
          category: item.category,
          attributes: item.attributes,
          photoCount: item.photos.length,
        })
      : [];

  // Pricing domain — the Owner's cards. For a Cataloger these reads return
  // null on the server and the cards are not rendered.
  const [comparables, valuation, searchLinks, shippingSettings] = user.role === "OWNER"
    ? await Promise.all([
        getComparables(item.id),
        getValuation(item.id),
        getSoldSearchLinks(item.id),
        getShippingSettings(),
      ])
    : [null, null, null, null];

  const estimate =
    shippingSettings && zone
      ? await estimateShipping({
          itemId: item.id,
          zone,
          marketplaceId,
          declaredValueIdr,
        })
      : null;

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

      {comparables !== null && searchLinks !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Find similar sold items</CardTitle>
            <CardDescription>
              One click opens the marketplaces pre-filled with this item&rsquo;s
              name and identifying details. eBay filters to sold listings;
              Etsy has no sold-only search, so sold badges are checked by eye.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" render={<a href={searchLinks.ebay} target="_blank" rel="noreferrer" />}>
              eBay — sold listings
            </Button>
            <Button variant="outline" render={<a href={searchLinks.etsy} target="_blank" rel="noreferrer" />}>
              Etsy — search
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {comparables !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Comparables</CardTitle>
            <CardDescription>
              Recorded evidence of sold prices for similar items — the basis
              of your valuation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {comparables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comparables recorded yet. Aim for 3–5 before setting a
                valuation.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {comparables.map((comp) => (
                  <li key={comp.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">
                        {formatMoney(comp.price, comp.currency)}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {comp.source} · {formatDate(comp.soldOn)}
                        </span>
                      </span>
                      {comp.notes ? (
                        <span className="text-xs text-muted-foreground">
                          {comp.notes}
                        </span>
                      ) : null}
                      {comp.url ? (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {comp.url}
                        </a>
                      ) : null}
                    </div>
                    <RemoveComparableButton comparableId={comp.id} />
                  </li>
                ))}
              </ul>
            )}
            <AddComparableForm itemId={item.id} />
          </CardContent>
        </Card>
      ) : null}

      {valuation !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Valuation</CardTitle>
            <CardDescription>
              {valuation.current
                ? `Currently ${formatMoney(valuation.current.minPrice, valuation.current.currency)} – ${formatMoney(valuation.current.maxPrice, valuation.current.currency)}.`
                : "Not set yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SetValuationForm
              itemId={item.id}
              currency={valuation.current?.currency ?? null}
            />
            {valuation.history.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  History
                </h3>
                <ul className="flex flex-col">
                  {valuation.history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap justify-between gap-2 py-1.5 text-sm"
                    >
                      <span>
                        {formatMoney(entry.minPrice, entry.currency)} –{" "}
                        {formatMoney(entry.maxPrice, entry.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.setByName} · {formatDate(entry.setAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {shippingSettings !== null ? (
        <ShippingCard
          itemId={item.id}
          settings={shippingSettings}
          estimate={estimate}
          zone={zone}
          marketplaceId={marketplaceId}
          declared={declaredRaw}
        />
      ) : null}

      {item.fiftyYearsOld ? (
        <Card>
          <CardHeader>
            <CardTitle>Export clearance (SKBCB)</CardTitle>
            <CardDescription>
              This piece is flagged 50+ years old, so listing it internationally
              needs its SKBCB certificate on record — number and scan together.
              Domestic selling never needs it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 text-sm">
              {item.skbcb.certificateNumber ? (
                <span>
                  Certificate number:{" "}
                  <span className="font-medium">
                    {item.skbcb.certificateNumber}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No certificate number recorded yet.
                </span>
              )}
              {item.skbcb.hasScan ? (
                item.skbcb.scanUrl ? (
                  <a
                    href={item.skbcb.scanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    View the stored scan
                  </a>
                ) : (
                  <span>Scan stored (display needs Cloudinary configured).</span>
                )
              ) : (
                <span className="text-muted-foreground">
                  No scan of the certificate recorded yet.
                </span>
              )}
            </div>
            <SkbcbForm
              itemId={item.id}
              certificateNumber={item.skbcb.certificateNumber}
            />
          </CardContent>
        </Card>
      ) : null}

      <LifecycleCard item={item} missing={missing} userRole={user.role} />
    </main>
  );
}

// What a sale of this piece truly costs (ticket 05): every forwarder's
// quote for one destination zone side by side, each with its insurance
// estimate and the Price Floor that shipping implies. The form GETs back
// to this page — same pattern as the catalog filters — so everything stays
// server-rendered.
function ShippingCard({
  itemId,
  settings,
  estimate,
  zone,
  marketplaceId,
  declared,
}: {
  itemId: string;
  settings: NonNullable<Awaited<ReturnType<typeof getShippingSettings>>>;
  estimate: ShippingEstimateView | null;
  zone: string | null;
  marketplaceId: string | null;
  declared: string;
}) {
  const zones = [...new Set(settings.rates.map((rate) => rate.zone))];
  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping & Price Floor</CardTitle>
        <CardDescription>
          Estimated from this piece&rsquo;s recorded measurements plus the
          editable{" "}
          <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
            rates & FX settings
          </Link>
          . The Price Floor is the least a listing should sell for: cost basis
          + shipping + insurance + margin, with the marketplace fee divided
          out.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          method="get"
          action={`/items/${itemId}`}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <select
            name="zone"
            defaultValue={zone ?? ""}
            aria-label="Destination zone"
            className={selectClass}
          >
            <option value="">Destination zone…</option>
            {zones.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            name="marketplace"
            defaultValue={marketplaceId ?? ""}
            aria-label="Marketplace for the fee"
            className={selectClass}
          >
            <option value="">No marketplace fee</option>
            {settings.marketplaces.map((marketplace) => (
              <option key={marketplace.id} value={marketplace.id}>
                {marketplace.name} — {marketplace.feePercent}%
              </option>
            ))}
          </select>
          <Input
            name="declared"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={declared}
            placeholder="Declared value (IDR)"
            aria-label="Declared value in IDR"
          />
          <Button type="submit" variant="outline">
            Estimate
          </Button>
        </form>

        {estimate ? (
          <EstimateResults estimate={estimate} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a destination zone to compare forwarders. Insurance needs a
            declared value — usually your intended listing price in IDR.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EstimateResults({ estimate }: { estimate: ShippingEstimateView }) {
  const { measurements, fx, marginPercent, marketplace } = estimate;
  const used = [
    measurements.weightKg !== null ? `${measurements.weightKg} kg` : null,
    measurements.boxCm.length > 0
      ? `box ${measurements.boxCm.join(" × ")} cm`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Using: {used || "no measurements recorded"} · FX {formatIdr(fx.idrPerUnit)}{" "}
        per {fx.currency} · margin {marginPercent}%
        {marketplace ? ` · ${marketplace.name} fee ${marketplace.feePercent}%` : ""}
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {estimate.rows.map((row) => (
          <li key={row.rate.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <span className="text-sm font-medium">{row.rate.forwarder}</span>
            {row.rate.transitNote ? (
              <span className="text-xs text-muted-foreground">
                {row.rate.transitNote}
              </span>
            ) : null}
            {!row.quote.eligible ? (
              <span className="text-sm text-muted-foreground">
                {row.quote.reason}
              </span>
            ) : (
              <>
                <span className="text-sm">
                  {row.rate.basis === "PER_KG"
                    ? `${row.quote.chargeableKg} kg chargeable${row.quote.volumetricApplied ? " (volumetric)" : ""}`
                    : `${row.quote.volumeM3?.toLocaleString("en", { maximumFractionDigits: 3 })} m³`}{" "}
                  · Shipping ≈ {formatIdr(row.quote.shippingIdr!)}
                </span>
                <span className="text-sm">
                  Insurance ≈{" "}
                  {row.insuranceIdr === null
                    ? "enter a declared value above"
                    : formatIdr(row.insuranceIdr)}
                </span>
                {row.floor ? (
                  <div className="mt-1 flex flex-col gap-1 rounded-lg border border-border p-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Price Floor
                    </span>
                    <span className="text-lg font-semibold">
                      {formatMoney(row.floor.floorPrice, fx.currency)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({formatIdr(row.floor.floorIdr)})
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      costs {formatIdr(row.floor.costsIdr)} + margin{" "}
                      {formatIdr(row.floor.marginIdr)} + fee{" "}
                      {row.floor.feePercent}% ({formatIdr(row.floor.feeIdr)})
                    </span>
                  </div>
                ) : null}
                {row.floorNote ? (
                  <span className="text-xs text-muted-foreground">
                    {row.floorNote}
                  </span>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The item's place in Draft → Cataloged → Listed → Reserved → Sold →
// Shipped. Steps move forward only, and the selling steps are the Owner's.
function LifecycleCard({
  item,
  missing,
  userRole,
}: {
  item: ItemDetail;
  missing: string[];
  userRole: "OWNER" | "CATALOGER";
}) {
  const nextStep: Record<
    ItemState,
    { to: ItemState; label: string; withChannel?: boolean } | null
  > = {
    DRAFT: null, // handled below — the completeness-gated step
    CATALOGED: { to: "LISTED", label: "Mark as Listed", withChannel: true },
    LISTED: { to: "RESERVED", label: "Mark as Reserved" },
    RESERVED: { to: "SOLD", label: "Mark as Sold" },
    SOLD: { to: "SHIPPED", label: "Mark as Shipped" },
    SHIPPED: null,
  };
  const step = nextStep[item.state];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle</CardTitle>
        <CardDescription>
          Draft → Cataloged → Listed → Reserved → Sold → Shipped. Steps move
          forward only; sold items stay in the Catalog forever.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {item.state === "DRAFT" ? (
          <>
            <p className="text-sm text-muted-foreground">
              {missing.length === 0
                ? "Everything needed is here."
                : `Still needed: ${missing.join(", ")}.`}
            </p>
            <CatalogButton itemId={item.id} />
          </>
        ) : item.state === "SHIPPED" ? (
          <p className="text-sm text-muted-foreground">
            This piece has shipped — its record is complete and it stays in
            the Catalog.
          </p>
        ) : userRole === "OWNER" && step ? (
          <TransitionForm
            itemId={item.id}
            to={step.to}
            label={step.label}
            withChannel={step.withChannel}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Selling steps are the Owner&rsquo;s — listing, reserving, and
            recording the sale happen through an Owner login.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
