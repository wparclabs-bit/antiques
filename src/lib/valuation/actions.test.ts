import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Valuation seam tests (ticket 03). Same policy as the other suites: only
// Next.js runtime transport is mocked (shared via src/test/browser-transport);
// the Server Actions under test and the database are real.
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
  addComparable,
  getComparables,
  getSoldSearchLinks,
  getValuation,
  removeComparable,
  setValuation,
  type ActionState,
} from "@/lib/valuation/actions";

const initial: ActionState = { error: null };

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

// Creates a Cabinet through the catalog seam and returns its id.
async function createCabinet(overrides: Record<string, string> = {}) {
  const { createItem } = await import("@/lib/catalog/actions");
  const fd = form({
    name: "Jati Teak Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.style": "Colonial",
    "attr.heightCm": "180",
    "attr.widthCm": "90",
    "attr.depthCm": "45",
    ...overrides,
  });
  await expect(createItem({ error: null, fieldErrors: {} }, fd)).rejects.toThrow(
    /NEXT_REDIRECT/
  );
  const { listItems } = await import("@/lib/catalog/actions");
  const [item] = await listItems({ q: "Jati Teak Cabinet" });
  if (!item) throw new Error("cabinet not found after create");
  return item.id;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation" CASCADE`
  );
  cookieStore.clear();
});

const GOOD_COMP = {
  source: "eBay",
  url: "https://www.ebay.com/itm/123456789",
  soldOn: "2026-09-15",
  price: "129.99",
  currency: "USD",
  notes: "Same size, restained top.",
};

test("the Owner can record a Comparable with all its evidence fields", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const result = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP })
  );
  expect(result.error).toBeNull();

  const comps = await getComparables(itemId);
  expect(comps).toHaveLength(1);
  expect(comps?.[0]).toMatchObject({
    source: "eBay",
    url: "https://www.ebay.com/itm/123456789",
    price: 129.99,
    currency: "USD",
    notes: "Same size, restained top.",
  });
  expect(comps?.[0].soldOn.toISOString()).toBe("2026-09-15T00:00:00.000Z");
});

test("a Comparable with a bad URL, currency, or date is rejected and nothing is stored", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const badUrl = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP, url: "not-a-url" })
  );
  expect(badUrl.error).toBeTruthy();

  const badCurrency = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP, currency: "dollars" })
  );
  expect(badCurrency.error).toBeTruthy();

  const badDate = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP, soldOn: "sometime last year" })
  );
  expect(badDate.error).toBeTruthy();

  const badPrice = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP, price: "cheap" })
  );
  expect(badPrice.error).toBeTruthy();

  expect(await getComparables(itemId)).toHaveLength(0);
});

test("the Owner can remove a Comparable", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();
  await addComparable(initial, form({ itemId, ...GOOD_COMP }));

  const [comp] = (await getComparables(itemId))!;
  const removed = await removeComparable(initial, form({ comparableId: comp.id }));
  expect(removed.error).toBeNull();
  expect(await getComparables(itemId)).toHaveLength(0);
});

test("pricing evidence is family business: any login records and reads Comparables; a visitor gets nothing", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();
  await addComparable(initial, form({ itemId, ...GOOD_COMP }));

  // Another family login — one role, same evidence (ADR-0003).
  cookieStore.clear();
  await signInAsCataloger();
  expect(await getComparables(itemId)).toHaveLength(1);

  // Nobody signed-out reads or records pricing evidence.
  cookieStore.clear();
  await expect(getComparables(itemId)).rejects.toBeInstanceOf(ForbiddenError);
  await expect(
    addComparable(initial, form({ itemId, ...GOOD_COMP }))
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("the Owner can set a Valuation range; each setting is kept as history", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const first = await setValuation(
    initial,
    form({ itemId, minPrice: "100", maxPrice: "150", currency: "USD" })
  );
  expect(first.error).toBeNull();

  let view = await getValuation(itemId);
  expect(view?.current).toMatchObject({ minPrice: 100, maxPrice: 150, currency: "USD" });
  expect(view?.history).toHaveLength(1);

  const second = await setValuation(
    initial,
    form({ itemId, minPrice: "1200000", maxPrice: "1800000", currency: "IDR" })
  );
  expect(second.error).toBeNull();

  view = await getValuation(itemId);
  expect(view?.current).toMatchObject({
    minPrice: 1200000,
    maxPrice: 1800000,
    currency: "IDR",
  });
  // History retains everything, newest first.
  expect(view?.history).toHaveLength(2);
  expect(Number(view?.history[0].minPrice)).toBe(1200000);
  expect(Number(view?.history[1].minPrice)).toBe(100);
});

test("an inverted or malformed Valuation range is rejected", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const inverted = await setValuation(
    initial,
    form({ itemId, minPrice: "200", maxPrice: "150", currency: "USD" })
  );
  expect(inverted.error).toBeTruthy();

  const malformed = await setValuation(
    initial,
    form({ itemId, minPrice: "lots", maxPrice: "150", currency: "USD" })
  );
  expect(malformed.error).toBeTruthy();

  const badCurrency = await setValuation(
    initial,
    form({ itemId, minPrice: "100", maxPrice: "150", currency: "USDX" })
  );
  expect(badCurrency.error).toBeTruthy();

  expect((await getValuation(itemId))?.current).toBeNull();
});

test("any family login sets a Valuation; a visitor is rejected", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  cookieStore.clear();
  await signInAsCataloger();
  const set = await setValuation(
    initial,
    form({ itemId, minPrice: "100", maxPrice: "150", currency: "USD" })
  );
  expect(set.error).toBeNull();
  expect((await getValuation(itemId))?.current).toMatchObject({ minPrice: 100 });

  cookieStore.clear();
  await expect(
    setValuation(initial, form({ itemId, minPrice: "1", maxPrice: "2", currency: "USD" }))
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("sold-search links are assembled from the item's name and identifying attributes", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const links = await getSoldSearchLinks(itemId);
  // Deterministic: the name followed by the category's identifying fields,
  // in template order (material, style).
  expect(links?.ebay).toBe(
    "https://www.ebay.com/sch/i.html?_nkw=Jati%20Teak%20Cabinet%20Teak%20Colonial&LH_Sold=1&LH_Complete=1"
  );
  expect(links?.etsy).toBe(
    "https://www.etsy.com/search?q=Jati%20Teak%20Cabinet%20Teak%20Colonial"
  );
});

test("sold-search links need a signed-in family login", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  cookieStore.clear();
  await expect(getSoldSearchLinks(itemId)).rejects.toBeInstanceOf(ForbiddenError);
});

test("a Comparable cannot be dated in the future", async () => {
  await signInAsOwner();
  const itemId = await createCabinet();

  const future = new Date();
  future.setDate(future.getDate() + 7);
  const futureOn = future.toISOString().slice(0, 10);

  const result = await addComparable(
    initial,
    form({ itemId, ...GOOD_COMP, soldOn: futureOn })
  );
  expect(result.error).toBeTruthy();
  expect(await getComparables(itemId)).toHaveLength(0);
});

test("sold-search links for a watch include brand and model", async () => {
  await signInAsOwner();
  const { createItem, listItems } = await import("@/lib/catalog/actions");
  await expect(
    createItem(
      { error: null, fieldErrors: {} },
      form({
        name: "Diver 200m",
        category: "WATCH",
        "attr.brand": "Seiko",
        "attr.model": "SKX007",
        "attr.movement": "Automatic",
        "attr.caseMaterial": "Steel",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);
  const [watch] = await listItems({ q: "Diver" });

  const links = await getSoldSearchLinks(watch.id);
  expect(links?.ebay).toBe(
    "https://www.ebay.com/sch/i.html?_nkw=Diver%20200m%20Seiko%20SKX007&LH_Sold=1&LH_Complete=1"
  );
});
