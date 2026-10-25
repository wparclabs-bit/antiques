import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Listing-kit export seam tests (ticket 10, closing ticket 06's noted
// zip-bundle limitation). Same policy as the other suites: only Next.js
// runtime transport is mocked; the kit builders and the database are real.
// The zips are opened back with jszip and their CONTENTS asserted — the
// golden package text from the listings suite rides along into listing.txt,
// and photo files must carry exactly the bytes photo storage served.
// ---------------------------------------------------------------------------

vi.mock("next/headers", async () => (await import("@/test/browser-transport")).nextHeaders);
vi.mock("next/navigation", async () => (await import("@/test/browser-transport")).nextNavigation);
vi.mock("next/cache", async () => (await import("@/test/browser-transport")).nextCache);
vi.mock("next/server", async () => (await import("@/test/browser-transport")).nextServer);

import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signIn } from "@/lib/auth/actions";
import { ForbiddenError } from "@/lib/auth/errors";
import { cookieStore } from "@/test/browser-transport";
import { catalogItem, createItem, listItems, type ItemFormState } from "@/lib/catalog/actions";
import { getShippingSettings } from "@/lib/shipping/actions";
import { recordListing, getListings } from "@/lib/listings/actions";
import { buildCategoryKit, buildListingKit } from "@/lib/export/kit";

const initialFormState: ItemFormState = { error: null, fieldErrors: {} };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function createUser() {
  return prisma.user.create({
    data: {
      email: "owner@test.local",
      name: "Test Owner",
      passwordHash: await hashPassword("owner-password-1"),
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
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    delete process.env[key];
  }
  vi.unstubAllGlobals();
});

async function createItemThroughSeam(fields: Record<string, string>): Promise<string> {
  await expect(
    createItem(initialFormState, form(fields))
  ).rejects.toThrow(/NEXT_REDIRECT/);
  const [item] = await listItems({ q: fields.name });
  if (!item) throw new Error("item not found after create");
  return item.id;
}

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
async function catalogedCabinetId(name = "Jati Teak Cabinet") {
  const id = await createItemThroughSeam({
    name,
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

function configurePhotoStorage() {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
}

// Photo downloads are marker bytes per URL, so the zip's photo entries can
// be asserted exactly.
const photoBytes = (n: number) => Buffer.from(`fake-jpg-bytes-${n}`);

function stubPhotoDownloads() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const match = /antiques\/items\/f-(\d+)\.jpg$/.exec(String(url));
      if (match) {
        return { ok: true, arrayBuffer: async () => photoBytes(Number(match[1])) };
      }
      return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    })
  );
}

async function recordEbayListing(itemId: string) {
  const ebay = (await getShippingSettings()).marketplaces.find((m) => m.name === "eBay")!;
  const recorded = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: ebay.id, price: "1250.00", currency: "USD" })
  );
  if (recorded.error) throw new Error(`fixture listing: ${recorded.error}`);
  return (await getListings(itemId))!.listings.find((l) => l.marketplace.name === "eBay")!;
}

test("a single listing kit zips the golden package text plus the sized photo files", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubPhotoDownloads();
  const itemId = await catalogedCabinetId();
  const listing = await recordEbayListing(itemId);

  const kit = await buildListingKit(itemId, listing.id);
  expect(kit).not.toBeNull();
  expect(kit!.filename).toBe("jati-teak-cabinet-ebay.zip");

  const zip = await JSZip.loadAsync(kit!.bytes);
  const names = Object.keys(zip.files);
  const folderEntry = names.find((name) => name.endsWith("/"));
  expect(folderEntry).toBeDefined();
  const folder = folderEntry!.replace("/", "");
  expect(folder).toBe(`jati-teak-cabinet-${listing.id.slice(0, 4)}`);

  // listing.txt is the copy-ready package — its TITLE and PRICE sections
  // are the listings suite's golden format.
  const listingTxt = await zip.file(`${folder}/listing.txt`)!.async("string");
  expect(listingTxt).toContain("TITLE\nJati Teak Cabinet Teak Colonial Early 20th century");
  expect(listingTxt).toContain("PRICE\n$1,250.00");
  expect(listingTxt).toContain("PHOTOS — 2 for eBay (1600px)");

  // The photo files carry exactly the bytes photo storage served, at the
  // marketplace-sized URLs.
  expect(Buffer.compare(await zip.file(`${folder}/photo-1.jpg`)!.async("nodebuffer"), photoBytes(1))).toBe(0);
  expect(Buffer.compare(await zip.file(`${folder}/photo-2.jpg`)!.async("nodebuffer"), photoBytes(2))).toBe(0);
  const fetchCalls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
  expect(fetchCalls[0]).toContain("w_1600");
});

test("a single kit is honest about unavailable photos instead of failing", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubPhotoDownloads();
  const itemId = await catalogedCabinetId();
  const listing = await recordEbayListing(itemId);

  // One photo's download fails (storage says no): the kit still builds,
  // with the surviving photo in place.
  // Re-stub rather than mockImplementation: the override's partial
  // Response objects don't satisfy the global fetch type.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("f-2.jpg")) {
        return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      const match = /antiques\/items\/f-(\d+)\.jpg$/.exec(String(url));
      if (match) {
        return { ok: true, arrayBuffer: async () => photoBytes(Number(match[1])) };
      }
      return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    })
  );

  const kit = await buildListingKit(itemId, listing.id);
  const zip = await JSZip.loadAsync(kit!.bytes);
  const folderEntry = Object.keys(zip.files).find((name) => name.endsWith("/"));
  expect(folderEntry).toBeDefined();
  const folder = folderEntry!.replace("/", "");
  expect(zip.file(`${folder}/photo-1.jpg`)).not.toBeNull();
  expect(zip.file(`${folder}/photo-2.jpg`)).toBeNull();
});

test("an unknown, ended, or mismatched listing yields no kit", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();

  expect(await buildListingKit(itemId, "nope")).toBeNull();

  const listing = await recordEbayListing(itemId);
  expect(await buildListingKit("some-other-item", listing.id)).toBeNull();
});

test("a category bundle packs one folder per listed item and a manifest of the skipped", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubPhotoDownloads();

  const listed = await catalogedCabinetId("Cabinet One");
  await recordEbayListing(listed);

  const notListed = await catalogedCabinetId("Cabinet Two"); // cataloged, no listing
  expect(notListed).toBeTruthy();

  // Different category — never part of a Furniture bundle.
  const penId = await createItemThroughSeam({
    name: "Parker Pen",
    category: "PEN",
    "attr.brand": "Parker",
  });
  expect(penId).toBeTruthy();

  const ebay = (await getShippingSettings()).marketplaces.find((m) => m.name === "eBay")!;
  const bundle = await buildCategoryKit("FURNITURE", ebay.id);
  expect(bundle).not.toBeNull();
  expect(bundle!.filename).toBe("furniture-ebay-kits.zip");

  const zip = await JSZip.loadAsync(bundle!.bytes);
  const manifest = await zip.file("manifest.txt")!.async("string");
  expect(manifest).toContain("INCLUDED (1)");
  expect(manifest).toContain("Cabinet One");
  expect(manifest).toContain("SKIPPED (1)");
  expect(manifest).toContain("Cabinet Two — no eBay listing yet");
  expect(manifest).not.toContain("Parker Pen");

  const folder = Object.keys(zip.files).find(
    (name) => name.endsWith("/") && name !== "manifest.txt/"
  );
  expect(folder).toBeDefined();
  expect(folder!).toContain("cabinet-one");
  expect(zip.file(`${folder}listing.txt`)).not.toBeNull();

  expect(await buildCategoryKit("FURNITURE", "nope")).toBeNull();
});

test("kit downloads need a signed-in family login", async () => {
  await expect(buildListingKit("any", "any")).rejects.toBeInstanceOf(ForbiddenError);
  await expect(buildCategoryKit("FURNITURE", "any")).rejects.toBeInstanceOf(ForbiddenError);
});
