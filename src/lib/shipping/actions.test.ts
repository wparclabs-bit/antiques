import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shipping & Price Floor seam tests (ticket 05). Same policy as the other
// suites: only Next.js runtime transport is mocked (shared via
// src/test/browser-transport); the Server Actions under test and the
// database are real.
// ---------------------------------------------------------------------------

vi.mock("next/headers", async () => (await import("@/test/browser-transport")).nextHeaders);
vi.mock("next/navigation", async () => (await import("@/test/browser-transport")).nextNavigation);
vi.mock("next/cache", async () => (await import("@/test/browser-transport")).nextCache);
vi.mock("next/server", async () => (await import("@/test/browser-transport")).nextServer);

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signIn } from "@/lib/auth/actions";
import { ForbiddenError } from "@/lib/auth/errors";
import { cookieStore } from "@/test/browser-transport";
import {
  estimateShipping,
  getShippingSettings,
  updateForwarderRate,
  updateMarketplaceFee,
  updatePricingSettings,
  type ActionState,
} from "@/lib/shipping/actions";

const initial: ActionState = { error: null };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function createUser(
  fields: Partial<{ email: string; name: string; password: string; role: "OWNER" | "CATALOGER" }> = {}
) {
  return prisma.user.create({
    data: {
      email: fields.email ?? "owner@test.local",
      name: fields.name ?? "Test Owner",
      passwordHash: await hashPassword(fields.password ?? "owner-password-1"),
      role: fields.role ?? "OWNER",
    },
  });
}

async function signInAs(email: string, password: string) {
  await expect(
    signIn({ error: null }, form({ email, password }))
  ).rejects.toThrow(/NEXT_REDIRECT/);
}

async function signInAsOwner() {
  await createUser();
  await signInAs("owner@test.local", "owner-password-1");
}

async function signInAsCataloger() {
  await createUser({
    email: "ada@test.local",
    name: "Ada",
    password: "cataloger-password-1",
    role: "CATALOGER",
  });
  await signInAs("ada@test.local", "cataloger-password-1");
}

// Creates an Item through the catalog seam and returns its id.
async function createItem(
  fields: Record<string, string>
): Promise<string> {
  const { createItem: create, listItems } = await import("@/lib/catalog/actions");
  await expect(
    create({ error: null, fieldErrors: {} }, form(fields))
  ).rejects.toThrow(/NEXT_REDIRECT/);
  const [item] = await listItems({ q: fields.name });
  if (!item) throw new Error("item not found after create");
  return item.id;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation", "ForwarderRate", "Marketplace", "PricingSetting" CASCADE`
  );
  cookieStore.clear();
});

test("the rates table, marketplaces, and settings are seeded with the researched defaults", async () => {
  await signInAsOwner();

  const settings = await getShippingSettings();
  expect(settings).not.toBeNull();

  const rates = settings!.rates;
  expect(rates).toHaveLength(9); // 3 forwarders × 3 zones

  // The concrete research numbers: DHL Express insured — 2% of declared
  // value, IDR 170k minimum, 70 kg piece limit, volumetric divisor 5000.
  const dhlEurope = rates.find(
    (r) => r.forwarder === "DHL Express insured" && r.zone === "Europe"
  );
  expect(dhlEurope).toMatchObject({
    basis: "PER_KG",
    maxKgPerPiece: 70,
    volumetricDivisor: 5000,
    insurancePercent: 2,
    insuranceMinimumIdr: 170_000,
  });
  expect(dhlEurope!.rateIdr).toBeGreaterThan(0);

  // Pos Indonesia economy: 30 kg EMS piece limit, insurance unpriced.
  const posAsia = rates.find(
    (r) => r.forwarder === "Pos Indonesia economy" && r.zone === "Asia"
  );
  expect(posAsia).toMatchObject({
    basis: "PER_KG",
    maxKgPerPiece: 30,
    insurancePercent: 0,
    insuranceMinimumIdr: null,
  });

  // Sea freight per cubic meter; Europe from the Jakarta→Rotterdam
  // research ($140–200/m³, seeded at the $170 midpoint × 16,000).
  const seaEurope = rates.find(
    (r) => r.forwarder === "Sea freight (LCL)" && r.zone === "Europe"
  );
  expect(seaEurope).toMatchObject({
    basis: "PER_CUBIC_METER",
    rateIdr: 2_720_000,
    insurancePercent: 0,
  });

  expect(settings!.marketplaces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "eBay", feePercent: 13.25 }),
      expect.objectContaining({ name: "Etsy", feePercent: 10 }),
    ])
  );
  expect(settings!.settings).toMatchObject({
    marginPercent: 30,
    fxMarketplaceCurrency: "USD",
    fxIdrPerUnit: 16000,
  });
});

test("the Owner can edit a rate row, clear its optional numbers, and invalid edits are rejected", async () => {
  await signInAsOwner();
  const settings = await getShippingSettings();
  const before = settings!.rates.find(
    (r) => r.forwarder === "DHL Express insured" && r.zone === "Europe"
  )!;
  const fields = (overrides: Record<string, string>) =>
    form({
      rateId: before.id,
      rateIdr: "725000",
      insurancePercent: "1.5",
      insuranceMinimumIdr: "200000",
      maxKgPerPiece: "70",
      volumetricDivisor: "5000",
      transitNote: "Quote from agent, Oct 2026",
      ...overrides,
    });

  const ok = await updateForwarderRate(initial, fields({}));
  expect(ok.error).toBeNull();

  const after = (await getShippingSettings())!.rates.find((r) => r.id === before.id)!;
  expect(after).toMatchObject({
    rateIdr: 725_000,
    insurancePercent: 1.5,
    insuranceMinimumIdr: 200_000,
    maxKgPerPiece: 70,
    volumetricDivisor: 5000,
    transitNote: "Quote from agent, Oct 2026",
  });

  // Optional numbers clear to "not set" instead of 0.
  const cleared = await updateForwarderRate(
    initial,
    fields({
      insuranceMinimumIdr: "",
      maxKgPerPiece: "",
      volumetricDivisor: "",
      transitNote: "",
    })
  );
  expect(cleared.error).toBeNull();
  const afterClear = (await getShippingSettings())!.rates.find((r) => r.id === before.id)!;
  expect(afterClear).toMatchObject({
    insuranceMinimumIdr: null,
    maxKgPerPiece: null,
    volumetricDivisor: null,
    transitNote: null,
  });

  // Nonsense is rejected and changes nothing.
  const badEdits: Record<string, string>[] = [
    { rateIdr: "-5" },
    { rateIdr: "cheap" },
    { insurancePercent: "150" },
    { insurancePercent: "2.913" },
    { maxKgPerPiece: "0" },
    { volumetricDivisor: "half" },
    { transitNote: "x".repeat(201) },
  ];
  for (const overrides of badEdits) {
    const bad = await updateForwarderRate(initial, fields(overrides));
    expect(bad.error, JSON.stringify(overrides)).toBeTruthy();
  }
  const unchanged = (await getShippingSettings())!.rates.find((r) => r.id === before.id)!;
  expect(unchanged.rateIdr).toBe(725_000);
  expect(unchanged.insurancePercent).toBe(1.5);

  // An unknown rate id is an error, not a crash.
  const missing = await updateForwarderRate(initial, fields({ rateId: "nope" }));
  expect(missing.error).toBeTruthy();
});

test("a furniture-scale piece: express bills volumetric weight, Pos rejects the piece limit, sea bills cubic meters", async () => {
  await signInAsOwner();
  // 180 × 90 × 45 cm, 40 kg — volumetric 180·90·45/5000 = 145.8 kg.
  const itemId = await createItem({
    name: "Jati Teak Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "180",
    "attr.widthCm": "90",
    "attr.depthCm": "45",
    "attr.weightKg": "40",
  });

  const estimate = await estimateShipping({ itemId, zone: "Europe" });
  expect(estimate).not.toBeNull();
  expect(estimate!.measurements.weightKg).toBe(40);

  const byForwarder = (name: string) =>
    estimate!.rows.find((r) => r.rate.forwarder === name)!;

  // DHL: chargeable = ceil(145.8) = 146 kg × IDR 700,000.
  const dhl = byForwarder("DHL Express insured");
  expect(dhl.quote.eligible).toBe(true);
  expect(dhl.quote.volumetricApplied).toBe(true);
  expect(dhl.quote.chargeableKg).toBe(146);
  expect(dhl.quote.shippingIdr).toBe(102_200_000);

  // Pos Indonesia: 40 kg actual beats the 30 kg EMS piece limit.
  const pos = byForwarder("Pos Indonesia economy");
  expect(pos.quote.eligible).toBe(false);
  expect(pos.quote.reason).toMatch(/30 kg piece limit/);

  // Sea freight: 0.729 m³ × IDR 2,720,000.
  const sea = byForwarder("Sea freight (LCL)");
  expect(sea.quote.eligible).toBe(true);
  expect(sea.quote.volumeM3).toBeCloseTo(0.729, 6);
  expect(sea.quote.shippingIdr).toBe(1_982_880);
});

test("a small round piece: the diameter counts twice for the box and billing rounds up to a whole kilogram", async () => {
  await signInAsOwner();
  // kendi: 25 cm tall, 18 cm diameter, 1.2 kg → box 25×18×18,
  // volumetric 8100/5000 = 1.62 kg → billed as 2 kg.
  const itemId = await createItem({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.makersMark": "",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });

  const estimate = await estimateShipping({ itemId, zone: "Asia" });
  const dhl = estimate!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhl.quote.eligible).toBe(true);
  expect(dhl.quote.chargeableKg).toBe(2);
  expect(dhl.quote.shippingIdr).toBe(700_000); // 2 × IDR 350,000
});

test("insurance follows the forwarder's rate: percent of declared value with the minimum kicking in", async () => {
  await signInAsOwner();
  const itemId = await createItem({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });

  // No declared value yet → risk stays visible, not guessed as zero cost.
  const none = await estimateShipping({ itemId, zone: "Asia" });
  const dhlNone = none!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlNone.insuranceIdr).toBeNull();

  // IDR 5,000,000 × 2% = 100,000 < the 170,000 researched minimum.
  const low = await estimateShipping({ itemId, zone: "Asia", declaredValueIdr: 5_000_000 });
  const dhlLow = low!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlLow.insuranceIdr).toBe(170_000);

  // IDR 10,000,000 × 2% = 200,000 — above the minimum.
  const high = await estimateShipping({ itemId, zone: "Asia", declaredValueIdr: 10_000_000 });
  const dhlHigh = high!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlHigh.insuranceIdr).toBe(200_000);

  // Sea freight is seeded unpriced: 0% of anything is 0.
  const sea = high!.rows.find((r) => r.rate.forwarder === "Sea freight (LCL)")!;
  expect(sea.insuranceIdr).toBe(0);
});

test("a piece with too little recorded: express needs weight or three dimensions, sea always needs three dimensions", async () => {
  await signInAsOwner();
  // Framed painting with frame dims only (two dimensions, no weight).
  const itemId = await createItem({
    name: "Abstraction",
    category: "ART_PAINTINGS",
    "attr.artist": "Unknown",
    "attr.medium": "Oil on canvas",
    "attr.framed": "Framed",
    "attr.imageHeightCm": "60",
    "attr.imageWidthCm": "40",
    "attr.frameHeightCm": "90",
    "attr.frameWidthCm": "70",
  });

  const estimate = await estimateShipping({ itemId, zone: "Europe" });
  // Frame dims are preferred; the box is 90 × 70 with no depth.
  expect(estimate!.measurements.boxCm).toEqual([90, 70]);
  for (const row of estimate!.rows) {
    expect(row.quote.eligible).toBe(false);
  }
  const sea = estimate!.rows.find((r) => r.rate.forwarder === "Sea freight (LCL)")!;
  expect(sea.quote.reason).toMatch(/three dimensions/);
  const dhl = estimate!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhl.quote.reason).toMatch(/weight/i);
});

test("the Price Floor composes cost basis, shipping, insurance, margin, and the marketplace fee — converted at the editable FX rate", async () => {
  await signInAsOwner();
  const itemId = await createItem({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });
  const { setCostBasis } = await import("@/lib/catalog/actions");
  expect(
    await setCostBasis(initial, form({ itemId, costBasisIdr: "500000" }))
  ).toMatchObject({ error: null });

  // The Owner tunes the settings the floor depends on — all through the seam.
  const fx = await updatePricingSettings(
    initial,
    form({ marginPercent: "25", fxMarketplaceCurrency: "USD", fxIdrPerUnit: "16250" })
  );
  expect(fx.error).toBeNull();
  const settings = await getShippingSettings();
  const ebay = settings!.marketplaces.find((m) => m.name === "eBay")!;
  expect(
    (await updateMarketplaceFee(initial, form({ marketplaceId: ebay.id, feePercent: "12" }))).error
  ).toBeNull();

  // kendi → Asia on DHL: 2 kg chargeable × 350,000 = 700,000 shipping;
  // declared 5,000,000 × 2% = 100,000 → the 170,000 minimum applies.
  const estimate = await estimateShipping({
    itemId,
    zone: "Asia",
    marketplaceId: ebay.id,
    declaredValueIdr: 5_000_000,
  });
  expect(estimate!.fx).toEqual({ currency: "USD", idrPerUnit: 16250 });
  expect(estimate!.marginPercent).toBe(25);
  const dhl = estimate!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhl.quote.shippingIdr).toBe(700_000);
  expect(dhl.insuranceIdr).toBe(170_000);

  // costs 1,370,000 · margin 25% = 342,500 · subtotal 1,712,500
  // floor = subtotal / (1 − 12%) = 1,946,022.73 → 1,946,023
  //   (the fee is a cut of the listing price, so it is divided out)
  // USD at 16,250 → 119.76
  expect(dhl.floor).toEqual({
    costsIdr: 1_370_000,
    marginIdr: 342_500,
    subtotalIdr: 1_712_500,
    feePercent: 12,
    feeIdr: 233_523,
    floorIdr: 1_946_023,
    floorPrice: 119.76,
  });
});

test("the floor waits when the cost basis or the marketplace is missing, and says why", async () => {
  await signInAsOwner();
  const itemId = await createItem({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });

  const noCost = await estimateShipping({ itemId, zone: "Asia" });
  const dhlNoCost = noCost!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlNoCost.floor).toBeNull();
  expect(dhlNoCost.floorNote).toMatch(/cost basis/i);

  const { setCostBasis } = await import("@/lib/catalog/actions");
  await setCostBasis(initial, form({ itemId, costBasisIdr: "500000" }));
  const noMarketplace = await estimateShipping({ itemId, zone: "Asia" });
  const dhlNoMp = noMarketplace!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlNoMp.floor).toBeNull();
  expect(dhlNoMp.floorNote).toMatch(/marketplace/i);

  // With everything present but no declared value, the floor computes and
  // flags the missing insurance instead of guessing zero risk.
  const settings = await getShippingSettings();
  const ebay = settings!.marketplaces.find((m) => m.name === "eBay")!;
  const noDeclared = await estimateShipping({ itemId, zone: "Asia", marketplaceId: ebay.id });
  const dhlNoDecl = noDeclared!.rows.find((r) => r.rate.forwarder === "DHL Express insured")!;
  expect(dhlNoDecl.floor).not.toBeNull();
  expect(dhlNoDecl.floorNote).toMatch(/declared value/i);
  // Insurance contributed zero: costs = cost basis 500,000 + shipping 700,000.
  expect(dhlNoDecl.floor!.costsIdr).toBe(1_200_000);
});

test("settings edits validate: FX rate and margins are numbers, IDR is not a marketplace currency, fees stay under 100%", async () => {
  await signInAsOwner();
  const settings = await getShippingSettings();
  const ebay = settings!.marketplaces.find((m) => m.name === "eBay")!;

  for (const overrides of [
    { fxIdrPerUnit: "0" },
    { fxIdrPerUnit: "-1" },
    { fxIdrPerUnit: "cheap" },
    { fxMarketplaceCurrency: "USDX" },
    { fxMarketplaceCurrency: "idr" },
    { marginPercent: "lots" },
  ]) {
    const bad = await updatePricingSettings(
      initial,
      form({ marginPercent: "25", fxMarketplaceCurrency: "USD", fxIdrPerUnit: "16250", ...overrides })
    );
    expect(bad.error, JSON.stringify(overrides)).toBeTruthy();
  }
  expect(
    (await updateMarketplaceFee(initial, form({ marketplaceId: ebay.id, feePercent: "100" }))).error
  ).toBeTruthy();
  expect(
    (await updateMarketplaceFee(initial, form({ marketplaceId: "nope", feePercent: "10" }))).error
  ).toBeTruthy();

  // Nothing changed through all those failures.
  const after = await getShippingSettings();
  expect(after!.settings).toMatchObject({ fxIdrPerUnit: 16000, marginPercent: 30 });
  expect(after!.marketplaces.find((m) => m.id === ebay.id)!.feePercent).toBe(13.25);
});

test("shipping and pricing are Owner-only: a Cataloger can neither read nor edit them", async () => {
  await signInAsOwner();
  const settings = await getShippingSettings();
  const rate = settings!.rates[0];
  const marketplace = settings!.marketplaces[0];
  const itemId = await createItem({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });

  cookieStore.clear();
  await signInAsCataloger();

  expect(await getShippingSettings()).toBeNull();
  expect(await estimateShipping({ itemId, zone: "Asia" })).toBeNull();

  await expect(
    updateForwarderRate(
      initial,
      form({
        rateId: rate.id,
        rateIdr: "1",
        insurancePercent: "1",
        insuranceMinimumIdr: "",
        maxKgPerPiece: "",
        volumetricDivisor: "",
        transitNote: "",
      })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(
    updateMarketplaceFee(initial, form({ marketplaceId: marketplace.id, feePercent: "10" }))
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(
    updatePricingSettings(
      initial,
      form({ marginPercent: "25", fxMarketplaceCurrency: "USD", fxIdrPerUnit: "16000" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
});
