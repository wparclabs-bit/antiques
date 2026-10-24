import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Sales & the archive seam tests (ticket 07). Same policy as the other
// suites: only Next.js runtime transport is mocked (shared via
// src/test/browser-transport); the Server Actions under test and the
// database are real. The sale is exercised through the actions that record
// it and the reads that show it — never by inspecting tables.
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
  catalogItem,
  createItem,
  getItem,
  listItems,
  type ItemFormState,
} from "@/lib/catalog/actions";
import { getShippingSettings } from "@/lib/shipping/actions";
import {
  getItemHistory,
  transitionItem,
} from "@/lib/lifecycle/actions";
import {
  recordListing,
  setListingStatus,
  getListings,
} from "@/lib/listings/actions";
import { getSale, getSaleLog, recordSale } from "@/lib/sales/actions";

const initialFormState: ItemFormState = { error: null, fieldErrors: {} };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function createUser(
  fields: Partial<{ email: string; name: string; password: string }> = {}
) {
  return prisma.user.create({
    data: {
      email: fields.email ?? "owner@test.local",
      name: fields.name ?? "Test Owner",
      passwordHash: await hashPassword(fields.password ?? "owner-password-1"),
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
  });
  await signInAs("ada@test.local", "cataloger-password-1");
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation", "ForwarderRate", "Marketplace", "PricingSetting", "Listing", "Sale", "LifecycleEvent" CASCADE`
  );
  cookieStore.clear();
  vi.unstubAllGlobals();
});

// Today, as the sale form would send it.
function today(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

const CABINET_FORM = {
  name: "Jati Teak Cabinet",
  category: "FURNITURE",
  "attr.material": "Teak",
  "attr.heightCm": "180",
  "attr.widthCm": "90",
  "attr.depthCm": "45",
  "attr.weightKg": "40",
  conditionNotes: "Some wear consistent with age.",
  provenance: "From grandmother's house in Bandung.",
};

async function createItemThroughSeam(fields: Record<string, string>): Promise<string> {
  await expect(
    createItem(initialFormState, form(fields))
  ).rejects.toThrow(/NEXT_REDIRECT/);
  const [item] = await listItems({ q: fields.name });
  if (!item) throw new Error("item not found after create");
  return item.id;
}

async function giveItemAPhoto(itemId: string) {
  await prisma.photo.create({
    data: {
      itemId,
      publicId: `antiques/items/fixture-${itemId}`,
      format: "jpg",
      width: 4000,
      height: 3000,
      position: 1,
    },
  });
}

async function catalogedItem(fields: Record<string, string> = CABINET_FORM) {
  const id = await createItemThroughSeam(fields);
  await giveItemAPhoto(id);
  const result = await catalogItem({ error: null }, form({ itemId: id }));
  if (result.error) throw new Error(`fixture not cataloged: ${result.error}`);
  return id;
}

// The road to a sale: an active domestic offer (never gate-blocked), the
// Listed step that follows it, and the verbal commitment.
async function reservedItem(fields: Record<string, string> = CABINET_FORM) {
  const id = await catalogedItem(fields);
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia");
  if (!tokopedia) throw new Error("Tokopedia not found");
  const recorded = await recordListing(
    { error: null },
    form({ itemId: id, marketplaceId: tokopedia.id, price: "1500000", currency: "IDR" })
  );
  if (recorded.error) throw new Error(`fixture listing not recorded: ${recorded.error}`);
  const view = await getListings(id);
  const listing = view!.listings.find((l) => l.marketplace.name === "Tokopedia");
  if (!listing) throw new Error("fixture listing not found");
  const activated = await setListingStatus(
    { error: null },
    form({ listingId: listing.id, to: "ACTIVE" })
  );
  if (activated.error) throw new Error(`fixture listing not activated: ${activated.error}`);
  const listed = await transitionItem({ error: null }, form({ itemId: id, to: "LISTED" }));
  if (listed.error) throw new Error(`fixture not listed: ${listed.error}`);
  const reserved = await transitionItem({ error: null }, form({ itemId: id, to: "RESERVED" }));
  if (reserved.error) throw new Error(`fixture not reserved: ${reserved.error}`);
  return id;
}

test("recording the sale marks a Reserved item Sold and the record shows price, marketplace, and date", async () => {
  await signInAsOwner();
  const id = await reservedItem();
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;

  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "1250000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();

  expect((await getItem(id))?.state).toBe("SOLD");

  const sale = await getSale(id);
  expect(sale).not.toBeNull();
  expect(sale!.price).toBe(1250000);
  expect(sale!.currency).toBe("IDR");
  expect(sale!.marketplace.name).toBe("Tokopedia");
  expect(sale!.soldOn.toISOString()).toBe(`${today()}T00:00:00.000Z`);
});

test("a sold item leaves Inventory but stays in the Catalog forever with its sale record", async () => {
  await signInAsOwner();
  const id = await reservedItem();
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;
  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "1250000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();

  // The archive keeps it; the inventory does not.
  const catalog = await listItems({});
  expect(catalog.map((item) => item.id)).toContain(id);
  const inventory = await listItems({ view: "inventory" });
  expect(inventory.map((item) => item.id)).not.toContain(id);

  // The Catalog card carries the sold price for the Owner — the family's
  // own price history compounding.
  const card = catalog.find((item) => item.id === id);
  expect(card?.sale).not.toBeNull();
  expect(card!.sale!.price).toBe(1250000);
  expect(card!.sale!.currency).toBe("IDR");
  expect(card!.sale!.marketplaceName).toBe("Tokopedia");
});

test("a sale can be recorded in the marketplace's currency through an international channel", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });
  const settings = await getShippingSettings();
  const ebay = settings!.marketplaces.find((m) => m.name === "eBay")!;
  await recordListing(
    { error: null },
    form({ itemId: id, marketplaceId: ebay.id, price: "450", currency: "USD" })
  );
  const view = await getListings(id);
  const listing = view!.listings.find((l) => l.marketplace.name === "eBay");
  if (!listing) throw new Error("fixture listing not found");
  await setListingStatus({ error: null }, form({ listingId: listing.id, to: "ACTIVE" }));
  await transitionItem({ error: null }, form({ itemId: id, to: "LISTED" }));
  await transitionItem({ error: null }, form({ itemId: id, to: "RESERVED" }));

  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "430", currency: "USD", marketplaceId: ebay.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();

  // The actual sale is what was paid — here less than the 450 asking price,
  // in the currency the buyer paid in.
  const sale = await getSale(id);
  expect(sale!.price).toBe(430);
  expect(sale!.currency).toBe("USD");
  expect(sale!.marketplace.name).toBe("eBay");
});

test("any family login records and reads sales; a visitor gets nothing", async () => {
  await signInAsOwner();
  const id = await reservedItem();
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;
  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "1250000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();

  // Another family login — one role, same reads (ADR-0003).
  cookieStore.clear();
  await signInAsCataloger();
  const sale = await getSale(id);
  expect(sale!.price).toBe(1250000);
  expect((await listItems({})).find((item) => item.id === id)?.sale).not.toBeNull();

  // Nobody signed-out records or reads sales.
  cookieStore.clear();
  await expect(
    recordSale(
      { error: null },
      form({ itemId: id, price: "1", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(getSale(id)).rejects.toBeInstanceOf(ForbiddenError);
});

test("a sale needs a real price, currency, marketplace, and date — nothing is stored otherwise", async () => {
  await signInAsOwner();
  const id = await reservedItem();
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;

  const badPrices = await recordSale(
    { error: null },
    form({ itemId: id, price: "0", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(badPrices.error).toMatch(/positive number/i);

  const badCurrency = await recordSale(
    { error: null },
    form({ itemId: id, price: "100", currency: "DOLLAR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(badCurrency.error).toMatch(/currency/i);

  const badMarketplace = await recordSale(
    { error: null },
    form({ itemId: id, price: "100", currency: "IDR", marketplaceId: "no-such-row", soldOn: today() })
  );
  expect(badMarketplace.error).toMatch(/choose the marketplace/i);

  const noDate = await recordSale(
    { error: null },
    form({ itemId: id, price: "100", currency: "IDR", marketplaceId: tokopedia.id, soldOn: "" })
  );
  expect(noDate.error).toMatch(/date the item sold/i);

  const futureDate = await recordSale(
    { error: null },
    form({ itemId: id, price: "100", currency: "IDR", marketplaceId: tokopedia.id, soldOn: "2027-01-01" })
  );
  expect(futureDate.error).toMatch(/cannot be in the future/i);

  // The item is still Reserved with no record — retryable, nothing half-saved.
  expect((await getItem(id))?.state).toBe("RESERVED");
  expect(await getSale(id)).toBeNull();
});

test("a Cataloged item cannot be marked Sold before it is Reserved", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;

  const tooSoon = await recordSale(
    { error: null },
    form({ itemId: id, price: "100", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(tooSoon.error).toMatch(/only a reserved item/i);
  expect((await getItem(id))?.state).toBe("CATALOGED");
  expect(await getSale(id)).toBeNull();
});

test("the Sold step refuses to bypass the sale record — recording the sale is the transition", async () => {
  await signInAsOwner();
  const id = await reservedItem();

  const bypass = await transitionItem({ error: null }, form({ itemId: id, to: "SOLD" }));
  expect(bypass.error).toMatch(/recording the sale/i);
  expect((await getItem(id))?.state).toBe("RESERVED");
  expect(await getSale(id)).toBeNull();

  // The real step still works afterwards.
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;
  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "1250000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();
  expect((await getItem(id))?.state).toBe("SOLD");
});

test("the lifecycle history shows every state entered, oldest first, with the sale beside Sold for the Owner", async () => {
  await signInAsOwner();
  const id = await reservedItem();
  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;
  await recordSale(
    { error: null },
    form({ itemId: id, price: "1250000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );

  const history = await getItemHistory(id);
  expect(history.events.map((event) => event.state)).toEqual([
    "DRAFT",
    "CATALOGED",
    "LISTED",
    "RESERVED",
    "SOLD",
  ]);

  // The Owner's history carries the sale; the sold date shown is the
  // actual sale date, not the day the button was pressed.
  expect(history.sale).not.toBeNull();
  expect(history.sale!.price).toBe(1250000);
  expect(history.sale!.soldOn.toISOString()).toBe(`${today()}T00:00:00.000Z`);

  // Every family login sees the sale line beside the Sold step (ADR-0003).
  cookieStore.clear();
  await signInAsCataloger();
  const familyView = await getItemHistory(id);
  expect(familyView.events.map((event) => event.state)).toEqual([
    "DRAFT",
    "CATALOGED",
    "LISTED",
    "RESERVED",
    "SOLD",
  ]);
  expect(familyView.sale).not.toBeNull();
  expect(familyView.sale!.price).toBe(1250000);
});

test("a piece marked Sold before sale recording existed can still get its record — the archive keeps no holes", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });
  // Fixture surgery, as with photo rows: the state of a pre-ticket-07 item
  // that was marked Sold through the old transition — no record exists.
  await prisma.item.update({ where: { id }, data: { state: "SOLD" } });

  const settings = await getShippingSettings();
  const tokopedia = settings!.marketplaces.find((m) => m.name === "Tokopedia")!;
  const recorded = await recordSale(
    { error: null },
    form({ itemId: id, price: "900000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(recorded.error).toBeNull();

  // The record is attached; the state does not move again.
  expect((await getItem(id))?.state).toBe("SOLD");
  expect((await getSale(id))!.price).toBe(900000);

  // And it is recorded exactly once.
  const again = await recordSale(
    { error: null },
    form({ itemId: id, price: "1", currency: "IDR", marketplaceId: tokopedia.id, soldOn: today() })
  );
  expect(again.error).toMatch(/already recorded/i);
});

// ---------------------------------------------------------------------------
// The Sale log (ticket 10): every recorded sale in one place, newest first
// — the family's compounding price database made visible.
// ---------------------------------------------------------------------------

test("the sale log lists every recorded sale newest first, with piece, photo, price, marketplace, and date", async () => {
  await signInAsOwner();

  const olderId = await reservedItem({
    ...CABINET_FORM,
    name: "Old Cabinet",
  });
  const newerId = await reservedItem({
    ...CABINET_FORM,
    name: "Recent Cabinet",
  });
  const tokopedia = (await getShippingSettings())!.marketplaces.find(
    (m) => m.name === "Tokopedia"
  )!;

  const older = await recordSale(
    { error: null },
    form({ itemId: olderId, price: "12000000", currency: "IDR", marketplaceId: tokopedia.id, soldOn: "2026-09-01" })
  );
  expect(older.error).toBeNull();
  const newer = await recordSale(
    { error: null },
    form({ itemId: newerId, price: "800", currency: "USD", marketplaceId: tokopedia.id, soldOn: "2026-10-20" })
  );
  expect(newer.error).toBeNull();

  const log = await getSaleLog();
  expect(log.map((entry) => entry.itemName)).toEqual([
    "Recent Cabinet",
    "Old Cabinet",
  ]);
  expect(log[0]).toMatchObject({
    itemId: newerId,
    price: 800,
    currency: "USD",
    marketplaceName: "Tokopedia",
  });
  expect(log[0].soldOn.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  // No photos were given to these fixtures — the log says so honestly.
  expect(log[0].thumbnailUrl).toBeNull();
});

test("same-day sales read most-recent-recorded first, and a photographed piece shows its thumbnail", async () => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  await signInAsOwner();

  const firstId = await reservedItem({ ...CABINET_FORM, name: "First Bowl" });
  const secondId = await reservedItem({ ...CABINET_FORM, name: "Second Bowl" });
  // The catalogedItem fixture already attached a photo (the Catalog gate
  // needs one); name its publicId so the thumbnail URL is assertable.
  await prisma.photo.updateMany({
    where: { itemId: secondId },
    data: { publicId: "antiques/items/bowl-1" },
  });
  const tokopedia = (await getShippingSettings())!.marketplaces.find(
    (m) => m.name === "Tokopedia"
  )!;

  for (const [itemId, price] of [
    [firstId, "100000"],
    [secondId, "200000"],
  ] as const) {
    const sale = await recordSale(
      { error: null },
      form({ itemId, price, currency: "IDR", marketplaceId: tokopedia.id, soldOn: "2026-10-24" })
    );
    expect(sale.error).toBeNull();
  }

  const log = await getSaleLog();
  expect(log.map((entry) => entry.itemName)).toEqual(["Second Bowl", "First Bowl"]);
  expect(log[0].thumbnailUrl).toBe(
    `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_400,h_400/antiques/items/bowl-1.jpg`
  );
});

test("the sale log needs a signed-in family login", async () => {
  await expect(getSaleLog()).rejects.toBeInstanceOf(ForbiddenError);
});
