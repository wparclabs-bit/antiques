import JSZip from "jszip";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getListings, type ListingView } from "@/lib/listings/actions";
import type { ItemCategory } from "@/generated/prisma/enums";

// Listing kits (ticket 06's noted v1 limitation, now built at the Owner's
// request 2026-10-25): everything a marketplace posting session needs, as
// one ZIP per listing — listing.txt (the copy-ready package: title,
// description, price, photo list) plus the photos as files, sized for that
// marketplace. Batches bundle one folder per item for a category ×
// marketplace, with a manifest saying what was included and what was
// skipped (and why). Marketplace posting happens on a PC; the phone keeps
// using copy + per-photo downloads.

export type KitZip = { filename: string; bytes: Buffer };

function slugItem(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item"
  );
}

// Bundle folders carry the listing's short id so two pieces with the same
// name never collide inside one zip.
function slug(name: string, uniqueHint: string): string {
  return `${slugItem(name)}-${uniqueHint.slice(0, 4)}`;
}

// The bytes behind one photo URL. Unauthenticated-by-design (unsigned
// Cloudinary variant URLs); null when the fetch fails — the manifest
// reports it rather than the whole download failing.
async function fetchPhoto(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

// One listing's materials as folder contents: the package text plus every
// photo file. The folder is named for the ITEM — in a bundle the
// marketplace is constant, so the family navigates by piece. Missing
// photos (storage unconfigured, or a fetch failed) become manifest
// notes, not broken entries.
async function addKitFolder(
  zip: JSZip,
  listing: ListingView,
  itemName: string
): Promise<string[]> {
  const problems: string[] = [];
  const folder = zip.folder(slug(itemName, listing.id))!;
  folder.file("listing.txt", listing.draft!.packageText);

  if (listing.draft!.photoUrls.length === 0) {
    problems.push(`${listing.marketplace.name} listing has no photos`);
  }
  for (const [index, url] of listing.draft!.photoUrls.entries()) {
    const name = `photo-${index + 1}.jpg`;
    if (url === null) {
      problems.push(`${name}: photo URL unavailable — Cloudinary not configured`);
      continue;
    }
    const bytes = await fetchPhoto(url);
    if (bytes === null) {
      problems.push(`${name}: could not be downloaded from photo storage`);
      continue;
    }
    folder.file(name, bytes);
  }
  return problems;
}

// The single-listing kit behind the item page's Download button. Null when
// the listing does not exist, is not on this item, or has ended — the
// route turns that into a 404.
export async function buildListingKit(
  itemId: string,
  listingId: string
): Promise<KitZip | null> {
  await requireUser();

  const view = await getListings(itemId);
  if (!view) return null;
  const listing = view.listings.find(
    (candidate) => candidate.id === listingId && candidate.status !== "ENDED"
  );
  if (!listing || listing.draft === null) return null;

  const zip = new JSZip();
  await addKitFolder(zip, listing, view.item.name);
  return {
    filename: `${slugItem(view.item.name)}-${listing.marketplace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.zip`,
    bytes: await zip.generateAsync({ type: "nodebuffer" }),
  };
}

// The category × marketplace bundle behind the Export page: one folder per
// item that has a non-ended listing on that marketplace, plus a manifest
// recording skipped items (cataloged pieces with no listing there yet) and
// any photo problems.
export async function buildCategoryKit(
  category: ItemCategory,
  marketplaceId: string
): Promise<KitZip | null> {
  await requireUser();

  const marketplace = await prisma.marketplace.findUnique({
    where: { id: marketplaceId },
  });
  if (!marketplace) return null;

  const items = await prisma.item.findMany({
    where: { category },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const zip = new JSZip();
  const included: string[] = [];
  const skipped: string[] = [];
  const problems: string[] = [];

  for (const item of items) {
    const view = await getListings(item.id);
    const listing = view?.listings.find(
      (candidate) =>
        candidate.marketplace.id === marketplaceId &&
        candidate.status !== "ENDED"
    );
    if (!view || !listing || listing.draft === null) {
      skipped.push(`${item.name} — no ${marketplace.name} listing yet`);
      continue;
    }
    included.push(item.name);
    problems.push(...(await addKitFolder(zip, listing, item.name)));
  }

  const manifest = [
    `INCLUDED (${included.length})`,
    ...included.map((name) => `  ${name}`),
    "",
    `SKIPPED (${skipped.length})`,
    ...skipped,
    "",
    `NOTES (${problems.length})`,
    ...problems,
    "",
    "Each folder holds listing.txt (title, description, price, photo list)",
    `with photos sized for ${marketplace.name}.`,
  ].join("\n");
  zip.file("manifest.txt", manifest);

  return {
    filename: `${category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${marketplace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-kits.zip`,
    bytes: await zip.generateAsync({ type: "nodebuffer" }),
  };
}
