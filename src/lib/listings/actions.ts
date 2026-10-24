"use server";

import { revalidateItemPages } from "@/lib/revalidate";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { CURRENCY_CODE_PATTERN, MONEY_PATTERN } from "@/lib/catalog/display";
import { ensureShippingSeed, readPricingDefaults } from "@/lib/shipping/seed";
import { shippingMeasurements } from "@/lib/shipping/estimates";
import { exportGateBlocks, SKBCB_BLOCKED_MESSAGE } from "@/lib/lifecycle/lifecycle";
import {
  buildListingDraft,
  buildPackageText,
  formatForMarketplace,
  type DraftItemInput,
} from "./drafts";
import { listingFloor, type FloorRateCard, type ListingFloor } from "./floors";
import { buildSocialDrafts, type SocialDrafts } from "@/lib/social/drafts";
import type { ListingStatus, MarketplaceRegion } from "@/generated/prisma/enums";

// Listings and their draft packages (ticket 06). Family business (spec
// stories 22–27; ADR-0003): every signed-in family login records, reads,
// and drives these — signing in is the gate, like everywhere else.

export type ActionState = { error: string | null };

// A database that skipped the seed still gets its marketplaces on first
// write; afterwards the rows are the Owner's to edit.
async function ensureMarketplacesSeeded() {
  if ((await prisma.marketplace.count()) === 0) {
    await ensureShippingSeed();
  }
}

// Records an offer to sell one Item on one Marketplace (GLOSSARY.md:
// Listing) — one Item can carry several Listings at once. New Listings
// start planned; going active is its own, gate-checked step. Prices follow
// the money model: the marketplace's currency for international channels
// (the single FX setting names it), IDR for domestic ones.
export async function recordListing(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const marketplaceId = String(formData.get("marketplaceId") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  await ensureMarketplacesSeeded();
  const marketplace = await prisma.marketplace.findUnique({
    where: { id: marketplaceId },
  });
  if (!marketplace) {
    return { error: "Choose a marketplace from the list." };
  }

  if (!MONEY_PATTERN.test(priceRaw) || Number(priceRaw) === 0) {
    return { error: "Enter the price as a positive number with up to 2 decimals." };
  }
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    return { error: "Enter the 3-letter currency code the marketplace pays in." };
  }

  const pricing = await readPricingDefaults();
  const requiredCurrency =
    marketplace.region === "DOMESTIC" ? "IDR" : pricing.fx.currency;
  if (currency !== requiredCurrency) {
    return {
      error: `${marketplace.name} listings price in ${requiredCurrency}${
        marketplace.region === "DOMESTIC"
          ? ""
          : " — the marketplace currency in your FX settings"
      }. Adjust the currency, or change the FX setting first.`,
    };
  }

  await prisma.listing.create({
    data: {
      itemId,
      marketplaceId,
      price: priceRaw,
      currency,
    },
  });

  revalidateItemPages(itemId);
  return { error: null };
}

// The listing's own lifecycle, forward only: PLANNED → ACTIVE → ENDED (a
// planned listing may also be abandoned straight to ENDED — never posted is
// still ended). Activating on an international Marketplace is where the
// export gate (ADR-0002) binds for offers; domestic channels are never
// blocked.
export async function setListingStatus(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const listingId = String(formData.get("listingId") ?? "");
  const to = String(formData.get("to") ?? "");

  if (to !== "ACTIVE" && to !== "ENDED") {
    return { error: "Unknown listing step." };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { item: true, marketplace: true },
  });
  if (!listing) {
    return { error: "Listing not found." };
  }

  if (to === "ACTIVE") {
    if (listing.status !== "PLANNED") {
      return {
        error: `Only a planned listing can go active — this one is already ${listing.status.toLowerCase()}.`,
      };
    }
    // An offer goes public only for a fully cataloged piece, and never for
    // one already committed or sold. (Not canTransition: a LISTED item may
    // still open a new channel, and that self-loop is not in the item
    // lifecycle's transition table.)
    if (listing.item.state === "DRAFT") {
      return {
        error: "Finish cataloging this item before its listing goes active.",
      };
    }
    if (
      listing.item.state === "RESERVED" ||
      listing.item.state === "SOLD" ||
      listing.item.state === "SHIPPED"
    ) {
      return {
        error: `This piece is already ${listing.item.state.toLowerCase()} — record a listing only before it is reserved.`,
      };
    }
    if (
      listing.marketplace.region === "INTERNATIONAL" &&
      exportGateBlocks(listing.item)
    ) {
      return { error: SKBCB_BLOCKED_MESSAGE };
    }
  } else if (listing.status === "ENDED") {
    return { error: "This listing is already ended." };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { status: to as "ACTIVE" | "ENDED" },
  });

  revalidateItemPages(listing.itemId);
  return { error: null };
}

export type ListingDraftView = {
  title: string;
  description: string;
  photoUrls: (string | null)[];
  packageText: string;
};

export type ListingFloorView = ListingFloor;

export type ListingView = {
  id: string;
  marketplace: {
    id: string;
    name: string;
    region: MarketplaceRegion;
    feePercent: number;
  };
  price: number;
  currency: string;
  status: ListingStatus;
  createdAt: Date;
  draft: ListingDraftView | null;
  // The social drafts (ticket 08) promoting this listing's offer — null
  // for an ended one, like its marketplace package.
  social: SocialDrafts | null;
  floor: ListingFloorView | null;
  floorNote: string | null;
  priceBelowFloorBy: { amount: number; currency: string } | null;
};

export type ListingsView = {
  item: { id: string; name: string; state: string };
  fx: { currency: string; idrPerUnit: number };
  listings: ListingView[];
};

// Every Listing on the Item, newest first, each with its draft package and
// the Price Floor beside its intended price. `zone` is the destination zone
// the item page's estimate form chose — when present the floor includes the
// cheapest forwarder's shipping; without it the floor still shows, flagged
// as excluding shipping (a floor that silently vanished would be worse).
export async function getListings(
  itemId: string,
  zone?: string | null
): Promise<ListingsView | null> {
  await requireUser();

  await ensureMarketplacesSeeded();

  const zoneChosen = typeof zone === "string" && zone.trim() !== "" ? zone.trim() : null;

  const [item, pricing, rateRows] = await Promise.all([
    prisma.item.findUnique({
      where: { id: itemId },
      include: {
        photos: { orderBy: { position: "asc" } },
        listings: { include: { marketplace: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    readPricingDefaults(),
    zoneChosen
      ? prisma.forwarderRate.findMany({ where: { zone: zoneChosen } })
      : Promise.resolve([]),
  ]);
  if (!item) return null;

  // The zone's rates load once; each listing's floor is pure maths over
  // them (its own price, currency, and marketplace fee).
  const rates: FloorRateCard[] = rateRows.map((rate) => ({
    forwarder: rate.forwarder,
    basis: rate.basis,
    rateIdr: rate.rateIdr,
    maxKgPerPiece: rate.maxKgPerPiece,
    volumetricDivisor: rate.volumetricDivisor,
    insurancePercent: Number(rate.insurancePercent),
    insuranceMinimumIdr: rate.insuranceMinimumIdr,
  }));
  const measurements = shippingMeasurements(
    (item.attributes ?? {}) as Record<string, string | number>
  );

  const draftInput: DraftItemInput = {
    name: item.name,
    category: item.category,
    attributes: (item.attributes ?? {}) as Record<string, string | number>,
    conditionNotes: item.conditionNotes,
    provenance: item.provenance,
    fiftyYearsOld: item.fiftyYearsOld,
    photos: item.photos.map((photo) => ({
      publicId: photo.publicId,
      format: photo.format,
    })),
  };

  const listings: ListingView[] = item.listings.map((row) => {
    // An ended offer needs no package and no social drafts — relisting is
    // a new Listing.
    const ended = row.status === "ENDED";
    const format = formatForMarketplace(row.marketplace.name);
    const built = buildListingDraft(format, draftInput);
    const price = Number(row.price);
    const offer = {
      marketplaceName: row.marketplace.name,
      price,
      currency: row.currency,
    };
    const { floor, note, priceBelowFloorBy } = listingFloor({
      costBasisIdr: item.costBasisIdr,
      price,
      currency: row.currency,
      marketplaceFeePercent: Number(row.marketplace.feePercent),
      marginPercent: pricing.marginPercent,
      fxCurrency: pricing.fx.currency,
      fxIdrPerUnit: pricing.fx.idrPerUnit,
      measurements,
      rates,
    });
    return {
      id: row.id,
      marketplace: {
        id: row.marketplace.id,
        name: row.marketplace.name,
        region: row.marketplace.region,
        feePercent: Number(row.marketplace.feePercent),
      },
      price,
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt,
      draft: ended
        ? null
        : {
            ...built,
            packageText: buildPackageText({
              ...offer,
              format,
              draft: built,
            }),
          },
      social: ended
        ? null
        : buildSocialDrafts({ item: draftInput, listing: offer }),
      floor,
      floorNote: note,
      priceBelowFloorBy,
    };
  });

  return {
    item: { id: item.id, name: item.name, state: item.state },
    fx: pricing.fx,
    listings,
  };
}
