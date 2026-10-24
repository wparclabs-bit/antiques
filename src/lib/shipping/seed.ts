import { prisma } from "@/lib/db";
import type { RateBasis } from "@/generated/prisma/enums";

// The rates table seed (ticket 05): "seeded from the research findings".
// Sources: .scratch/research/export-and-forwarders.md (DHL insurance 2% /
// IDR 170k minimum / 70 kg piece limit / volumetric divisor 5000; Pos
// Indonesia EMS 30 kg) and .scratch/research/furniture-marketplaces-europe.md
// (sea LCL Jakarta→Rotterdam $140–200 per m³, 40–48 days — seeded at the
// $170 midpoint × the default FX rate).
//
// The research explicitly found no reliable public per-kg rate cards, so the
// per-kg figures below are editable placeholders, not quotes — the Owner is
// expected to replace them with real forwarder quotes. Upserts never
// overwrite: once seeded, the rows belong to the Owner.

export const SINGLETON_SETTING_ID = "main";

export const DEFAULT_MARGIN_PERCENT = 30;
export const DEFAULT_FX_CURRENCY = "USD";
export const DEFAULT_FX_IDR_PER_UNIT = 16_000;

type RateSeed = {
  forwarder: string;
  zone: string;
  basis: RateBasis;
  rateIdr: number;
  maxKgPerPiece: number | null;
  volumetricDivisor: number | null;
  insurancePercent: string;
  insuranceMinimumIdr: number | null;
  transitNote: string;
};

export const SEED_RATES: RateSeed[] = [
  // DHL Express insured — the concrete research numbers: 2% of declared
  // value with an IDR 170,000 minimum, 70 kg per piece, volumetric divisor
  // 5000 (cm³ per chargeable kg).
  {
    forwarder: "DHL Express insured",
    zone: "Asia",
    basis: "PER_KG",
    rateIdr: 350_000,
    maxKgPerPiece: 70,
    volumetricDivisor: 5000,
    insurancePercent: "2.00",
    insuranceMinimumIdr: 170_000,
    transitNote: "Estimate — replace with a real DHL quote.",
  },
  {
    forwarder: "DHL Express insured",
    zone: "Europe",
    basis: "PER_KG",
    rateIdr: 700_000,
    maxKgPerPiece: 70,
    volumetricDivisor: 5000,
    insurancePercent: "2.00",
    insuranceMinimumIdr: 170_000,
    transitNote: "Estimate — replace with a real DHL quote.",
  },
  {
    forwarder: "DHL Express insured",
    zone: "North America",
    basis: "PER_KG",
    rateIdr: 750_000,
    maxKgPerPiece: 70,
    volumetricDivisor: 5000,
    insurancePercent: "2.00",
    insuranceMinimumIdr: 170_000,
    transitNote: "Estimate — replace with a real DHL quote.",
  },
  // Pos Indonesia economy — cheapest for small items, slowest; EMS caps a
  // piece at 30 kg. Insurance per service was not researched, so it is
  // seeded unpriced (0%) for the Owner to fill in.
  {
    forwarder: "Pos Indonesia economy",
    zone: "Asia",
    basis: "PER_KG",
    rateIdr: 150_000,
    maxKgPerPiece: 30,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Slowest option; insurance must be checked per service.",
  },
  {
    forwarder: "Pos Indonesia economy",
    zone: "Europe",
    basis: "PER_KG",
    rateIdr: 250_000,
    maxKgPerPiece: 30,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Slowest option; insurance must be checked per service.",
  },
  {
    forwarder: "Pos Indonesia economy",
    zone: "North America",
    basis: "PER_KG",
    rateIdr: 250_000,
    maxKgPerPiece: 30,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Slowest option; insurance must be checked per service.",
  },
  // Sea freight LCL — per cubic meter, the economical path for
  // furniture-scale pieces. Europe is the researched route
  // ($170 × 16,000); the other zones are placeholders.
  {
    forwarder: "Sea freight (LCL)",
    zone: "Asia",
    basis: "PER_CUBIC_METER",
    rateIdr: 1_800_000,
    maxKgPerPiece: null,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Estimate — replace with a forwarder quote.",
  },
  {
    forwarder: "Sea freight (LCL)",
    zone: "Europe",
    basis: "PER_CUBIC_METER",
    rateIdr: 2_720_000,
    maxKgPerPiece: null,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Jakarta→Rotterdam research: $140–200 per m³ all-in, 40–48 days.",
  },
  {
    forwarder: "Sea freight (LCL)",
    zone: "North America",
    basis: "PER_CUBIC_METER",
    rateIdr: 3_000_000,
    maxKgPerPiece: null,
    volumetricDivisor: null,
    insurancePercent: "0.00",
    insuranceMinimumIdr: null,
    transitNote: "Estimate — replace with a forwarder quote.",
  },
];

export const SEED_MARKETPLACES = [
  // Fee schedules change; both are editable on the settings page.
  { name: "eBay", feePercent: "13.25" },
  { name: "Etsy", feePercent: "10.00" },
];

// Idempotent: creates anything missing, never overwrites an Owner's edit.
// Called from prisma/seed.ts (deploys) and lazily from the settings read
// (a fresh database that skipped the seed still gets its rates table).
export async function ensureShippingSeed() {
  for (const rate of SEED_RATES) {
    await prisma.forwarderRate.upsert({
      where: { forwarder_zone: { forwarder: rate.forwarder, zone: rate.zone } },
      update: {},
      create: { ...rate },
    });
  }
  for (const marketplace of SEED_MARKETPLACES) {
    await prisma.marketplace.upsert({
      where: { name: marketplace.name },
      update: {},
      create: { ...marketplace },
    });
  }
  await prisma.pricingSetting.upsert({
    where: { id: SINGLETON_SETTING_ID },
    update: {},
    create: {
      id: SINGLETON_SETTING_ID,
      marginPercent: DEFAULT_MARGIN_PERCENT,
      fxMarketplaceCurrency: DEFAULT_FX_CURRENCY,
      fxIdrPerUnit: DEFAULT_FX_IDR_PER_UNIT,
    },
  });
}
