"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { CURRENCY_CODE_PATTERN } from "@/lib/catalog/display";
import { ensureShippingSeed, readPricingDefaults, SINGLETON_SETTING_ID } from "./seed";
import {
  computePriceFloor,
  quoteInsurance,
  quoteShipping,
  shippingMeasurements,
  type Measurements,
  type PriceFloor,
  type ShippingQuote,
} from "./estimates";
import type { MarketplaceRegion, RateBasis } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// Shipping and pricing are family settings (spec stories 28–32; ADR-0003):
// every signed-in family login reads and edits them — signing in is the
// gate, like everywhere else.

export type ActionState = { error: string | null };

export type ForwarderRateView = {
  id: string;
  forwarder: string;
  zone: string;
  basis: RateBasis;
  rateIdr: number;
  maxKgPerPiece: number | null;
  volumetricDivisor: number | null;
  insurancePercent: number;
  insuranceMinimumIdr: number | null;
  transitNote: string | null;
};

type ForwarderRateRow = {
  id: string;
  forwarder: string;
  zone: string;
  basis: RateBasis;
  rateIdr: number;
  maxKgPerPiece: number | null;
  volumetricDivisor: number | null;
  insurancePercent: Prisma.Decimal;
  insuranceMinimumIdr: number | null;
  transitNote: string | null;
};

function toRateView(row: ForwarderRateRow): ForwarderRateView {
  return {
    id: row.id,
    forwarder: row.forwarder,
    zone: row.zone,
    basis: row.basis,
    rateIdr: row.rateIdr,
    maxKgPerPiece: row.maxKgPerPiece,
    volumetricDivisor: row.volumetricDivisor,
    insurancePercent: Number(row.insurancePercent),
    insuranceMinimumIdr: row.insuranceMinimumIdr,
    transitNote: row.transitNote,
  };
}

export type MarketplaceView = {
  id: string;
  name: string;
  region: MarketplaceRegion;
  feePercent: number;
};

export type PricingSettingsView = {
  marginPercent: number;
  fxMarketplaceCurrency: string;
  fxIdrPerUnit: number;
};

export type ShippingSettingsView = {
  rates: ForwarderRateView[];
  marketplaces: MarketplaceView[];
  settings: PricingSettingsView;
};

// A database that skipped the seed still gets its researched-default rates
// table on first read; afterwards the rows are the Owner's to edit.
async function ensureSeeded() {
  if ((await prisma.forwarderRate.count()) === 0) {
    await ensureShippingSeed();
  }
}

export async function getShippingSettings(): Promise<ShippingSettingsView | null> {
  await requireUser();

  await ensureSeeded();

  const [rateRows, marketplaceRows, pricing] = await Promise.all([
    prisma.forwarderRate.findMany({
      orderBy: [{ forwarder: "asc" }, { zone: "asc" }],
    }),
    prisma.marketplace.findMany({ orderBy: { name: "asc" } }),
    readPricingDefaults(),
  ]);

  return {
    rates: rateRows.map(toRateView),
    marketplaces: marketplaceRows.map((row) => ({
      id: row.id,
      name: row.name,
      region: row.region,
      feePercent: Number(row.feePercent),
    })),
    settings: {
      marginPercent: pricing.marginPercent,
      fxMarketplaceCurrency: pricing.fx.currency,
      fxIdrPerUnit: pricing.fx.idrPerUnit,
    },
  };
}

// --- Owner edits ------------------------------------------------------------

// Form patterns: whole IDR amounts and percents with up to two decimals.
const IDR_PATTERN = /^\d{1,10}$/;
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const MAX_NOTE_LENGTH = 200;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseIdr(raw: string, what: string): Parsed<number> {
  if (!IDR_PATTERN.test(raw)) {
    return { ok: false, error: `Enter ${what} as a whole number of rupiah.` };
  }
  return { ok: true, value: Number(raw) };
}

function parseOptionalIdr(raw: string, what: string, min: number): Parsed<number | null> {
  if (raw === "") return { ok: true, value: null };
  const parsed = parseIdr(raw, what);
  if (!parsed.ok) return parsed;
  if (parsed.value < min) {
    return { ok: false, error: `${what} must be at least ${min}.` };
  }
  return parsed;
}

function parsePercent(raw: string, what: string, max: number): Parsed<number> {
  if (!PERCENT_PATTERN.test(raw)) {
    return { ok: false, error: `Enter ${what} as a percentage, up to 2 decimals.` };
  }
  const value = Number(raw);
  if (value > max) {
    return { ok: false, error: `${what} cannot exceed ${max}%.` };
  }
  return { ok: true, value };
}

export async function updateForwarderRate(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const rateId = String(formData.get("rateId") ?? "");
  const existing = await prisma.forwarderRate.findUnique({ where: { id: rateId } });
  if (!existing) {
    return { error: "Rate not found." };
  }

  const rateIdr = parseIdr(String(formData.get("rateIdr") ?? "").trim(), "the rate");
  if (!rateIdr.ok) return { error: rateIdr.error };
  const insurancePercent = parsePercent(
    String(formData.get("insurancePercent") ?? "").trim(),
    "the insurance percentage",
    100
  );
  if (!insurancePercent.ok) return { error: insurancePercent.error };
  const insuranceMinimumIdr = parseOptionalIdr(
    String(formData.get("insuranceMinimumIdr") ?? "").trim(),
    "the insurance minimum",
    1
  );
  if (!insuranceMinimumIdr.ok) return { error: insuranceMinimumIdr.error };
  const maxKgPerPiece = parseOptionalIdr(
    String(formData.get("maxKgPerPiece") ?? "").trim(),
    "the piece weight limit",
    1
  );
  if (!maxKgPerPiece.ok) return { error: maxKgPerPiece.error };
  const volumetricDivisor = parseOptionalIdr(
    String(formData.get("volumetricDivisor") ?? "").trim(),
    "the volumetric divisor",
    1
  );
  if (!volumetricDivisor.ok) return { error: volumetricDivisor.error };
  const transitNote = String(formData.get("transitNote") ?? "").trim();
  if (transitNote.length > MAX_NOTE_LENGTH) {
    return { error: "The note is too long — keep it under 200 characters." };
  }

  await prisma.forwarderRate.update({
    where: { id: rateId },
    data: {
      rateIdr: rateIdr.value,
      insurancePercent: insurancePercent.value,
      insuranceMinimumIdr: insuranceMinimumIdr.value,
      maxKgPerPiece: maxKgPerPiece.value,
      volumetricDivisor: volumetricDivisor.value,
      transitNote: transitNote || null,
    },
  });

  revalidatePath("/settings");
  return { error: null };
}

// A fee of 100% or more would make the Price Floor division blow up, so
// marketplace fees are capped below it.
export async function updateMarketplaceFee(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const marketplaceId = String(formData.get("marketplaceId") ?? "");
  const existing = await prisma.marketplace.findUnique({ where: { id: marketplaceId } });
  if (!existing) {
    return { error: "Marketplace not found." };
  }

  const feePercent = parsePercent(
    String(formData.get("feePercent") ?? "").trim(),
    "the marketplace fee",
    99
  );
  if (!feePercent.ok) return { error: feePercent.error };

  await prisma.marketplace.update({
    where: { id: marketplaceId },
    data: { feePercent: feePercent.value },
  });

  revalidatePath("/settings");
  return { error: null };
}

// Marketplaces are self-serve (ticket 10): the family adds a channel when
// they start using one. The name must be unique; the fee is optional
// (empty = no fee yet — the Price Floor treats it as 0 and the fee form
// edits it later); the region decides the listing currency rule.
const MAX_MARKETPLACE_NAME_LENGTH = 60;

export async function addMarketplace(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > MAX_MARKETPLACE_NAME_LENGTH) {
    return {
      error: `Enter the marketplace name (up to ${MAX_MARKETPLACE_NAME_LENGTH} characters).`,
    };
  }

  const region = String(formData.get("region") ?? "");
  if (region !== "DOMESTIC" && region !== "INTERNATIONAL") {
    return { error: "Choose whether this marketplace is domestic or international." };
  }

  let feePercent = 0;
  const feeRaw = String(formData.get("feePercent") ?? "").trim();
  if (feeRaw !== "") {
    const parsed = parsePercent(feeRaw, "the marketplace fee", 99);
    if (!parsed.ok) return { error: parsed.error };
    feePercent = parsed.value;
  }

  const existing = await prisma.marketplace.findUnique({ where: { name } });
  if (existing) {
    return { error: `A marketplace named "${name}" already exists.` };
  }

  await prisma.marketplace.create({
    data: { name, region, feePercent },
  });

  revalidatePath("/settings");
  return { error: null };
}

// A marketplace can be removed only while no Listing or Sale references
// it — the family's records must never dangle.
export async function removeMarketplace(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const marketplaceId = String(formData.get("marketplaceId") ?? "");
  const row = await prisma.marketplace.findUnique({ where: { id: marketplaceId } });
  if (!row) {
    return { error: "Marketplace not found." };
  }

  const [listingCount, saleCount] = await Promise.all([
    prisma.listing.count({ where: { marketplaceId } }),
    prisma.sale.count({ where: { marketplaceId } }),
  ]);
  if (listingCount > 0 || saleCount > 0) {
    return {
      error: `"${row.name}" has listings or sales recorded on it and cannot be removed.`,
    };
  }

  await prisma.marketplace.delete({ where: { id: marketplaceId } });
  revalidatePath("/settings");
  return { error: null };
}

const FX_RATE_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const MAX_MARGIN_PERCENT = 1000;

export async function updatePricingSettings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const marginPercent = parsePercent(
    String(formData.get("marginPercent") ?? "").trim(),
    "the margin",
    MAX_MARGIN_PERCENT
  );
  if (!marginPercent.ok) return { error: marginPercent.error };

  const currency = String(formData.get("fxMarketplaceCurrency") ?? "")
    .trim()
    .toUpperCase();
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    return { error: "Enter the 3-letter currency code, e.g. USD or EUR." };
  }
  if (currency === "IDR") {
    return { error: "The marketplace currency cannot be IDR — pick the currency prices are listed in." };
  }

  const fxRaw = String(formData.get("fxIdrPerUnit") ?? "").trim();
  if (!FX_RATE_PATTERN.test(fxRaw) || Number(fxRaw) <= 0) {
    return { error: "Enter the FX rate as a positive number — how many IDR one unit of the marketplace currency costs." };
  }

  await prisma.pricingSetting.upsert({
    where: { id: SINGLETON_SETTING_ID },
    update: {
      marginPercent: marginPercent.value,
      fxMarketplaceCurrency: currency,
      fxIdrPerUnit: fxRaw,
    },
    create: {
      id: SINGLETON_SETTING_ID,
      marginPercent: marginPercent.value,
      fxMarketplaceCurrency: currency,
      fxIdrPerUnit: fxRaw,
    },
  });

  revalidatePath("/settings");
  return { error: null };
}

// --- Estimates ----------------------------------------------------------------

export type EstimateRow = {
  rate: ForwarderRateView;
  quote: ShippingQuote;
  // Null until a declared value is given — unpriced risk stays visible.
  insuranceIdr: number | null;
  floor: PriceFloor | null;
  // Why the floor is missing, or what it leaves out.
  floorNote: string | null;
};

export type ShippingEstimateView = {
  measurements: Measurements;
  declaredValueIdr: number | null;
  fx: { currency: string; idrPerUnit: number };
  marginPercent: number;
  marketplace: MarketplaceView | null;
  rows: EstimateRow[];
};

const MAX_DECLARED_VALUE_IDR = 2_000_000_000;

// One Item × one destination zone: every forwarder's quote side by side,
// each with its insurance estimate and (when a marketplace is chosen) the
// Price Floor that shipping implies. A query, not a mutation.
export async function estimateShipping(input: {
  itemId: string;
  zone: string;
  marketplaceId?: string | null;
  declaredValueIdr?: number | null;
}): Promise<ShippingEstimateView | null> {
  await requireUser();

  const item = await prisma.item.findUnique({ where: { id: input.itemId } });
  if (!item) return null;

  await ensureSeeded();

  const [rateRows, marketplaceRow, pricing] = await Promise.all([
    prisma.forwarderRate.findMany({
      where: { zone: input.zone },
      orderBy: { forwarder: "asc" },
    }),
    input.marketplaceId
      ? prisma.marketplace.findUnique({ where: { id: input.marketplaceId } })
      : null,
    readPricingDefaults(),
  ]);

  const declared =
    input.declaredValueIdr !== null &&
    input.declaredValueIdr !== undefined &&
    Number.isInteger(input.declaredValueIdr) &&
    input.declaredValueIdr > 0 &&
    input.declaredValueIdr <= MAX_DECLARED_VALUE_IDR
      ? input.declaredValueIdr
      : null;

  const marginPercent = pricing.marginPercent;
  const fx = pricing.fx;

  const measurements = shippingMeasurements(
    (item.attributes ?? {}) as Record<string, string | number>
  );

  const rows: EstimateRow[] = rateRows.map((rateRow) => {
    const quote = quoteShipping(
      {
        basis: rateRow.basis,
        rateIdr: rateRow.rateIdr,
        maxKgPerPiece: rateRow.maxKgPerPiece,
        volumetricDivisor: rateRow.volumetricDivisor,
      },
      measurements
    );
    const insuranceIdr = quoteInsurance(
      {
        insurancePercent: Number(rateRow.insurancePercent),
        insuranceMinimumIdr: rateRow.insuranceMinimumIdr,
      },
      declared
    );

    const notes: string[] = [];
    let floor: PriceFloor | null = null;
    if (quote.eligible) {
      if (item.costBasisIdr === null) {
        notes.push("Set this item's cost basis to see its Price Floor.");
      } else if (!marketplaceRow) {
        notes.push("Choose a marketplace to see the Price Floor with its fee.");
      } else {
        if (insuranceIdr === null) {
          notes.push("No declared value given — insurance is not in the floor.");
        }
        floor = computePriceFloor({
          costBasisIdr: item.costBasisIdr,
          shippingIdr: quote.shippingIdr!,
          insuranceIdr: insuranceIdr ?? 0,
          marginPercent,
          feePercent: Number(marketplaceRow.feePercent),
          fxIdrPerUnit: fx.idrPerUnit,
        });
      }
    }

    return {
      rate: toRateView(rateRow),
      quote,
      insuranceIdr,
      floor,
      floorNote: notes.length > 0 ? notes.join(" ") : null,
    };
  });

  return {
    measurements,
    declaredValueIdr: declared,
    fx,
    marginPercent,
    marketplace: marketplaceRow
      ? { id: marketplaceRow.id, name: marketplaceRow.name, region: marketplaceRow.region, feePercent: Number(marketplaceRow.feePercent) }
      : null,
    rows,
  };
}
