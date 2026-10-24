import type { RateBasis } from "@/generated/prisma/enums";

// Pure shipping and pricing maths for ticket 05 — no database, no auth; the
// seam (actions.ts) loads rows and calls these. Every rule the numbers
// depend on is written here once:

// Measurements → the box a piece ships in
// ---------------------------------------
// The category templates record measurements, not packing boxes, so the
// estimate uses what exists:
//   - weight: the `weightKg` attribute, or `weightG` / 1000 (Pens).
//   - box: the three largest recorded centimeter measurements. A round
//     piece (`diameterCm`) counts twice — a cylinder ships in a square
//     box. Framed art prefers frame dims over image dims. `caseDiameterMm`
//     (Watches) converts to cm. Fewer than three dims means no box volume.

// Per-kilogram quotes (express parcel)
// ------------------------------------
//   chargeable = max(actual weight, volumetric weight), rounded UP to a
//   whole kilogram with a 1 kg billing minimum (carriers do not bill
//   fractions). Volumetric kg = box cm³ / the forwarder's divisor (DHL:
//   5000) and needs all three box dims. A piece-weight limit (DHL 70 kg,
//   Pos 30 kg) is checked against the ACTUAL weight — it is a handling
//   limit, not a price.

// Per-cubic-meter quotes (sea LCL)
// --------------------------------
//   volume = box cm³ / 1,000,000; needs all three box dims.

// Insurance
// ---------
//   max(declared value × forwarder %, forwarder minimum). Not computed
//   until a declared value is given — risk stays visible, never guessed.

// Price Floor (GLOSSARY.md: cost basis + shipping + fees + margin)
// ----------------------------------------------------------------
//   margin   = margin% × (cost basis + shipping + insurance)
//   floor    = (cost + shipping + insurance + margin) / (1 − fee%)
//   The marketplace fee is a percentage OF THE LISTING PRICE, so it is
//   divided out, not added on: adding fee% to costs would recover the fee
//   on the costs only, not on the fee itself. The floor is computed in
//   IDR, then divided by the single FX rate into the marketplace
//   currency.

export type Measurements = {
  weightKg: number | null;
  // The three largest cm measurements, descending. Length 0–3.
  boxCm: number[];
};

export function shippingMeasurements(
  attributes: Record<string, string | number>
): Measurements {
  const num = (key: string): number | null => {
    const value = attributes[key];
    if (typeof value === "number" && value > 0) return value;
    return null;
  };

  let weightKg = num("weightKg");
  if (weightKg === null) {
    const weightG = num("weightG");
    if (weightG !== null) weightKg = weightG / 1000;
  }

  const dims: number[] = [];
  const push = (key: string) => {
    const value = num(key);
    if (value !== null) dims.push(value);
  };
  push("heightCm");
  push("widthCm");
  push("depthCm");
  push("thicknessCm");
  push("lengthCm");
  // A framed piece ships in its frame: image dims are subsumed, not added.
  if (num("frameHeightCm") !== null || num("frameWidthCm") !== null) {
    push("frameHeightCm");
    push("frameWidthCm");
  } else {
    push("imageHeightCm");
    push("imageWidthCm");
  }

  // cylinder → square box
  const diameter = num("diameterCm");
  if (diameter !== null) dims.push(diameter, diameter);
  const caseDiameterMm = num("caseDiameterMm");
  if (caseDiameterMm !== null) dims.push(caseDiameterMm / 10);

  return {
    weightKg,
    boxCm: dims.sort((a, b) => b - a).slice(0, 3),
  };
}

export type RateCard = {
  basis: RateBasis;
  rateIdr: number;
  maxKgPerPiece: number | null;
  volumetricDivisor: number | null;
};

export type ShippingQuote = {
  eligible: boolean;
  // Why not, when eligible is false.
  reason: string | null;
  chargeableKg: number | null;
  volumeM3: number | null;
  // True when the volumetric weight beat the actual weight.
  volumetricApplied: boolean;
  shippingIdr: number | null;
};

export function quoteShipping(
  rate: RateCard,
  m: Measurements
): ShippingQuote {
  if (rate.basis === "PER_KG") {
    if (
      rate.maxKgPerPiece !== null &&
      m.weightKg !== null &&
      m.weightKg > rate.maxKgPerPiece
    ) {
      return {
        eligible: false,
        reason: `Weighs ${m.weightKg} kg — over this service's ${rate.maxKgPerPiece} kg piece limit.`,
        chargeableKg: null,
        volumeM3: null,
        volumetricApplied: false,
        shippingIdr: null,
      };
    }

    const volumetricKg =
      rate.volumetricDivisor !== null && m.boxCm.length === 3
        ? (m.boxCm[0] * m.boxCm[1] * m.boxCm[2]) / rate.volumetricDivisor
        : 0;
    const chargeableRaw = Math.max(m.weightKg ?? 0, volumetricKg);
    if (chargeableRaw <= 0) {
      return {
        eligible: false,
        reason: "No weight recorded — add the piece's weight (or three dimensions) first.",
        chargeableKg: null,
        volumeM3: null,
        volumetricApplied: false,
        shippingIdr: null,
      };
    }

    // Whole kilograms, 1 kg minimum.
    const chargeableKg = Math.max(Math.ceil(chargeableRaw), 1);
    return {
      eligible: true,
      reason: null,
      chargeableKg,
      volumeM3: null,
      volumetricApplied: volumetricKg > (m.weightKg ?? 0),
      shippingIdr: Math.round(chargeableKg * rate.rateIdr),
    };
  }

  // PER_CUBIC_METER
  if (m.boxCm.length < 3) {
    return {
      eligible: false,
      reason: "Priced per cubic meter — record three dimensions first.",
      chargeableKg: null,
      volumeM3: null,
      volumetricApplied: false,
      shippingIdr: null,
    };
  }
  const volumeM3 = (m.boxCm[0] * m.boxCm[1] * m.boxCm[2]) / 1_000_000;
  return {
    eligible: true,
    reason: null,
    chargeableKg: null,
    volumeM3,
    volumetricApplied: false,
    shippingIdr: Math.round(volumeM3 * rate.rateIdr),
  };
}

export type InsuranceRate = {
  insurancePercent: number; // 0–100
  insuranceMinimumIdr: number | null;
};

// Null until a declared value exists — unpriced risk must stay visible.
export function quoteInsurance(
  rate: InsuranceRate,
  declaredValueIdr: number | null
): number | null {
  if (declaredValueIdr === null || declaredValueIdr <= 0) return null;
  const byPercent = (declaredValueIdr * rate.insurancePercent) / 100;
  return Math.round(Math.max(byPercent, rate.insuranceMinimumIdr ?? 0));
}

export type PriceFloorInput = {
  costBasisIdr: number;
  shippingIdr: number;
  insuranceIdr: number; // 0 when not priced in
  marginPercent: number;
  feePercent: number;
  fxIdrPerUnit: number;
};

export type PriceFloor = {
  costsIdr: number; // cost basis + shipping + insurance
  marginIdr: number;
  subtotalIdr: number; // costs + margin — what the sale must clear
  feePercent: number;
  feeIdr: number; // the marketplace's cut at the floor price
  floorIdr: number;
  // The floor in the marketplace currency, 2 decimals.
  floorPrice: number;
};

export function computePriceFloor(input: PriceFloorInput): PriceFloor {
  const costsIdr =
    input.costBasisIdr + input.shippingIdr + input.insuranceIdr;
  const marginIdr = Math.round((costsIdr * input.marginPercent) / 100);
  const subtotalIdr = costsIdr + marginIdr;
  const floorIdr = Math.round(subtotalIdr / (1 - input.feePercent / 100));
  return {
    costsIdr,
    marginIdr,
    subtotalIdr,
    feePercent: input.feePercent,
    feeIdr: floorIdr - subtotalIdr,
    floorIdr,
    floorPrice: Math.round((floorIdr / input.fxIdrPerUnit) * 100) / 100,
  };
}
