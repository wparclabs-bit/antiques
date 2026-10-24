import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getItem, type ItemDetail } from "@/lib/catalog/actions";
import { getComparables, getSoldSearchLinks, getValuation } from "@/lib/valuation/actions";
import { getShippingSettings, estimateShipping, type ShippingEstimateView } from "@/lib/shipping/actions";
import { getListings, type ListingsView } from "@/lib/listings/actions";
import {
  getSocialPlatforms,
  getSocialPosts,
  type SocialPostView,
} from "@/lib/social/actions";
import { getItemHistory, type LifecycleHistoryView } from "@/lib/lifecycle/actions";
import type { SaleView } from "@/lib/sales/actions";
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
import { RecordSaleForm, SkbcbForm, TransitionForm } from "./lifecycle-forms";
import type { MarketplaceOption } from "./listing-forms";
import { ListingsCard, ListingsSocial } from "./listings-card";
import { DossierTabs } from "./dossier-tabs";
import { RecordSocialPostForm } from "./social-forms";
import {
  AddComparableForm,
  RemoveComparableButton,
  SetValuationForm,
} from "./valuation-forms";
import { RemoveSocialPostButton } from "./social-forms";

// The page reads the session cookie, so it must render per request.
export const instant = false;

// The item dossier (ticket 10): photo hero + stage stamp + a one-line
// status summary up top, then five tabs — Record (the family's core
// record), Sale, Marketing, Shipping & export, History. The ten cards the
// page used to stack are all regrouped in here, none removed.
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

  // One fetch per domain; the tabs below share the results.
  const [
    comparables,
    valuation,
    searchLinks,
    shippingSettings,
    listingsView,
    posts,
    platforms,
    history,
  ] = await Promise.all([
    getComparables(item.id),
    getValuation(item.id),
    getSoldSearchLinks(item.id),
    getShippingSettings(),
    getListings(item.id, zone),
    getSocialPosts(item.id),
    getSocialPlatforms(),
    getItemHistory(item.id),
  ]);

  const estimate =
    shippingSettings && zone
      ? await estimateShipping({
          itemId: item.id,
          zone,
          marketplaceId,
          declaredValueIdr,
        })
      : null;

  const marketplaces: MarketplaceOption[] =
    shippingSettings?.marketplaces ?? [];
  const defaultCurrency =
    shippingSettings?.settings.fxMarketplaceCurrency ?? "USD";

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
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.name}
              </h1>
              {/* The stage stamp: the dossier's anchor. */}
              <Badge>{STATE_LABELS[item.state]}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
              {item.fiftyYearsOld ? (
                <Badge variant="outline">50+ years — SKBCB needed abroad</Badge>
              ) : null}
            </div>
            <StatusSummary
              state={item.state}
              listingsView={listingsView}
              posts={posts}
              sale={history.sale}
            />
          </div>
          <Button variant="outline" render={<Link href={`/items/${id}/edit`} />}>
            Edit
          </Button>
        </div>
      </header>

      {/* The photo hero: the record's face. Management (add/remove) lives
          in the Record tab. */}
      <PhotoHero photos={item.photos} name={item.name} />

      <DossierTabs
        tabs={[
          {
            label: "Record",
            content: (
              <RecordSection item={item} template={template} missing={missing} />
            ),
          },
          {
            label: "Sale",
            content: (
              <SaleSection
                item={item}
                comparables={comparables}
                valuation={valuation}
                searchLinks={searchLinks}
                listingsView={listingsView}
                marketplaces={marketplaces}
                defaultCurrency={defaultCurrency}
                zone={zone}
              />
            ),
          },
          {
            label: "Marketing",
            content: (
              <MarketingSection
                listingsView={listingsView}
                item={item}
                posts={posts}
                platforms={platforms.map((platform) => platform.name)}
              />
            ),
          },
          {
            label: "Shipping & export",
            content: (
              <ShippingSection
                item={item}
                shippingSettings={shippingSettings}
                estimate={estimate}
                zone={zone}
                marketplaceId={marketplaceId}
                declared={declaredRaw}
              />
            ),
          },
          {
            label: "History",
            content: (
              <LifecycleCard
                item={item}
                missing={missing}
                marketplaces={marketplaces}
                defaultCurrency={defaultCurrency}
                history={history}
              />
            ),
          },
        ]}
      />
    </main>
  );
}

// One line under the title answering the Owner's question — where is this
// piece right now? Listed where, marketed where, sold for what. Each part
// is dropped when it has nothing to say yet.
function StatusSummary({
  state,
  listingsView,
  posts,
  sale,
}: {
  state: ItemState;
  listingsView: ListingsView | null;
  posts: SocialPostView[];
  sale: SaleView | null;
}) {
  const activeNames =
    listingsView?.listings
      .filter((listing) => listing.status === "ACTIVE")
      .map((listing) => listing.marketplace.name) ?? [];
  const plannedNames =
    listingsView?.listings
      .filter((listing) => listing.status === "PLANNED")
      .map((listing) => listing.marketplace.name) ?? [];
  const platforms = [...new Set(posts.map((post) => post.platform))];

  const parts: string[] = [];
  if (activeNames.length > 0) {
    parts.push(`Listed on ${activeNames.join(", ")}`);
  } else if (plannedNames.length > 0) {
    parts.push(`Planned on ${plannedNames.join(", ")}`);
  } else if (state !== "DRAFT" && state !== "CATALOGED") {
    parts.push("No active listing");
  }
  if (platforms.length > 0) {
    parts.push(`Marketed on ${platforms.join(", ")}`);
  }
  if (sale) {
    parts.push(
      `Sold ${formatMoney(sale.price, sale.currency)} · ${sale.marketplace.name}`
    );
  }

  if (parts.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
  );
}

// The hero: first photo large, the rest as a thumb strip. Photo storage
// not configured shows the honest placeholder, like every other view.
function PhotoHero({
  photos,
  name,
}: {
  photos: ItemDetail["photos"];
  name: string;
}) {
  const [first, ...rest] = photos;
  if (!first) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No photos yet — add the first one in the Record tab.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {first.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={first.url}
          alt={name}
          className="aspect-video w-full rounded-xl border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
          Photo stored — display needs Cloudinary configured (see README)
        </div>
      )}
      {rest.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {rest.map((photo) => (
            <li key={photo.id}>
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={name}
                  className="size-16 rounded-lg border border-border object-cover"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.6rem] leading-tight text-muted-foreground">
                  stored
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// RECORD — the family's core record: photo management, the category's own
// fields, condition, provenance.
function RecordSection({
  item,
  template,
  missing,
}: {
  item: ItemDetail;
  template: ReturnType<typeof templateFor>;
  missing: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            Stored once; marketplace-sized variants are derived automatically.
            At least one is needed before this item can be marked Cataloged.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {item.photos.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {item.photos.map((photo) => (
                <li key={photo.id} className="flex w-20 flex-col gap-1.5">
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={item.name}
                      className="size-20 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.6rem] leading-tight text-muted-foreground">
                      stored
                    </span>
                  )}
                  <RemovePhotoButton photoId={photo.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
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
    </div>
  );
}

// SALE — everything money about selling this piece: the research links,
// the comparables and valuation behind the price, the cost basis, and the
// listings with their marketplace packages and Price Floors.
function SaleSection({
  item,
  comparables,
  valuation,
  searchLinks,
  listingsView,
  marketplaces,
  defaultCurrency,
  zone,
}: {
  item: ItemDetail;
  comparables: Awaited<ReturnType<typeof getComparables>>;
  valuation: Awaited<ReturnType<typeof getValuation>>;
  searchLinks: Awaited<ReturnType<typeof getSoldSearchLinks>>;
  listingsView: ListingsView | null;
  marketplaces: MarketplaceOption[];
  defaultCurrency: string;
  zone: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
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

      {searchLinks !== null ? (
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

      {listingsView !== null ? (
        <ListingsCard
          view={listingsView}
          marketplaces={marketplaces}
          defaultCurrency={defaultCurrency}
          zone={zone}
        />
      ) : null}
    </div>
  );
}

// MARKETING — the social drafts generated from each listing (ticket 08)
// and the posting log of what actually went out (spec story 34).
function MarketingSection({
  listingsView,
  item,
  posts,
  platforms,
}: {
  listingsView: ListingsView | null;
  item: ItemDetail;
  posts: SocialPostView[];
  platforms: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Social drafts</CardTitle>
          <CardDescription>
            An Instagram caption with hashtags, a story text, and a Facebook
            post generated from each listing&rsquo;s own offer — copy-ready
            in one action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listingsView !== null ? (
            <ListingsSocial view={listingsView} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Drafts appear once a listing is recorded.
            </p>
          )}
        </CardContent>
      </Card>

      <PostingLogCard item={item} posts={posts} platforms={platforms} />
    </div>
  );
}

// The posting log card: where and when this item was posted, so marketing
// effort is visible and never repeated by accident. The platform picker
// reads the Settings-managed list (ticket 10).
function PostingLogCard({
  item,
  posts,
  platforms,
}: {
  item: ItemDetail;
  posts: SocialPostView[];
  platforms: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Posting log</CardTitle>
        <CardDescription>
          Where and when this item was posted — marketing effort stays
          visible and nothing goes out twice by accident.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing posted yet — log the first post below.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {posts.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">
                    {entry.platform}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {formatDate(entry.postedOn)}
                    </span>
                  </span>
                  {entry.notes ? (
                    <span className="text-xs text-muted-foreground">
                      {entry.notes}
                    </span>
                  ) : null}
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {entry.url}
                    </a>
                  ) : null}
                </div>
                <RemoveSocialPostButton postId={entry.id} />
              </li>
            ))}
          </ul>
        )}
        <RecordSocialPostForm itemId={item.id} platforms={platforms} />
      </CardContent>
    </Card>
  );
}

// SHIPPING & EXPORT — what a sale of this piece truly costs, and the
// certificate that gates international listings.
function ShippingSection({
  item,
  shippingSettings,
  estimate,
  zone,
  marketplaceId,
  declared,
}: {
  item: ItemDetail;
  shippingSettings: Awaited<ReturnType<typeof getShippingSettings>>;
  estimate: ShippingEstimateView | null;
  zone: string | null;
  marketplaceId: string | null;
  declared: string;
}) {
  if (shippingSettings === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-6">
      <ShippingCard
        itemId={item.id}
        settings={shippingSettings}
        estimate={estimate}
        zone={zone}
        marketplaceId={marketplaceId}
        declared={declared}
      />
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
    </div>
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
// Shipped, with the history of every step it has taken (ticket 07). Steps
// move forward only; Sold is reached by recording the sale rather than by
// a bare transition.
function LifecycleCard({
  item,
  missing,
  marketplaces,
  defaultCurrency,
  history,
}: {
  item: ItemDetail;
  missing: string[];
  marketplaces: MarketplaceOption[];
  defaultCurrency: string;
  history: LifecycleHistoryView;
}) {
  // The item's next lifecycle step. Cataloged → Listed follows the recorded
  // Listings: the action itself demands an active listing and reads the
  // domestic/international distinction off it. Reserved → Sold is the
  // record-sale form instead; Sold → Shipped closes the machine.
  const nextStep: Partial<
    Record<ItemState, { to: ItemState; label: string }>
  > = {
    CATALOGED: { to: "LISTED", label: "Mark as Listed" },
    LISTED: { to: "RESERVED", label: "Mark as Reserved" },
    SOLD: { to: "SHIPPED", label: "Mark as Shipped" },
  };
  const step = nextStep[item.state];

  // The archive-mending form for pieces marked Sold (or Shipped) before
  // sale recording existed — the archive must keep no holes.
  const needsSaleRecord =
    (item.state === "SOLD" || item.state === "SHIPPED") &&
    history.sale === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle</CardTitle>
        <CardDescription>
          Draft → Cataloged → Listed → Reserved → Sold → Shipped. Steps move
          forward only; sold items stay in the Catalog forever, with their
          sale record.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {item.state === "DRAFT" ? (
          <>
            <p className="text-sm text-muted-foreground">
              {missing.length === 0
                ? "Everything needed is here."
                : `Still needed: ${missing.join(", ")}.`}
            </p>
            <CatalogButton itemId={item.id} />
          </>
        ) : needsSaleRecord ? (
          <RecordSaleForm
            itemId={item.id}
            marketplaces={marketplaces}
            defaultCurrency={defaultCurrency}
            repair
          />
        ) : item.state === "SHIPPED" ? (
          <p className="text-sm text-muted-foreground">
            This piece has shipped — its record is complete and it stays in
            the Catalog.
          </p>
        ) : item.state === "RESERVED" ? (
          <RecordSaleForm
            itemId={item.id}
            marketplaces={marketplaces}
            defaultCurrency={defaultCurrency}
          />
        ) : step ? (
          <TransitionForm itemId={item.id} to={step.to} label={step.label} />
        ) : null}

        <HistoryList history={history} />
      </CardContent>
    </Card>
  );
}

// How each history line reads: a birth for Draft, steps taken after it.
const HISTORY_LABELS: Record<ItemState, string> = {
  DRAFT: "Recorded as Draft",
  CATALOGED: "Marked Cataloged",
  LISTED: "Listed",
  RESERVED: "Reserved",
  SOLD: "Sold",
  SHIPPED: "Shipped",
};

// Every state the item has entered, oldest first, with the sale record
// beside its Sold step.
function HistoryList({ history }: { history: LifecycleHistoryView }) {
  const soldEvent = history.events.find((event) => event.state === "SOLD");

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        History
      </h3>
      <ol className="flex flex-col">
        {history.events.map((event) => {
          // The sale record rides on the Sold step, dated by the actual
          // sale — not the day the button was pressed.
          const sale = event.state === "SOLD" ? history.sale : null;
          return (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-1 text-sm"
            >
              <span>
                {HISTORY_LABELS[event.state]}
                {sale ? <SaleSummary sale={sale} /> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(sale ? sale.soldOn : event.at)}
              </span>
            </li>
          );
        })}
        {/* A sale attached after the fact (archive repair) has no Sold
            event to ride on — it closes the list on its own line. */}
        {history.sale && !soldEvent ? (
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-1 text-sm">
            <span>
              {HISTORY_LABELS.SOLD}
              <SaleSummary sale={history.sale} />
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(history.sale.soldOn)}
            </span>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

// The price and marketplace of the recorded sale, inline after "Sold".
function SaleSummary({ sale }: { sale: SaleView }) {
  return (
    <span className="text-muted-foreground">
      {" "}
      · {formatMoney(sale.price, sale.currency)} · {sale.marketplace.name}
    </span>
  );
}
