import type { ItemCategory } from "@/generated/prisma/enums";
import { templateFor } from "@/lib/catalog/categories";

// Sold-search links, assembled deterministically from an Item's attributes
// (spec: "no AI dependency in v1"). eBay exposes a sold+completed filter on
// its public search; Etsy has no sold-only search, so its link is a plain
// search where the Owner eyeballs sold badges on comparable listings.

export type SoldSearchLinks = {
  ebay: string;
  etsy: string;
};

const MAX_QUERY_LENGTH = 80;

export type SoldSearchInput = {
  name: string;
  category: ItemCategory;
  attributes: Record<string, string | number>;
};

export function buildSoldSearchQuery(input: SoldSearchInput): string {
  const parts = [input.name];
  for (const field of templateFor(input.category).fields) {
    if (field.identifying && input.attributes[field.key] !== undefined) {
      parts.push(String(input.attributes[field.key]));
    }
  }
  // Keep whole search terms: a hard slice could cut a word (or an encoded
  // escape) in half, so trim back to the last full term that fits.
  const query = parts.join(" ");
  if (query.length <= MAX_QUERY_LENGTH) return query;
  const kept = query.slice(0, MAX_QUERY_LENGTH);
  const cut = kept.lastIndexOf(" ");
  return (cut > 0 ? kept.slice(0, cut) : kept).trim();
}

export function buildSoldSearchLinks(input: SoldSearchInput): SoldSearchLinks {
  const q = encodeURIComponent(buildSoldSearchQuery(input));
  return {
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    etsy: `https://www.etsy.com/search?q=${q}`,
  };
}
