"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { buildSoldSearchLinks } from "./search-links";
import type { Prisma } from "@/generated/prisma/client";

// Pricing evidence and pricing judgment are the Owner's domain (spec stories
// 13 and 15 are Owner stories; the Cataloger role is scoped to capturing
// Items). Every write below requires the Owner role on the server, and the
// reads return null for anyone else — the same pattern as cost basis.

export type ActionState = { error: string | null };

export type ComparableView = {
  id: string;
  source: string;
  url: string | null;
  soldOn: Date;
  price: number;
  currency: string;
  notes: string | null;
};

export type ValuationView = {
  current: {
    minPrice: number;
    maxPrice: number;
    currency: string;
    setAt: Date;
  } | null;
  history: {
    id: string;
    minPrice: number;
    maxPrice: number;
    currency: string;
    setAt: Date;
    setByName: string;
  }[];
};

const MAX_TEXT_LENGTH = 200;
const MAX_URL_LENGTH = 500;
const MONEY_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function itemAttributes(item: { attributes: Prisma.JsonValue }) {
  return (item.attributes ?? {}) as Record<string, string | number>;
}

async function loadItem(itemId: string) {
  return prisma.item.findUnique({ where: { id: itemId } });
}

export async function addComparable(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await loadItem(itemId);
  if (!item) {
    return { error: "Item not found." };
  }

  const source = String(formData.get("source") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const soldOn = String(formData.get("soldOn") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "")
    .trim()
    .toUpperCase();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!source || source.length > MAX_TEXT_LENGTH) {
    return { error: "Enter where the sale happened (e.g. eBay)." };
  }
  if (url && (!/^https?:\/\//.test(url) || url.length > MAX_URL_LENGTH)) {
    return { error: "The link must start with http:// or https://." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soldOn)) {
    return { error: "Enter the date the item sold." };
  }
  const soldAt = new Date(`${soldOn}T00:00:00.000Z`);
  if (Number.isNaN(soldAt.getTime())) {
    return { error: "Enter the date the item sold." };
  }
  if (soldAt.getTime() > Date.now()) {
    return { error: "The sold date cannot be in the future." };
  }
  if (!MONEY_PATTERN.test(price)) {
    return { error: "Enter the sold price as a number, up to 2 decimals." };
  }
  if (!CURRENCY_PATTERN.test(currency)) {
    return { error: "Enter the 3-letter currency code, e.g. USD or EUR." };
  }

  await prisma.comparable.create({
    data: {
      itemId,
      source,
      url: url || null,
      soldOn: soldAt,
      price,
      currency,
      notes: notes || null,
    },
  });

  revalidatePath(`/items/${itemId}`);
  return { error: null };
}

export async function removeComparable(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const comparableId = String(formData.get("comparableId") ?? "");
  const comp = await prisma.comparable.findUnique({ where: { id: comparableId } });
  if (!comp) {
    return { error: "Comparable not found." };
  }

  await prisma.comparable.delete({ where: { id: comparableId } });
  revalidatePath(`/items/${comp.itemId}`);
  return { error: null };
}

export async function setValuation(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await loadItem(itemId);
  if (!item) {
    return { error: "Item not found." };
  }

  const minPrice = String(formData.get("minPrice") ?? "").trim();
  const maxPrice = String(formData.get("maxPrice") ?? "").trim();
  const currency = String(formData.get("currency") ?? "")
    .trim()
    .toUpperCase();

  if (!MONEY_PATTERN.test(minPrice) || !MONEY_PATTERN.test(maxPrice)) {
    return { error: "Enter both prices as numbers, up to 2 decimals." };
  }
  if (Number(maxPrice) < Number(minPrice)) {
    return { error: "The maximum must be at least the minimum." };
  }
  if (!CURRENCY_PATTERN.test(currency)) {
    return { error: "Enter the 3-letter currency code, e.g. USD or EUR." };
  }

  // Every set is a new row: the table IS the history (GLOSSARY.md).
  await prisma.valuation.create({
    data: {
      itemId,
      minPrice,
      maxPrice,
      currency,
      setById: user.id,
    },
  });

  revalidatePath(`/items/${itemId}`);
  return { error: null };
}

export async function getComparables(
  itemId: string
): Promise<ComparableView[] | null> {
  const user = await requireUser();
  if (user.role !== "OWNER") return null;

  const rows = await prisma.comparable.findMany({
    where: { itemId },
    orderBy: { soldOn: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    url: row.url,
    soldOn: row.soldOn,
    price: Number(row.price),
    currency: row.currency,
    notes: row.notes,
  }));
}

export async function getValuation(itemId: string): Promise<ValuationView | null> {
  const user = await requireUser();
  if (user.role !== "OWNER") return null;

  const rows = await prisma.valuation.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    include: { setBy: { select: { name: true } } },
  });

  const history = rows.map((row) => ({
    id: row.id,
    minPrice: Number(row.minPrice),
    maxPrice: Number(row.maxPrice),
    currency: row.currency,
    setAt: row.createdAt,
    setByName: row.setBy.name,
  }));
  const latest = history[0];

  return {
    current: latest
      ? {
          minPrice: latest.minPrice,
          maxPrice: latest.maxPrice,
          currency: latest.currency,
          setAt: latest.setAt,
        }
      : null,
    history,
  };
}

export async function getSoldSearchLinks(itemId: string) {
  // Part of the pricing toolkit (story 14 is an Owner story) — same gate as
  // the comparables card it feeds.
  await requireOwner();

  const item = await loadItem(itemId);
  if (!item) return null;

  return buildSoldSearchLinks({
    name: item.name,
    category: item.category,
    attributes: itemAttributes(item),
  });
}
