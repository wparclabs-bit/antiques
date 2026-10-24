"use server";

import { redirect } from "next/navigation";
import { revalidateItemPages } from "@/lib/revalidate";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { validateItemForm, missingForCataloged } from "./validation";
import { canTransition, INVENTORY_EXCLUDED_STATES } from "@/lib/lifecycle/lifecycle";
import {
  destroyItemPhoto,
  isPhotoStorageConfigured,
  MAX_PHOTOS_PER_ITEM,
  PhotoStorageError,
  photoUploadProblem,
  photoVariantUrl,
  uploadItemPhoto,
  type StoredPhoto,
} from "@/lib/photos/cloudinary";
import type { ItemCategory, ItemState } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// Form actions return this so the page can show what went wrong.
export type ItemFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export type ActionState = { error: string | null };

// What the catalog list shows for one Item. Cost and sale fields are
// family finance — visible to every signed-in family login (ADR-0003).
export type ItemListItem = {
  id: string;
  name: string;
  category: ItemCategory;
  state: ItemState;
  fiftyYearsOld: boolean;
  photoCount: number;
  thumbnailUrl: string | null;
  costBasisIdr: number | null;
  // The recorded sale (ticket 07), shown on Catalog cards so the family's
  // own sold prices are visible at a glance.
  sale: { price: number; currency: string; marketplaceName: string } | null;
};

// Export Clearance status (GLOSSARY.md: SKBCB) — the certificate number and
// whether a scan is stored. `scanUrl` is null when photo storage is not
// configured, which says nothing about whether a scan exists: `hasScan` is
// the truth, the URL is only for display.
export type SkbcbStatus = {
  certificateNumber: string | null;
  hasScan: boolean;
  scanUrl: string | null;
};

export type ItemDetail = {
  id: string;
  name: string;
  category: ItemCategory;
  state: ItemState;
  fiftyYearsOld: boolean;
  conditionNotes: string | null;
  provenance: string | null;
  costBasisIdr: number | null;
  attributes: Record<string, string | number>;
  photos: { id: string; url: string | null; position: number }[];
  skbcb: SkbcbStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ItemFilters = {
  q?: string;
  category?: ItemCategory;
  state?: ItemState;
  view?: "catalog" | "inventory";
};

function itemAttributes(item: { attributes: Prisma.JsonValue }) {
  return (item.attributes ?? {}) as Record<string, string | number>;
}

// Every mutating action refreshes the item page and the catalog list. The
// clearance checklist is included because catalog writes can change the
// 50+ flag and SKBCB visibility changes with it.

function attachedPhotos(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

// Upload first, create nothing on failure — a half-recorded item with
// missing photos is worse than an error the family can retry.
async function uploadPhotos(
  files: File[]
): Promise<{ stored: StoredPhoto[]; problem: string | null }> {
  const problem = photoUploadProblem(files);
  if (problem) return { stored: [], problem };

  if (files.length > 0 && !isPhotoStorageConfigured()) {
    return {
      stored: [],
      problem:
        "Photo storage is not configured yet — see README (Cloudinary).",
    };
  }

  try {
    const stored = await Promise.all(files.map((file) => uploadItemPhoto(file)));
    return { stored, problem: null };
  } catch (error) {
    // Surface Cloudinary's own message when we have it; hide raw network
    // noise behind the retry line.
    return {
      stored: [],
      problem:
        error instanceof PhotoStorageError
          ? error.message
          : "Uploading photos failed — please try again.",
    };
  }
}

// Cost basis is family finance: every signed-in family login may set it
// and see it. The signed-in check happens here on the server, like every
// action in the app.
const MAX_COST_BASIS_IDR = 2_000_000_000; // comfortably below Postgres int max

export async function setCostBasis(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const raw = String(formData.get("costBasisIdr") ?? "").trim();

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  if (raw === "") {
    await prisma.item.update({
      where: { id: itemId },
      data: { costBasisIdr: null },
    });
    revalidateItemPages(itemId);
    return { error: null };
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return {
      error: "Enter the cost as a whole number of rupiah — 0 is allowed.",
    };
  }
  if (value > MAX_COST_BASIS_IDR) {
    return { error: "That amount is too large." };
  }

  await prisma.item.update({
    where: { id: itemId },
    data: { costBasisIdr: value },
  });
  revalidateItemPages(itemId);
  return { error: null };
}

// The Draft -> Cataloged step. A Draft may be as partial as the family's
// knowledge; this action is the gate that demands the complete record
// before the Item counts as Cataloged.
export async function catalogItem(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { _count: { select: { photos: true } } },
  });
  if (!item) {
    return { error: "Item not found." };
  }

  if (!canTransition(item.state, "CATALOGED")) {
    return {
      error: `Only a Draft can be marked Cataloged — this one is ${item.state}.`,
    };
  }

  const missing = missingForCataloged({
    category: item.category,
    attributes: itemAttributes(item),
    photoCount: item._count.photos,
  });
  if (missing.length > 0) {
    return {
      error: `Still needed before this can be Cataloged: ${missing.join(", ")}.`,
    };
  }

  // The state and its history row commit together, so the two cannot drift
  // apart (ticket 07).
  await prisma.$transaction([
    prisma.item.update({
      where: { id: itemId },
      data: { state: "CATALOGED" },
    }),
    prisma.lifecycleEvent.create({
      data: { itemId, state: "CATALOGED" },
    }),
  ]);
  revalidateItemPages(itemId);
  return { error: null };
}

export async function createItem(
  _prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  await requireUser();

  const validated = validateItemForm(formData);
  if (!validated.ok) {
    return { error: "Some fields need attention.", fieldErrors: validated.fieldErrors };
  }

  const { stored: storedPhotos, problem: photoProblem } = await uploadPhotos(
    attachedPhotos(formData)
  );
  if (photoProblem) {
    return { error: "Some fields need attention.", fieldErrors: { photos: photoProblem } };
  }

  const item = await prisma.item.create({
    data: {
      name: validated.values.name,
      category: validated.values.category,
      fiftyYearsOld: validated.values.fiftyYearsOld,
      conditionNotes: validated.values.conditionNotes,
      provenance: validated.values.provenance,
      attributes: validated.values.attributes,
      // The lifecycle history starts at birth (ticket 07): recorded as a
      // Draft on the day the record was made.
      lifecycleEvents: {
        create: { state: "DRAFT" },
      },
      photos: {
        create: storedPhotos.map((photo, index) => ({
          publicId: photo.publicId,
          format: photo.format,
          width: photo.width,
          height: photo.height,
          position: index + 1,
        })),
      },
    },
  });

  revalidateItemPages(item.id);
  redirect(`/items/${item.id}`);
}

// Photos can keep arriving after the record exists — the family catalogs in
// many sittings, camera in hand.
export async function addPhotos(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { _count: { select: { photos: true } } },
  });
  if (!item) {
    return { error: "Item not found." };
  }

  const files = attachedPhotos(formData);
  if (files.length === 0) {
    return { error: "Choose at least one photo to upload." };
  }

  // An Item keeps at most ten photos, across all sittings.
  const remaining = MAX_PHOTOS_PER_ITEM - item._count.photos;
  if (remaining <= 0) {
    return { error: "This item already has 10 photos — remove one before adding another." };
  }
  if (files.length > remaining) {
    return {
      error: `An item can have up to 10 photos — only ${remaining} more fit on this one.`,
    };
  }

  const { stored, problem } = await uploadPhotos(files);
  if (problem) {
    return { error: problem };
  }

  const firstPosition = item._count.photos + 1;
  await prisma.photo.createMany({
    data: stored.map((photo, index) => ({
      itemId,
      publicId: photo.publicId,
      format: photo.format,
      width: photo.width,
      height: photo.height,
      position: firstPosition + index,
    })),
  });

  revalidateItemPages(itemId);
  return { error: null };
}

export async function removePhoto(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const photoId = String(formData.get("photoId") ?? "");
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) {
    return { error: "Photo not found." };
  }

  await prisma.photo.delete({ where: { id: photoId } });
  await destroyItemPhoto(photo.publicId);

  revalidateItemPages(photo.itemId);
  return { error: null };
}

// Editing the record. Cost basis is deliberately absent: it lives behind
// setCostBasis, so item edits never touch it.
export async function updateItem(
  _prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const validated = validateItemForm(formData);
  if (!validated.ok) {
    return { error: "Some fields need attention.", fieldErrors: validated.fieldErrors };
  }

  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Item not found.", fieldErrors: {} };
  }

  // Attributes are replaced wholesale: they follow the (possibly changed)
  // category template, and the edit form always prefills every template
  // field — so nothing the family entered can silently vanish.
  await prisma.item.update({
    where: { id },
    data: {
      name: validated.values.name,
      category: validated.values.category,
      fiftyYearsOld: validated.values.fiftyYearsOld,
      conditionNotes: validated.values.conditionNotes,
      provenance: validated.values.provenance,
      attributes: validated.values.attributes,
    },
  });

  revalidateItemPages(id);
  redirect(`/items/${id}`);
}

export async function getItem(id: string): Promise<ItemDetail | null> {
  await requireUser();

  const item = await prisma.item.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" } } },
  });
  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    state: item.state,
    fiftyYearsOld: item.fiftyYearsOld,
    conditionNotes: item.conditionNotes,
    provenance: item.provenance,
    costBasisIdr: item.costBasisIdr,
    attributes: itemAttributes(item),
    photos: item.photos.map((photo) => ({
      id: photo.id,
      url: photoVariantUrl(photo, "display"),
      position: photo.position,
    })),
    skbcb: {
      certificateNumber: item.skbcbCertificateNumber,
      hasScan: item.skbcbScanPublicId !== null,
      scanUrl:
        item.skbcbScanPublicId && item.skbcbScanFormat
          ? photoVariantUrl(
              { publicId: item.skbcbScanPublicId, format: item.skbcbScanFormat },
              "display"
            )
          : null,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function listItems(
  filters: ItemFilters = {}
): Promise<ItemListItem[]> {
  await requireUser();

  const where: Prisma.ItemWhereInput = {};
  const q = filters.q?.trim();
  if (q) {
    // A keyword matches anywhere the family would look for it: the name,
    // the category attributes (brand, material, artist…), condition notes,
    // and provenance.
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { attributes: { string_contains: q } },
      { conditionNotes: { contains: q, mode: "insensitive" } },
      { provenance: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.category) {
    where.category = filters.category;
  }

  // State and view combine: e.g. Inventory + Draft means "draft items we
  // still own" (an AND — a Sold item is out of Inventory no matter what).
  const stateFilter: Prisma.EnumItemStateFilter = {};
  if (filters.state) {
    stateFilter.equals = filters.state;
  }
  if (filters.view === "inventory") {
    // Inventory = what the family still owns (one definition, lifecycle.ts).
    stateFilter.notIn = INVENTORY_EXCLUDED_STATES;
  }
  if (stateFilter.equals !== undefined || stateFilter.notIn !== undefined) {
    where.state = stateFilter;
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { photos: true } },
      photos: { orderBy: { position: "asc" }, take: 1 },
      sale: { include: { marketplace: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    state: item.state,
    fiftyYearsOld: item.fiftyYearsOld,
    photoCount: item._count.photos,
    thumbnailUrl: item.photos[0]
      ? photoVariantUrl(item.photos[0], "thumbnail")
      : null,
    costBasisIdr: item.costBasisIdr,
    sale: item.sale
      ? {
            price: Number(item.sale.price),
            currency: item.sale.currency,
            marketplaceName: item.sale.marketplace.name,
          }
        : null,
  }));
}
