import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Listings & draft seam tests (ticket 06). Same policy as the other suites:
// only Next.js runtime transport is mocked (shared via
// src/test/browser-transport); the Server Actions under test and the
// database are real. Draft content is asserted golden — exact strings — so
// the marketplace formats cannot drift silently.
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
import { catalogItem, createItem, listItems, setCostBasis, type ItemFormState } from "@/lib/catalog/actions";
import { getShippingSettings } from "@/lib/shipping/actions";
import { recordSkbcb } from "@/lib/lifecycle/actions";
import { recordListing, getListings, setListingStatus } from "@/lib/listings/actions";

const initialFormState: ItemFormState = { error: null, fieldErrors: {} };

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

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation", "ForwarderRate", "Marketplace", "PricingSetting", "Listing" CASCADE`
  );
  cookieStore.clear();
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    delete process.env[key];
  }
  vi.unstubAllGlobals();
});

// The marketplace rows the listings build on, discovered through the seam.
async function marketplaces() {
  const settings = await getShippingSettings();
  if (!settings) throw new Error("settings unreadable — not signed in as Owner?");
  return settings.marketplaces;
}

// Creates an item through the catalog seam and returns its id.
async function createItemThroughSeam(fields: Record<string, string>): Promise<string> {
  await expect(
    createItem(initialFormState, form(fields))
  ).rejects.toThrow(/NEXT_REDIRECT/);
  const [item] = await listItems({ q: fields.name });
  if (!item) throw new Error("item not found after create");
  return item.id;
}

// Gives an item photo rows directly, as fixture setup — the upload pipeline
// has its own tests; here we only need "the item has photos".
async function giveItemPhotos(itemId: string, count: number) {
  for (let i = 1; i <= count; i++) {
    await prisma.photo.create({
      data: {
        itemId,
        publicId: `antiques/items/f-${i}`,
        format: "jpg",
        width: 4000,
        height: 3000,
        position: i,
      },
    });
  }
}

// A complete, cataloged cabinet — the standard listing subject.
async function catalogedCabinetId() {
  const id = await createItemThroughSeam({
    name: "Jati Teak Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.style": "Colonial",
    "attr.period": "Early 20th century",
    "attr.heightCm": "180",
    "attr.widthCm": "90",
    "attr.depthCm": "45",
    "attr.weightKg": "40",
    conditionNotes: "Some wear consistent with age.",
    provenance: "From grandmother's house in Bandung.",
  });
  await giveItemPhotos(id, 2);
  const result = await catalogItem({ error: null }, form({ itemId: id }));
  if (result.error) throw new Error(`fixture not cataloged: ${result.error}`);
  return id;
}

test("a Listing is recorded against an Item on a Marketplace with price and currency, and starts planned", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;

  const result = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "1250.00", currency: "USD" })
  );
  expect(result.error).toBeNull();

  const view = await getListings(itemId);
  expect(view).not.toBeNull();
  expect(view!.listings).toHaveLength(1);
  const listing = view!.listings[0];
  expect(listing.marketplace.name).toBe("eBay");
  expect(listing.marketplace.region).toBe("INTERNATIONAL");
  expect(listing.price).toBe(1250);
  expect(listing.currency).toBe("USD");
  expect(listing.status).toBe("PLANNED");

  // One Item can be offered on several channels at once (GLOSSARY: Listing).
  const tokopedia = (await marketplaces()).find((m) => m.name === "Tokopedia")!;
  expect(tokopedia.region).toBe("DOMESTIC");
  const second = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: tokopedia.id, price: "15000000", currency: "IDR" })
  );
  expect(second.error).toBeNull();
  const after = await getListings(itemId);
  expect(after!.listings.map((l) => l.marketplace.name).sort((a, b) => a.localeCompare(b))).toEqual(["eBay", "Tokopedia"]);
});

test("recording rejects nonsense prices, currencies, and unknown ids — and stores nothing", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;

  for (const overrides of [
    { price: "0" },
    { price: "-5" },
    { price: "cheap" },
    { price: "12.345" },
    { currency: "usdd" },
    { currency: "US" },
    // Prices follow the channel's currency (spec: listing prices in the
    // marketplace's currency): IDR is not the eBay currency, and Tokopedia
    // does not take the FX currency.
    { currency: "IDR" },
    { marketplaceId: "nope" },
  ]) {
    const bad = await recordListing(
      { error: null },
      form({
        itemId,
        marketplaceId: ebay.id,
        price: "1250.00",
        currency: "USD",
        ...overrides,
      })
    );
    expect(bad.error, JSON.stringify(overrides)).toBeTruthy();
  }
  const tokopedia = (await marketplaces()).find((m) => m.name === "Tokopedia")!;
  const wrongDomestic = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: tokopedia.id, price: "80", currency: "USD" })
  );
  expect(wrongDomestic.error).toContain("IDR");

  const unknownItem = await recordListing(
    { error: null },
    form({ itemId: "nope", marketplaceId: ebay.id, price: "10", currency: "USD" })
  );
  expect(unknownItem.error).toBeTruthy();

  expect((await getListings(itemId))!.listings).toHaveLength(0);
});

test("listings are the Owner's: a Cataloger can neither record nor read them", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "1250.00", currency: "USD" })
  );

  cookieStore.clear();
  await signInAsCataloger();

  expect(await getListings(itemId)).toBeNull();
  await expect(
    recordListing(
      { error: null },
      form({ itemId, marketplaceId: ebay.id, price: "10", currency: "USD" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("an unsiged-in visitor gets nothing", async () => {
  await expect(getListings("any")).rejects.toBeInstanceOf(ForbiddenError);
});

// ---------------------------------------------------------------------------
// Draft packages — golden-format assertions. The exact strings below ARE the
// marketplace format spec: eBay titles cap at 80 characters with a two-line
// opening; Etsy titles cap at 140 with comma-joined keywords and a one-line
// opening (its search weighs the first characters most); anything else gets
// the plain generic package.
// ---------------------------------------------------------------------------

function configurePhotoStorage() {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
}

const url = (variant: 1600 | 2000 | 1200, n: number) =>
  `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_${variant},h_${variant}/antiques/items/f-${n}.jpg`;

const DRAFT_BODY = `Details:
- Wood / material: Teak
- Style: Colonial
- Period: Early 20th century
- Height: 180 cm
- Width: 90 cm
- Depth: 45 cm
- Weight: 40 kg

Age: 50+ years old

Condition:
Some wear consistent with age.

Provenance:
From grandmother's house in Bandung.`;

const EBAY_DESCRIPTION = `Jati Teak Cabinet

Furniture — Teak, Colonial, Early 20th century.

${DRAFT_BODY}`;

const ETSY_DESCRIPTION = `Jati Teak Cabinet — Furniture. Teak, Colonial, Early 20th century.

${DRAFT_BODY}`;

test("the eBay draft assembles title, description, and 1600px photos — golden format", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "1250.00", currency: "USD" })
  );

  const draft = (await getListings(itemId))!.listings[0].draft!;
  expect(draft.title).toBe("Jati Teak Cabinet Teak Colonial Early 20th century");
  expect(draft.description).toBe(EBAY_DESCRIPTION);
  expect(draft.photoUrls).toEqual([url(1600, 1), url(1600, 2)]);

  // The copy-ready package in one action — title, description, price, and
  // the photo bundle sized for the marketplace, as one text block.
  expect(draft.packageText).toBe(`TITLE
Jati Teak Cabinet Teak Colonial Early 20th century

DESCRIPTION
${EBAY_DESCRIPTION}

PRICE
$1,250.00

PHOTOS — 2 for eBay (1600px)
${url(1600, 1)}
${url(1600, 2)}`);
});

test("the Etsy draft uses comma-joined keywords, a one-line opening, and 2000px photos — golden format", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  const etsy = (await marketplaces()).find((m) => m.name === "Etsy")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: etsy.id, price: "980.50", currency: "USD" })
  );

  const draft = (await getListings(itemId))!.listings[0].draft!;
  expect(draft.title).toBe("Jati Teak Cabinet, Teak, Colonial, Early 20th century");
  expect(draft.description).toBe(ETSY_DESCRIPTION);
  expect(draft.photoUrls).toEqual([url(2000, 1), url(2000, 2)]);
  expect(draft.packageText).toContain(`PRICE
$980.50`);
  expect(draft.packageText).toContain(`PHOTOS — 2 for Etsy (2000px)`);
});

test("a marketplace without a known format gets the plain generic package with display-sized photos", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  const tokopedia = (await marketplaces()).find((m) => m.name === "Tokopedia")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: tokopedia.id, price: "15000000", currency: "IDR" })
  );

  const draft = (await getListings(itemId))!.listings[0].draft!;
  expect(draft.title).toBe("Jati Teak Cabinet Teak Colonial Early 20th century");
  expect(draft.description).toBe(EBAY_DESCRIPTION);
  expect(draft.photoUrls).toEqual([url(1200, 1), url(1200, 2)]);
  expect(draft.packageText).toContain(`PRICE
IDR 15,000,000`);
});

test("a minimal record drops the sections it has nothing for — no age line, no condition, no provenance", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await createItemThroughSeam({
    name: "Small Teak Stool",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "45",
    "attr.widthCm": "40",
    "attr.depthCm": "40",
    fiftyYearsOld: "off",
  });
  await giveItemPhotos(itemId, 1);
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "120", currency: "USD" })
  );

  const draft = (await getListings(itemId))!.listings[0].draft!;
  expect(draft.title).toBe("Small Teak Stool Teak");
  expect(draft.description).toBe(`Small Teak Stool

Furniture — Teak.

Details:
- Wood / material: Teak
- Height: 45 cm
- Width: 40 cm
- Depth: 40 cm`);
});

test("a title over the limit is trimmed back to whole words, never cut mid-word", async () => {
  await signInAsOwner();
  const itemId = await createItemThroughSeam({
    name: "Abc",
    category: "FURNITURE",
    "attr.material": "M",
    "attr.period": "p".repeat(90),
    "attr.heightCm": "45",
    "attr.widthCm": "40",
    "attr.depthCm": "40",
    fiftyYearsOld: "off",
  });
  await giveItemPhotos(itemId, 1);
  const ebay = (await marketplaces()).find((m) => m.name === "eBay")!;
  await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "10", currency: "USD" })
  );

  // "Abc M ppp…" (96 chars) trims at 80 back to the last whole word "M".
  const draft = (await getListings(itemId))!.listings[0].draft!;
  expect(draft.title).toBe("Abc M");
  expect(draft.title.length).toBeLessThanOrEqual(80);
});

// ---------------------------------------------------------------------------
// Status transitions and the export gate (ADR-0002). Activating a Listing on
// an international Marketplace is where the gate binds for offers; domestic
// channels are never blocked. Cloudinary's network hop is stubbed, as in the
// lifecycle suite.
// ---------------------------------------------------------------------------

function stubCloudinaryApi() {
  let uploads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/image/destroy")) {
        return { ok: true, json: async () => ({ result: "ok" }) };
      }
      const id = ++uploads;
      return {
        ok: true,
        json: async () => ({
          public_id: `antiques/certificates/scan-${id}`,
          format: "jpg",
          width: 2480,
          height: 3508,
        }),
      };
    })
  );
}

function imageFile() {
  return new File([new Uint8Array(2048)], "skbcb-scan.jpg", { type: "image/jpeg" });
}

// Records and returns the id of one listing on `marketplaceName`. The
// currency follows the channel (IDR at home, the FX currency abroad).
async function recordOn(itemId: string, marketplaceName: string, price = "100") {
  const marketplace = (await marketplaces()).find((m) => m.name === marketplaceName)!;
  const currency = marketplace.region === "DOMESTIC" ? "IDR" : "USD";
  const result = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: marketplace.id, price, currency })
  );
  if (result.error) throw new Error(`fixture listing not recorded: ${result.error}`);
  const listing = (await getListings(itemId))!.listings.find(
    (l) => l.marketplace.name === marketplaceName
  )!;
  return listing.id;
}

test("activating a listing on an international marketplace is blocked until the SKBCB certificate is on record", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubCloudinaryApi();
  // The cabinet defaults to the 50+ flag, with no certificate recorded.
  const itemId = await catalogedCabinetId();
  const listingId = await recordOn(itemId, "eBay");

  const blocked = await setListingStatus(
    { error: null },
    form({ listingId, to: "ACTIVE" })
  );
  expect(blocked.error).toContain("SKBCB");
  expect((await getListings(itemId))!.listings[0].status).toBe("PLANNED");

  // The certificate number and the scan together open the gate.
  const recorded = await recordSkbcb(
    { error: null },
    (() => {
      const fd = form({ itemId, certificateNumber: "SKBCB/2026/DKI/0417" });
      fd.set("scan", imageFile());
      return fd;
    })()
  );
  expect(recorded.error).toBeNull();

  const active = await setListingStatus(
    { error: null },
    form({ listingId, to: "ACTIVE" })
  );
  expect(active.error).toBeNull();
  expect((await getListings(itemId))!.listings[0].status).toBe("ACTIVE");
});

test("a domestic listing activates without any certificate — the gate concerns export only", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const listingId = await recordOn(itemId, "Tokopedia");

  const active = await setListingStatus(
    { error: null },
    form({ listingId, to: "ACTIVE" })
  );
  expect(active.error).toBeNull();
  expect((await getListings(itemId))!.listings[0].status).toBe("ACTIVE");
});

test("a listing cannot activate before its item is cataloged, or after the piece is reserved", async () => {
  await signInAsOwner();
  const draftId = await createItemThroughSeam({
    name: "Rough Draft Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "180",
    "attr.widthCm": "90",
    "attr.depthCm": "45",
  });
  await giveItemPhotos(draftId, 1);
  const draftListing = await recordOn(draftId, "Tokopedia");
  const tooEarly = await setListingStatus(
    { error: null },
    form({ listingId: draftListing, to: "ACTIVE" })
  );
  expect(tooEarly.error).toMatch(/catalog/i);

  const itemId = await catalogedCabinetId();
  const listingId = await recordOn(itemId, "Tokopedia");
  await setListingStatus({ error: null }, form({ listingId, to: "ACTIVE" }));
  const { transitionItem } = await import("@/lib/lifecycle/actions");
  await transitionItem({ error: null }, form({ itemId, to: "LISTED" }));
  await transitionItem({ error: null }, form({ itemId, to: "RESERVED" }));

  const late = await recordOn(itemId, "eBay", "90");
  const tooLate = await setListingStatus(
    { error: null },
    form({ listingId: late, to: "ACTIVE" })
  );
  expect(tooLate.error).toMatch(/reserved/i);
});

test("statuses move forward only: ended listings stay ended and never carry a draft again", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const listingId = await recordOn(itemId, "Tokopedia");

  const ended = await setListingStatus(
    { error: null },
    form({ listingId, to: "ENDED" })
  );
  expect(ended.error).toBeNull();
  const view = (await getListings(itemId))!.listings[0];
  expect(view.status).toBe("ENDED");
  expect(view.draft).toBeNull();

  // Ended is final: no reactivating, no re-ending.
  for (const to of ["ACTIVE", "ENDED"]) {
    const result = await setListingStatus({ error: null }, form({ listingId, to }));
    expect(result.error, to).toBeTruthy();
  }

  // Unknown steps and listings are errors, not crashes.
  const bogus = await setListingStatus({ error: null }, form({ listingId, to: "PAUSED" }));
  expect(bogus.error).toBeTruthy();
  const missing = await setListingStatus({ error: null }, form({ listingId: "nope", to: "ACTIVE" }));
  expect(missing.error).toBeTruthy();
});

test("listing steps are Owner-only on the server", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  const listingId = await recordOn(itemId, "Tokopedia");

  cookieStore.clear();
  await signInAsCataloger();
  await expect(
    setListingStatus({ error: null }, form({ listingId, to: "ACTIVE" }))
  ).rejects.toBeInstanceOf(ForbiddenError);

  cookieStore.clear();
  await expect(
    setListingStatus({ error: null }, form({ listingId, to: "ACTIVE" }))
  ).rejects.toBeInstanceOf(ForbiddenError);
});

// ---------------------------------------------------------------------------
// The Price Floor beside the intended price (spec story 27). Worked example:
// a kendi (25 cm tall, 18 cm diameter — the diameter counts twice — 1.2 kg),
// cost basis Rp 500,000, seeded defaults (30% margin, USD at 16,000, eBay
// fee 13.25%). Its Asia-zone quotes: DHL 2 kg × 350,000; Pos 2 kg ×
// 150,000; sea 0.0081 m³ × 1,800,000 = 14,580 — sea is cheapest.
//   costs 514,580 · margin 30% = 154,374 · subtotal 668,954
//   floor = 668,954 ÷ (1 − 0.1325) = 771,129 → USD 48.20
// Without a zone the floor still shows, minus shipping:
//   650,000 ÷ 0.8675 = 749,280 → USD 46.83
// ---------------------------------------------------------------------------

async function catalogedKendiId() {
  const id = await createItemThroughSeam({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });
  await giveItemPhotos(id, 1);
  const cataloged = await catalogItem({ error: null }, form({ itemId: id }));
  if (cataloged.error) throw new Error(`fixture not cataloged: ${cataloged.error}`);
  const cost = await setCostBasis({ error: null }, form({ itemId: id, costBasisIdr: "500000" }));
  if (cost.error) throw new Error(`fixture cost basis: ${cost.error}`);
  return id;
}

test("the floor sits beside the price with the cheapest forwarder's shipping for the chosen zone", async () => {
  await signInAsOwner();
  const itemId = await catalogedKendiId();
  await recordOn(itemId, "eBay", "100.00");

  // No zone chosen: the floor shows without shipping, and says so.
  const noZone = (await getListings(itemId))!.listings[0];
  expect(noZone.floor).toEqual({
    floorPrice: 46.83,
    floorIdr: 749_280,
    includesShipping: false,
    viaForwarder: null,
  });
  expect(noZone.floorNote).toMatch(/zone/i);
  expect(noZone.priceBelowFloorBy).toBeNull(); // $100 sits above $46.83

  // With the Asia zone, sea freight is the cheapest eligible quote.
  const withZone = (await getListings(itemId, "Asia"))!.listings[0];
  expect(withZone.floor).toEqual({
    floorPrice: 48.2,
    floorIdr: 771_129,
    includesShipping: true,
    viaForwarder: "Sea freight (LCL)",
  });
  expect(withZone.floorNote).toBeNull();
  expect(withZone.priceBelowFloorBy).toBeNull();
});

test("a price below the floor is flagged with the shortfall", async () => {
  await signInAsOwner();
  const itemId = await catalogedKendiId();
  await recordOn(itemId, "eBay", "20.00");

  const listing = (await getListings(itemId, "Asia"))!.listings[0];
  expect(listing.priceBelowFloorBy).toEqual({ amount: 28.2, currency: "USD" });
});

test("without a cost basis there is no floor — the view says why instead of guessing", async () => {
  await signInAsOwner();
  const itemId = await createItemThroughSeam({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });
  await giveItemPhotos(itemId, 1);
  await recordOn(itemId, "eBay", "100.00");

  const listing = (await getListings(itemId, "Asia"))!.listings[0];
  expect(listing.floor).toBeNull();
  expect(listing.floorNote).toMatch(/cost basis/i);
});
