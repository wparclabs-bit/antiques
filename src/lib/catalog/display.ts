import type { ItemCategory, ItemState } from "@/generated/prisma/enums";
import { CATEGORY_TEMPLATES, templateFor } from "./categories";

// Small pure helpers for rendering catalog data in pages.

export const STATE_LABELS: Record<ItemState, string> = {
  DRAFT: "Draft",
  CATALOGED: "Cataloged",
  LISTED: "Listed",
  RESERVED: "Reserved",
  SOLD: "Sold",
  SHIPPED: "Shipped",
};

export function categoryLabel(category: ItemCategory): string {
  return templateFor(category).label;
}

export function isKnownCategory(value: string): value is ItemCategory {
  return CATEGORY_TEMPLATES.some((t) => t.id === value);
}

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Currencies the family prices in (the server accepts any 3-letter code;
// this list is what the forms offer).
export const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "SGD", "JPY"] as const;

// What "any 3-letter code" means, spelled once — every form action that
// reads a currency validates against this.
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
