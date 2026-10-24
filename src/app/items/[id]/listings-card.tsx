import { getListings } from "@/lib/listings/actions";
import { attachmentUrl } from "@/lib/photos/cloudinary";
import { formatDate, formatIdr, formatMoney } from "@/lib/catalog/display";
import type { ListingStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CopyPackageButton,
  ListingStatusButton,
  RecordListingForm,
  type MarketplaceOption,
} from "./listing-forms";

// Listings & draft packages (ticket 06): every offer recorded against this
// Item, each with its marketplace-formatted package — copy-ready in one
// action with its photo bundle — and the Price Floor beside the intended
// price. Owner-only; the zone is whatever the Shipping & Price Floor card
// above has chosen, so the two pictures agree.

const STATUS_BADGES: Record<
  ListingStatus,
  { label: string; variant: "outline" | "default" | "secondary" }
> = {
  PLANNED: { label: "Planned", variant: "outline" },
  ACTIVE: { label: "Active", variant: "default" },
  ENDED: { label: "Ended", variant: "secondary" },
};

export async function ListingsCard({
  itemId,
  marketplaces,
  defaultCurrency,
  zone,
}: {
  itemId: string;
  marketplaces: MarketplaceOption[];
  defaultCurrency: string;
  zone: string | null;
}) {
  const view = await getListings(itemId, zone);
  if (!view) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listings & draft packages</CardTitle>
        <CardDescription>
          One Item can be offered on several marketplaces at once. Each
          listing&rsquo;s package — title, description from this
          item&rsquo;s record, price, photos sized to the marketplace —
          copies in one action. Activating a listing on an international
          marketplace needs this item&rsquo;s SKBCB certificate when it is
          flagged 50+ years.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {view.listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No listings recorded yet — add the first offer below.
          </p>
        ) : null}

        {view.listings.map((listing) => {
          const badge = STATUS_BADGES[listing.status];
          return (
            <div
              key={listing.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {listing.marketplace.name}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <Badge variant="secondary">
                    {listing.marketplace.region === "DOMESTIC"
                      ? "Domestic"
                      : "International"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    recorded {formatDate(listing.createdAt)} · fee{" "}
                    {listing.marketplace.feePercent}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {listing.status === "PLANNED" ? (
                    <>
                      <ListingStatusButton
                        listingId={listing.id}
                        to="ACTIVE"
                        label="Mark active"
                      />
                      <ListingStatusButton
                        listingId={listing.id}
                        to="ENDED"
                        label="Discard"
                      />
                    </>
                  ) : listing.status === "ACTIVE" ? (
                    <ListingStatusButton
                      listingId={listing.id}
                      to="ENDED"
                      label="Mark ended"
                    />
                  ) : null}
                </div>
              </div>

              {/* The intended price with the floor beside it. */}
              <div className="flex flex-col gap-1">
                <span className="text-sm">
                  <span className="font-medium">Price:</span>{" "}
                  {formatMoney(listing.price, listing.currency)}
                  {listing.floor ? (
                    <>
                      {" "}
                      <span className="text-muted-foreground">·</span>{" "}
                      <span className="font-medium">Price Floor:</span>{" "}
                      {formatMoney(listing.floor.floorPrice, view.fx.currency)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({formatIdr(listing.floor.floorIdr)}
                        {listing.floor.includesShipping && listing.floor.viaForwarder
                          ? ` — via ${listing.floor.viaForwarder}, shipping to ${zone} included`
                          : ""}
                        )
                      </span>
                    </>
                  ) : null}
                </span>
                {listing.floorNote ? (
                  <span className="text-xs text-muted-foreground">
                    {listing.floorNote}
                  </span>
                ) : null}
                {listing.priceBelowFloorBy ? (
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    Below your Price Floor by{" "}
                    {formatMoney(
                      listing.priceBelowFloorBy.amount,
                      listing.priceBelowFloorBy.currency
                    )}
                  </span>
                ) : null}
              </div>

              {listing.draft ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Title
                    </span>
                    <p className="rounded-lg border border-border p-2.5 text-sm">
                      {listing.draft.title}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Description
                    </span>
                    <pre className="whitespace-pre-wrap rounded-lg border border-border p-2.5 font-sans text-sm">
                      {listing.draft.description}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Photos ({listing.draft.photoUrls.length}) — click to
                      download the sized bundle
                    </span>
                    <ul className="flex flex-wrap gap-2">
                      {listing.draft.photoUrls.map((url, index) => (
                        <li key={index}>
                          {url ? (
                            <a
                              href={attachmentUrl(url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm underline-offset-2 hover:underline"
                            >
                              Photo {index + 1}
                            </a>
                          ) : (
                            <span className="inline-flex h-8 items-center rounded-lg border border-dashed border-border px-2.5 text-sm text-muted-foreground">
                              Photo {index + 1} — needs Cloudinary configured
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <CopyPackageButton text={listing.draft.packageText} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This listing has ended — its package is no longer needed;
                  relisting is a new listing.
                </p>
              )}
            </div>
          );
        })}

        <RecordListingForm
          itemId={itemId}
          marketplaces={marketplaces}
          defaultCurrency={defaultCurrency}
        />
      </CardContent>
    </Card>
  );
}
