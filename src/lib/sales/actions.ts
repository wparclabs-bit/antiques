"use server";

import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { CURRENCY_CODE_PATTERN, MONEY_PATTERN } from "@/lib/catalog/display";
import { revalidateItemPages } from "@/lib/revalidate";
import { photoVariantUrl } from "@/lib/photos/cloudinary";
import type { MarketplaceRegion } from "@/generated/prisma/enums";

// The Sale (ticket 07) is the recorded outcome of selling: the actual price
// and currency, the Marketplace it sold through, and the date. Recording it
// marks the Item Sold — the record and the Sold transition are one action,
// and the record stays in the Catalog forever, so the family's own
// sold-price history compounds with every sale. Every family login records
// and reads (ADR-0003: one role).

export type ActionState = { error: string | null };

// The sale date arrives as YYYY-MM-DD from a date input, parsed the same
// way as a Comparable's sold date.
function parseSaleDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function recordSale(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  // The normal path records the sale of a Reserved piece and marks it Sold.
  // Items marked Sold or Shipped before sale recording existed (ticket 07
  // starts the archive; earlier states were not backdated) can still get
  // their record attached — the archive must not have a hole in it — but
  // their state does not move again.
  const existing = await prisma.sale.findUnique({ where: { itemId } });
  if (existing) {
    return { error: "The sale is already recorded on this item." };
  }
  if (item.state !== "RESERVED" && item.state !== "SOLD" && item.state !== "SHIPPED") {
    return {
      error: `Only a Reserved item can be marked Sold — this one is ${item.state.toLowerCase()}.`,
    };
  }

  const priceRaw = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const marketplaceId = String(formData.get("marketplaceId") ?? "");
  const soldOnRaw = String(formData.get("soldOn") ?? "").trim();

  if (!MONEY_PATTERN.test(priceRaw) || Number(priceRaw) === 0) {
    return { error: "Enter the sale price as a positive number, up to 2 decimals." };
  }
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    return { error: "Enter the 3-letter currency code the buyer paid in." };
  }

  const marketplace = await prisma.marketplace.findUnique({
    where: { id: marketplaceId },
  });
  if (!marketplace) {
    return { error: "Choose the marketplace the item sold on." };
  }

  const soldOn = parseSaleDate(soldOnRaw);
  if (!soldOn) {
    return { error: "Enter the date the item sold." };
  }
  // The family records sales from Indonesia (UTC+7): early on their morning,
  // today's date at UTC midnight is still ahead of the server clock. The
  // slack lets every timezone record today; a typo'd future date is caught.
  if (soldOn.getTime() > Date.now() + 14 * 60 * 60 * 1000) {
    return { error: "The sale date cannot be in the future." };
  }

  // Everything commits together or not at all: a half-recorded sale (the
  // record without the Sold state, or the reverse) would strand the item —
  // the "already recorded" guard would block every retry. The
  // archive-mending path (item already Sold or Shipped) writes the record
  // alone; the state does not move again.
  await prisma.$transaction([
    prisma.sale.create({
      data: {
        itemId,
        marketplaceId,
        price: priceRaw,
        currency,
        soldOn,
      },
    }),
    ...(item.state === "RESERVED"
      ? [
          prisma.item.update({
            where: { id: itemId },
            data: { state: "SOLD" },
          }),
          prisma.lifecycleEvent.create({
            data: { itemId, state: "SOLD" },
          }),
        ]
      : []),
  ]);

  revalidateItemPages(itemId);
  return { error: null };
}

export type SaleView = {
  price: number;
  currency: string;
  soldOn: Date;
  marketplace: {
    id: string;
    name: string;
    region: MarketplaceRegion;
  };
};

// The Item's sale record, if it has one. Family finance, family eyes:
// every signed-in family login reads it (ADR-0003).
export async function getSale(itemId: string): Promise<SaleView | null> {
  await requireUser();

  const sale = await prisma.sale.findUnique({
    where: { itemId },
    include: { marketplace: true },
  });
  if (!sale) return null;

  return {
    price: Number(sale.price),
    currency: sale.currency,
    soldOn: sale.soldOn,
    marketplace: {
      id: sale.marketplace.id,
      name: sale.marketplace.name,
      region: sale.marketplace.region,
    },
  };
}

// ---------------------------------------------------------------------------
// The Sale log (ticket 10): every recorded sale in one place, newest first
// — the compounding price database made visible. A read, not a record:
// sales are recorded on the Item (recordSale), never here.
// ---------------------------------------------------------------------------

export type SaleLogEntryView = {
  itemId: string;
  itemName: string;
  // The first photo's 400px variant; null when the piece has no photos.
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  soldOn: Date;
  marketplaceName: string;
};

export async function getSaleLog(): Promise<SaleLogEntryView[]> {
  await requireUser();

  const rows = await prisma.sale.findMany({
    orderBy: [{ soldOn: "desc" }, { createdAt: "desc" }],
    include: {
      marketplace: true,
      item: { include: { photos: { orderBy: { position: "asc" } } } },
    },
  });
  return rows.map((row) => ({
    itemId: row.itemId,
    itemName: row.item.name,
    thumbnailUrl:
      row.item.photos[0] !== undefined
        ? photoVariantUrl(row.item.photos[0], "thumbnail")
        : null,
    price: Number(row.price),
    currency: row.currency,
    soldOn: row.soldOn,
    marketplaceName: row.marketplace.name,
  }));
}
