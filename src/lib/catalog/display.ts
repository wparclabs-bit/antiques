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
