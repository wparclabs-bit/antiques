import type { RateBasis } from "@/generated/prisma/enums";
import {
  computePriceFloor,
  quoteInsurance,
  quoteShipping,
  type Measurements,
} from "@/lib/shipping/estimates";

// Pure maths for the Price Floor beside a Listing's intended price (ticket
// 06, spec story 27) — same policy as shipping/estimates.ts: no database,
// no auth; the seam loads the rows and calls these.
//
// What the floor beside a listing includes:
//   cost basis + margin + this marketplace's fee, always;
//   + the CHEAPEST eligible forwarder's shipping and insurance when a
//     destination zone has been chosen. Without a zone (or when no
//     forwarder can quote the piece) the floor still shows, flagged as
//     excluding shipping — a floor that silently vanished would be worse.
//
// Insurance's declared value is the listing price in IDR: directly when the
// listing carries IDR, via the single FX rate when it carries the
// marketplace currency. Any other currency (possible after the Owner
// changes the FX setting) has no honest conversion, so insurance stays
// unpriced and the note says so.

export type FloorRateCard = {
  forwarder: string;
  basis: RateBasis;
  rateIdr: number;
  maxKgPerPiece: number | null;
  volumetricDivisor: number | null;
  insurancePercent: number;
  insuranceMinimumIdr: number | null;
};

export type ListingFloor = {
  floorPrice: number;
  floorIdr: number;
  includesShipping: boolean;
  viaForwarder: string | null;
};

export type ListingFloorResult = {
  floor: ListingFloor | null;
  note: string | null;
  // The shortfall when the intended price sits under the floor, compared in
  // the listing's own currency when the floor is expressed in it.
  priceBelowFloorBy: { amount: number; currency: string } | null;
};

export function listingFloor(input: {
  costBasisIdr: number | null;
  price: number;
  currency: string;
  marketplaceFeePercent: number;
  marginPercent: number;
  fxCurrency: string;
  fxIdrPerUnit: number;
  measurements: Measurements;
  // The chosen destination zone's rate cards; empty when no zone was chosen.
  rates: FloorRateCard[];
}): ListingFloorResult {
  if (input.costBasisIdr === null) {
    return {
      floor: null,
      note: "Set this item's cost basis to see its Price Floor.",
      priceBelowFloorBy: null,
    };
  }

  const notes: string[] = [];

  const floorWithoutShipping = (): ListingFloor => {
    const f = computePriceFloor({
      costBasisIdr: input.costBasisIdr!,
      shippingIdr: 0,
      insuranceIdr: 0,
      marginPercent: input.marginPercent,
      feePercent: input.marketplaceFeePercent,
      fxIdrPerUnit: input.fxIdrPerUnit,
    });
    return {
      floorPrice: f.floorPrice,
      floorIdr: f.floorIdr,
      includesShipping: false,
      viaForwarder: null,
    };
  };

  let floor: ListingFloor;
  if (input.rates.length > 0) {
    const declaredValueIdr =
      input.currency === "IDR"
        ? Math.round(input.price)
        : input.currency === input.fxCurrency
          ? Math.round(input.price * input.fxIdrPerUnit)
          : null;
    if (declaredValueIdr === null) {
      notes.push(
        `Insurance is not in the floor — the FX setting converts only ${input.fxCurrency}.`
      );
    }

    let best: { forwarder: string; floor: ListingFloor } | null = null;
    for (const rate of input.rates) {
      const quote = quoteShipping(
        {
          basis: rate.basis,
          rateIdr: rate.rateIdr,
          maxKgPerPiece: rate.maxKgPerPiece,
          volumetricDivisor: rate.volumetricDivisor,
        },
        input.measurements
      );
      if (!quote.eligible) continue;
      const insuranceIdr = quoteInsurance(
        {
          insurancePercent: rate.insurancePercent,
          insuranceMinimumIdr: rate.insuranceMinimumIdr,
        },
        declaredValueIdr
      );
      const f = computePriceFloor({
        costBasisIdr: input.costBasisIdr,
        shippingIdr: quote.shippingIdr!,
        insuranceIdr: insuranceIdr ?? 0,
        marginPercent: input.marginPercent,
        feePercent: input.marketplaceFeePercent,
        fxIdrPerUnit: input.fxIdrPerUnit,
      });
      const candidate = {
        forwarder: rate.forwarder,
        floor: {
          floorPrice: f.floorPrice,
          floorIdr: f.floorIdr,
          includesShipping: true,
          viaForwarder: rate.forwarder,
        } satisfies ListingFloor,
      };
      if (!best || candidate.floor.floorPrice < best.floor.floorPrice) {
        best = candidate;
      }
    }

    if (best) {
      floor = best.floor;
    } else {
      floor = floorWithoutShipping();
      notes.push(
        "No forwarder could quote this piece for that zone — the floor excludes shipping."
      );
    }
  } else {
    floor = floorWithoutShipping();
    notes.push(
      "No destination zone chosen in Shipping & Price Floor — the floor excludes shipping and insurance."
    );
  }

  // An old listing can outlive a changed FX setting; when its currency no
  // longer matches, the IDR figure is the only honest comparison.
  if (input.currency !== input.fxCurrency && input.currency !== "IDR") {
    notes.push(
      `This price is in ${input.currency} but the floor is in ${input.fxCurrency} — compare against the IDR figure.`
    );
  }

  let priceBelowFloorBy: { amount: number; currency: string } | null = null;
  if (input.currency === input.fxCurrency && input.price < floor.floorPrice) {
    priceBelowFloorBy = {
      amount: Math.round((floor.floorPrice - input.price) * 100) / 100,
      currency: input.fxCurrency,
    };
  } else if (input.currency === "IDR" && input.price < floor.floorIdr) {
    priceBelowFloorBy = {
      amount: Math.ceil(floor.floorIdr - input.price),
      currency: "IDR",
    };
  }

  return {
    floor,
    note: notes.length > 0 ? notes.join(" ") : null,
    priceBelowFloorBy,
  };
}
