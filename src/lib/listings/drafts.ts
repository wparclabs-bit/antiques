import type { ItemCategory } from "@/generated/prisma/enums";
import { templateFor } from "@/lib/catalog/categories";
import { formatMoney } from "@/lib/catalog/display";
import {
  PHOTO_VARIANTS,
  photoVariantUrl,
  type PhotoVariantName,
} from "@/lib/photos/cloudinary";

// The Listing Draft generator (GLOSSARY.md) — deterministic assembly from the
// Item's own record, no AI anywhere (spec: "descriptions assembled from
// measurements, materials, age, and condition"). One shared body — the
// category details, the 50+ age line, condition, provenance — and
// per-marketplace conventions:
//
//   eBay — titles up to 80 characters, space-joined keywords, two-line
//          opening (name, then category and identifying summary).
//   Etsy — titles up to 140 characters, comma-joined keywords, one-line
//          opening (its search weighs the first characters most).
//   Anything else gets the plain generic package at display size.
//
// The formats are pinned by golden tests (actions.test.ts); changing a
// format is a deliberate act that updates them.

export type MarketplaceFormat = "EBAY" | "ETSY" | "GENERIC";

export function formatForMarketplace(name: string): MarketplaceFormat {
  const lower = name.toLowerCase();
  if (lower === "ebay") return "EBAY";
  if (lower === "etsy") return "ETSY";
  return "GENERIC";
}

const TITLE_LIMITS: Record<MarketplaceFormat, number> = {
  EBAY: 80,
  ETSY: 140,
  GENERIC: 100,
};

const PHOTO_VARIANT_BY_FORMAT: Record<MarketplaceFormat, PhotoVariantName> = {
  EBAY: "ebay",
  ETSY: "etsy",
  GENERIC: "display",
};

export type DraftItemInput = {
  name: string;
  category: ItemCategory;
  attributes: Record<string, string | number>;
  conditionNotes: string | null;
  provenance: string | null;
  fiftyYearsOld: boolean;
  photos: { publicId: string; format: string }[];
};

export type ListingDraft = {
  title: string;
  description: string;
  // Null when photo storage is not configured: the photo exists, its URL
  // for the package does not. Length always equals the photo count.
  photoUrls: (string | null)[];
};

// Keep whole words: a hard slice could cut a word (or a unit) in half, so
// trim back to the last full word that fits — the same rule the sold-search
// query follows.
function trimToWholeWords(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const kept = text.slice(0, limit);
  const cut = kept.lastIndexOf(" ");
  return (cut > 0 ? kept.slice(0, cut) : kept).trim();
}

// The identifying values (brand, material, artist…), in template order —
// what makes this piece findable in marketplace search.
function identifyingSummary(input: DraftItemInput): string[] {
  const values: string[] = [];
  for (const field of templateFor(input.category).fields) {
    if (field.identifying && input.attributes[field.key] !== undefined) {
      values.push(String(input.attributes[field.key]));
    }
  }
  return values;
}

// The body every marketplace format shares: the category's own fields
// (materials, dimensions, period…), the 50+ age line, condition, and
// provenance — each section dropped when the record has nothing for it.
function draftBody(input: DraftItemInput): string {
  const lines: string[] = [];
  for (const field of templateFor(input.category).fields) {
    const value = input.attributes[field.key];
    if (value === undefined) continue;
    lines.push(`- ${field.label}: ${value}${field.unit ? ` ${field.unit}` : ""}`);
  }

  const sections = [
    lines.length > 0 ? `Details:\n${lines.join("\n")}` : null,
    input.fiftyYearsOld ? "Age: 50+ years old" : null,
    input.conditionNotes ? `Condition:\n${input.conditionNotes}` : null,
    input.provenance ? `Provenance:\n${input.provenance}` : null,
  ].filter((section): section is string => section !== null);

  return sections.join("\n\n");
}

export function buildTitle(format: MarketplaceFormat, input: DraftItemInput): string {
  const parts = [input.name, ...identifyingSummary(input)];
  const joiner = format === "ETSY" ? ", " : " ";
  return trimToWholeWords(parts.join(joiner), TITLE_LIMITS[format]);
}

export function buildDescription(format: MarketplaceFormat, input: DraftItemInput): string {
  const label = templateFor(input.category).label;
  const summary = identifyingSummary(input).join(", ");
  const body = draftBody(input);

  let opening: string;
  if (format === "ETSY") {
    // One line: the marketplace's search weighs the first characters most.
    opening = summary
      ? `${input.name} — ${label}. ${summary}.`
      : `${input.name} — ${label}.`;
  } else {
    opening = `${input.name}\n\n${summary ? `${label} — ${summary}.` : `${label}.`}`;
  }

  return body ? `${opening}\n\n${body}` : opening;
}

export function buildListingDraft(
  format: MarketplaceFormat,
  input: DraftItemInput
): ListingDraft {
  const variant = PHOTO_VARIANT_BY_FORMAT[format];
  return {
    title: buildTitle(format, input),
    description: buildDescription(format, input),
    photoUrls: input.photos.map((photo) => photoVariantUrl(photo, variant)),
  };
}

// What the one-action copy puts on the clipboard: the whole package —
// title, description, price, and the photo bundle sized for that
// marketplace. The Price Floor is family-internal and never pasted.
export function buildPackageText(input: {
  marketplaceName: string;
  format: MarketplaceFormat;
  draft: ListingDraft;
  price: number;
  currency: string;
}): string {
  const { draft } = input;
  const variant = PHOTO_VARIANT_BY_FORMAT[input.format];
  const size = PHOTO_VARIANTS[variant];

  // Money as plain text: Intl joins some currency codes to the amount with
  // a no-break space, which pastes badly into marketplace forms.
  const priceText = formatMoney(input.price, input.currency).replace(
    /[\u00a0\u202f]/g,
    " "
  );

  const photoLines =
    draft.photoUrls.length === 0
      ? "None recorded yet."
      : draft.photoUrls
          .map(
            (url) =>
              url ?? "(photo URL unavailable — photo storage is not configured)"
          )
          .join("\n");

  return [
    `TITLE\n${draft.title}`,
    `DESCRIPTION\n${draft.description}`,
    `PRICE\n${priceText}`,
    `PHOTOS — ${draft.photoUrls.length} for ${input.marketplaceName} (${size}px)\n${photoLines}`,
  ].join("\n\n");
}
