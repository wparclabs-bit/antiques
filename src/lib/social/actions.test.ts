import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Social marketing seam tests (ticket 08). Same policy as the other suites:
// only Next.js runtime transport is mocked (shared via
// src/test/browser-transport); the Server Actions under test and the
// database are real. Social drafts ride on Listings, so their content is
// read through the same seam as the marketplace drafts (getListings) and
// asserted golden — exact strings — so the platform formats cannot drift
// silently. Posting-log tests drive recordSocialPost / getSocialPosts.
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
import { catalogItem, createItem, listItems, type ItemFormState } from "@/lib/catalog/actions";
import { getShippingSettings } from "@/lib/shipping/actions";
import { recordListing, getListings } from "@/lib/listings/actions";
import {
  getSocialPosts,
  recordSocialPost,
  removeSocialPost,
} from "@/lib/social/actions";

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
    `TRUNCATE TABLE "User", "Session", "Item", "Photo", "Comparable", "Valuation", "ForwarderRate", "Marketplace", "PricingSetting", "Listing", "SocialPost" CASCADE`
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

// Records one listing on `marketplaceName` and returns the item id. The
// currency follows the channel (IDR at home, the FX currency abroad).
async function listedOn(
  itemId: string,
  marketplaceName: string,
  price = "1250.00"
): Promise<string> {
  const marketplace = (await marketplaces()).find((m) => m.name === marketplaceName)!;
  const currency = marketplace.region === "DOMESTIC" ? "IDR" : "USD";
  const result = await recordListing(
    { error: null },
    form({ itemId, marketplaceId: marketplace.id, price, currency })
  );
  if (result.error) throw new Error(`fixture listing not recorded: ${result.error}`);
  return itemId;
}

function configurePhotoStorage() {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
}

const url = (variant: 1200 | 1600 | 2000, n: number) =>
  `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_${variant},h_${variant}/antiques/items/f-${n}.jpg`;

// ---------------------------------------------------------------------------
// Social drafts — golden-format assertions. The exact strings below ARE the
// social formats: an Instagram caption (one-line opening, price line, the
// item's own details, a call to action, hashtags) built from the Item and
// its Listing; an Instagram story text kept to three short lines; a
// Facebook post with the same pieces and a Facebook-appropriate call to
// action. Photos copy at display size — social platforms take the app's
// own views, not a marketplace's sized bundle.
// ---------------------------------------------------------------------------

test("an Instagram caption with hashtags is generated from the Listing — golden format", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  await listedOn(itemId, "eBay");

  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.instagramCaption.text).toBe(
    `Jati Teak Cabinet — Furniture. Teak, Colonial, Early 20th century.

Offered at $1,250.00 on eBay.

Details:
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
From grandmother's house in Bandung.

Interested? Message us — the listing is on eBay.

#antique #vintage #forsale #furniture #antiquefurniture #teak #colonial #early20thcentury`
  );

  // Copy-ready in one action: the caption plus the photo bundle a post
  // needs, as one text block.
  expect(social.instagramCaption.copyText).toBe(`CAPTION
Jati Teak Cabinet — Furniture. Teak, Colonial, Early 20th century.

Offered at $1,250.00 on eBay.

Details:
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
From grandmother's house in Bandung.

Interested? Message us — the listing is on eBay.

#antique #vintage #forsale #furniture #antiquefurniture #teak #colonial #early20thcentury

PHOTOS — 2 for Instagram (1200px)
${url(1200, 1)}
${url(1200, 2)}`);
});

test("an Instagram story text stays to three short lines — golden format", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  await listedOn(itemId, "eBay");

  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.instagramStory.text).toBe(
    `Jati Teak Cabinet
Teak · Colonial · Early 20th century
$1,250.00 on eBay`
  );
  expect(social.instagramStory.copyText).toBe(`TEXT
Jati Teak Cabinet
Teak · Colonial · Early 20th century
$1,250.00 on eBay

PHOTOS — 2 for Instagram (1200px)
${url(1200, 1)}
${url(1200, 2)}`);
});

test("a Facebook post assembles the same pieces with a link-carrying call to action — golden format", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const itemId = await catalogedCabinetId();
  await listedOn(itemId, "eBay");

  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.facebookPost.text).toBe(
    `Jati Teak Cabinet — Furniture. Teak, Colonial, Early 20th century.

Offered at $1,250.00 on eBay.

Details:
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
From grandmother's house in Bandung.

Interested? Message us here or on eBay.`
  );
  expect(social.facebookPost.copyText).toBe(`POST
Jati Teak Cabinet — Furniture. Teak, Colonial, Early 20th century.

Offered at $1,250.00 on eBay.

Details:
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
From grandmother's house in Bandung.

Interested? Message us here or on eBay.

PHOTOS — 2 for Facebook (1200px)
${url(1200, 1)}
${url(1200, 2)}`);
});

test("each platform's drafts carry the listing's own price and marketplace", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  await listedOn(itemId, "Tokopedia", "15000000");

  // The social drafts are assembled from the Item and ITS Listing (ticket
  // 08) — a Tokopedia listing drafts in rupiah, not the FX currency.
  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.instagramStory.text).toBe(
    `Jati Teak Cabinet
Teak · Colonial · Early 20th century
IDR 15,000,000 on Tokopedia`
  );
  expect(social.facebookPost.text).toContain("Offered at IDR 15,000,000 on Tokopedia.");
});

test("a minimal record drops the sections it has nothing for — no style, no age line, no condition", async () => {
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
  await listedOn(itemId, "eBay", "120.00");

  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.instagramCaption.text).toBe(
    `Small Teak Stool — Furniture. Teak.

Offered at $120.00 on eBay.

Details:
- Wood / material: Teak
- Height: 45 cm
- Width: 40 cm
- Depth: 40 cm

Interested? Message us — the listing is on eBay.

#antique #vintage #forsale #furniture #antiquefurniture #teak`
  );
  expect(social.instagramStory.text).toBe(
    `Small Teak Stool
Teak
$120.00 on eBay`
  );
});

test("hashtags come from the category when no identifying values exist", async () => {
  await signInAsOwner();
  const itemId = await createItemThroughSeam({
    name: "Kendi Vessel",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "25",
    "attr.diameterCm": "18",
    "attr.weightKg": "1.2",
  });
  await giveItemPhotos(itemId, 1);
  await listedOn(itemId, "eBay", "100.00");

  // Ceramics & Porcelain is a two-word label: word tags without the
  // antique compound, and no identifying values to squash.
  const social = (await getListings(itemId))!.listings[0].social!;
  expect(social.instagramCaption.text).toBe(
    `Kendi Vessel — Ceramics & Porcelain.

Offered at $100.00 on eBay.

Details:
- Height: 25 cm
- Diameter: 18 cm
- Weight: 1.2 kg

Age: 50+ years old

Interested? Message us — the listing is on eBay.

#antique #vintage #forsale #ceramics #porcelain`
  );
  // No identifying summary: the story drops its middle line entirely.
  expect(social.instagramStory.text).toBe(
    `Kendi Vessel
$100.00 on eBay`
  );
});

test("an ended listing carries no social drafts, like its marketplace package", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  await listedOn(itemId, "Tokopedia", "15000000");
  const listing = (await getListings(itemId))!.listings[0];
  const { setListingStatus } = await import("@/lib/listings/actions");
  const ended = await setListingStatus(
    { error: null },
    form({ listingId: listing.id, to: "ENDED" })
  );
  expect(ended.error).toBeNull();

  const view = (await getListings(itemId))!.listings[0];
  expect(view.status).toBe("ENDED");
  expect(view.draft).toBeNull();
  expect(view.social).toBeNull();
});

// ---------------------------------------------------------------------------
// The Posting Log (ticket 08): where and when each Item was posted, so the
// family's marketing effort is visible and never repeated by accident.
// The platform is whatever the family actually posted to — the drafted
// platforms are suggestions, not a whitelist.
// ---------------------------------------------------------------------------

test("posting log entries are recorded with platform, date, link, and notes, and read back newest first", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();

  const first = await recordSocialPost(
    { error: null },
    form({
      itemId,
      platform: "Instagram",
      postedOn: "2026-10-24",
      url: "https://instagram.com/p/abc123",
      notes: "Morning post, three photos.",
    })
  );
  expect(first.error).toBeNull();

  const second = await recordSocialPost(
    { error: null },
    form({
      itemId,
      platform: "Facebook",
      postedOn: "2026-10-20",
      notes: "Family page only.",
    })
  );
  expect(second.error).toBeNull();

  // A platform the form does not suggest is still a platform the family
  // can have posted to.
  const other = await recordSocialPost(
    { error: null },
    form({
      itemId,
      platform: "OTHER",
      platformOther: "WhatsApp Status",
      postedOn: "2026-10-22",
    })
  );
  expect(other.error).toBeNull();

  const history = await getSocialPosts(itemId);
  expect(history).not.toBeNull();
  expect(history!.map((entry) => entry.platform)).toEqual([
    "Instagram",
    "WhatsApp Status",
    "Facebook",
  ]);
  expect(history![0].postedOn).toEqual(new Date("2026-10-24T00:00:00.000Z"));
  expect(history![0].url).toBe("https://instagram.com/p/abc123");
  expect(history![0].notes).toBe("Morning post, three photos.");
  expect(history![1].url).toBeNull();
  expect(history![1].notes).toBeNull();
  expect(history![2].url).toBeNull();
  expect(history![2].notes).toBe("Family page only.");

  // Two posts on the same day: the one recorded later reads first, so the
  // log still shows the family's most recent marketing action on top.
  const again = await recordSocialPost(
    { error: null },
    form({ itemId, platform: "Instagram Story", postedOn: "2026-10-24" })
  );
  expect(again.error).toBeNull();
  const relogged = await getSocialPosts(itemId);
  expect(relogged!.map((entry) => entry.platform)).toEqual([
    "Instagram Story",
    "Instagram",
    "WhatsApp Status",
    "Facebook",
  ]);
});

test("recording rejects a missing platform, a nonsense or future date, a bad link, and an unknown item — and stores nothing", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();

  const badInputs: Record<string, string>[] = [
    { platform: "" },
    { platform: "OTHER", platformOther: "   " },
    { postedOn: "" },
    { postedOn: "10/24/2026" },
    { postedOn: "2030-01-01" },
    { url: "instagram.com/p/abc123" },
    { url: "https://" },
  ];
  for (const overrides of badInputs) {
    const bad = await recordSocialPost(
      { error: null },
      form({
        itemId,
        platform: "Instagram",
        postedOn: "2026-10-24",
        ...overrides,
      })
    );
    expect(bad.error, JSON.stringify(overrides)).toBeTruthy();
  }

  const unknownItem = await recordSocialPost(
    { error: null },
    form({ itemId: "nope", platform: "Instagram", postedOn: "2026-10-24" })
  );
  expect(unknownItem.error).toBeTruthy();

  expect(await getSocialPosts(itemId)).toEqual([]);
});

test("a log entry can be removed — a mistyped entry must not stay forever", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  await recordSocialPost(
    { error: null },
    form({ itemId, platform: "Facebook", postedOn: "2026-10-20" })
  );

  const [entry] = (await getSocialPosts(itemId))!;
  const removed = await removeSocialPost(
    { error: null },
    form({ postId: entry.id })
  );
  expect(removed.error).toBeNull();
  expect(await getSocialPosts(itemId)).toEqual([]);

  const missing = await removeSocialPost(
    { error: null },
    form({ postId: "nope" })
  );
  expect(missing.error).toBeTruthy();
});

test("the posting log is the Owner's: a Cataloger can neither record, remove, nor read it", async () => {
  await signInAsOwner();
  const itemId = await catalogedCabinetId();
  await recordSocialPost(
    { error: null },
    form({ itemId, platform: "Instagram", postedOn: "2026-10-24" })
  );

  cookieStore.clear();
  await signInAsCataloger();

  expect(await getSocialPosts(itemId)).toBeNull();
  await expect(
    recordSocialPost(
      { error: null },
      form({ itemId, platform: "Instagram", postedOn: "2026-10-24" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(
    removeSocialPost({ error: null }, form({ postId: "any" }))
  ).rejects.toBeInstanceOf(ForbiddenError);

  cookieStore.clear();
  await expect(getSocialPosts(itemId)).rejects.toBeInstanceOf(ForbiddenError);
});
