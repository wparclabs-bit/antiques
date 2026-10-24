import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// The home page's attention strip and stage-chip counts (ticket 10). Same
// policy as the other suites: only Next.js runtime transport is mocked;
// the Server Actions under test and the database are real. Every row is
// derived from records the family already made — no task engine, just
// counts over the Catalog.
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
  listItems,
  type ItemFormState,
} from "@/lib/catalog/actions";
import { recordSocialPost } from "@/lib/social/actions";
import { getAttentionRows, getStateCounts } from "@/lib/attention";

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

async function signInAsOwner() {
  await createUser();
  await expect(
    signIn({ error: null }, form({ email: "owner@test.local", password: "owner-password-1" }))
  ).rejects.toThrow(/NEXT_REDIRECT/);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation", "ForwarderRate", "Marketplace", "PricingSetting", "Listing", "Sale", "SocialPost", "LifecycleEvent" CASCADE`
  );
  cookieStore.clear();
  vi.unstubAllGlobals();
});

// Creates an item through the catalog seam and returns its id.
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
      publicId: `antiques/items/${itemId}`,
      format: "jpg",
      width: 4000,
      height: 3000,
      position: 1,
    },
  });
}

// Fixture setup: states beyond what the actions under test produce are
// set directly, like the photo fixtures. What the rows compute over is
// state + listings + posts — exactly what is set here.
async function forceState(itemId: string, state: string) {
  await prisma.item.update({
    where: { id: itemId },
    data: { state: state as "DRAFT" },
  });
}

async function addListing(itemId: string, status: "PLANNED" | "ACTIVE" | "ENDED") {
  const marketplace = await prisma.marketplace.findFirst({ where: { name: "eBay" } });
  if (!marketplace) throw new Error("seed the marketplaces first");
  await prisma.listing.create({
    data: {
      itemId,
      marketplaceId: marketplace.id,
      price: "100",
      currency: "USD",
      status,
    },
  });
}

test("drafts with photos but missing details are counted; empty drafts and complete records are not", async () => {
  await signInAsOwner();

  // Seeded marketplaces are needed by later fixtures in other tests; here
  // the draft row needs none.
  const started = await createItemThroughSeam({
    name: "Started Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    // Missing required height/width/depth — an incomplete record.
  });
  await giveItemAPhoto(started);

  const empty = await createItemThroughSeam({
    name: "Empty Draft",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  }); // no photo — nothing captured yet, not "started"

  const complete = await createItemThroughSeam({
    name: "Complete Draft",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(complete);
  const cataloged = await catalogItem({ error: null }, form({ itemId: complete }));
  expect(cataloged.error).toBeNull();

  const row = await row1("drafts-missing-details");
  expect(row!.count).toBe(1);
  expect(row!.href).toContain("state=DRAFT");
  expect(empty).toBeTruthy();
});

async function row1(key: string) {
  const rows = await getAttentionRows();
  return rows.find((candidate) => candidate.key === key);
}

test("cataloged items with no listing are counted; even a planned offer clears the row", async () => {
  await signInAsOwner();
  const lonely = await createItemThroughSeam({
    name: "Lonely Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(lonely);
  await catalogItem({ error: null }, form({ itemId: lonely }));

  const offered = await createItemThroughSeam({
    name: "Offered Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(offered);
  await catalogItem({ error: null }, form({ itemId: offered }));
  // Seeded marketplaces: a read through the settings seam ensures the rows.
  const { getShippingSettings } = await import("@/lib/shipping/actions");
  await getShippingSettings();
  await addListing(offered, "PLANNED");

  const found = await row1("cataloged-never-listed");
  expect(found!.count).toBe(1);
  expect(found!.href).toContain("state=CATALOGED");
});

test("a listed item with no marketing posts is counted; recording one post clears it", async () => {
  await signInAsOwner();
  const itemId = await createItemThroughSeam({
    name: "Unmarketed Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(itemId);
  await catalogItem({ error: null }, form({ itemId }));
  const { getShippingSettings } = await import("@/lib/shipping/actions");
  await getShippingSettings();
  await addListing(itemId, "ACTIVE");
  // The row is stage-derived: the piece stands in Listed.
  await forceState(itemId, "LISTED");

  const before = await row1("listed-never-marketed");
  expect(before!.count).toBe(1);
  expect(before!.href).toContain("state=LISTED");

  const posted = await recordSocialPost(
    { error: null },
    form({ itemId, platform: "Instagram", postedOn: "2026-10-24" })
  );
  expect(posted.error).toBeNull();

  // Recording the post retires the row entirely.
  const after = await row1("listed-never-marketed");
  expect(after).toBeUndefined();
});

test("reserved items waiting for their sale record are counted; recording the sale clears them", async () => {
  await signInAsOwner();
  const itemId = await createItemThroughSeam({
    name: "Reserved Cabinet",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(itemId);
  await catalogItem({ error: null }, form({ itemId }));
  await forceState(itemId, "RESERVED");

  const before = await row1("reserved-not-sold");
  expect(before!.count).toBe(1);
  expect(before!.href).toContain("state=RESERVED");

  await forceState(itemId, "SOLD");
  const after = await row1("reserved-not-sold");
  expect(after).toBeUndefined();
});

test("only rows with something to show are returned, and stage counts honor the view", async () => {
  await signInAsOwner();

  const draftId = await createItemThroughSeam({
    name: "Draft Piece",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  const soldId = await createItemThroughSeam({
    name: "Sold Piece",
    category: "FURNITURE",
    "attr.material": "Teak",
    "attr.heightCm": "10",
    "attr.widthCm": "10",
    "attr.depthCm": "10",
  });
  await giveItemAPhoto(soldId);
  await forceState(soldId, "SOLD");

  // The sold item has a complete-enough record? It is SOLD, so no row
  // applies to it; the draft has no photo, so no row either.
  const rows = await getAttentionRows();
  expect(rows).toEqual([]);

  const catalog = await getStateCounts("catalog");
  expect(catalog.DRAFT).toBe(1);
  expect(catalog.SOLD).toBe(1);

  const inventory = await getStateCounts("inventory");
  expect(inventory.DRAFT).toBe(1);
  expect(inventory.SOLD).toBe(0);
  expect(inventory.SHIPPED).toBe(0);

  expect(draftId).toBeTruthy();
});

test("the attention reads need a signed-in family login", async () => {
  await expect(getAttentionRows()).rejects.toBeInstanceOf(ForbiddenError);
  await expect(getStateCounts("catalog")).rejects.toBeInstanceOf(ForbiddenError);
});
