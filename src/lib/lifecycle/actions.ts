"use server";

import { revalidateItemPages } from "@/lib/revalidate";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { canTransition, exportGateBlocks, SKBCB_BLOCKED_MESSAGE } from "./lifecycle";
import {
  destroyItemPhoto,
  isPhotoStorageConfigured,
  photoVariantUrl,
  PhotoStorageError,
  photoUploadProblem,
  uploadCertificateScan,
  type StoredPhoto,
} from "@/lib/photos/cloudinary";
import type { ItemCategory, ItemState } from "@/generated/prisma/enums";

export type ActionState = { error: string | null };


// The selling steps of the lifecycle: Cataloged -> Listed -> Reserved ->
// Sold -> Shipped. Owner-only: offering, committing, and selling pieces is
// the Owner's role — a Cataloger must never record sales (GLOSSARY.md).
// `to` names the state being entered; the item must be in its one
// predecessor. Marking an item Cataloged is not done here — that transition
// belongs to the completeness-gated catalogItem action, and routing it
// through this form would bypass that check.
//
// Entering Listed follows the recorded Listings (ticket 06): the item must
// have at least one ACTIVE Listing, and the domestic-or-international
// distinction the export gate cares about is read off those Listings'
// Marketplaces — the offer record is the source of truth, not a form
// choice.
export async function transitionItem(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const to = String(formData.get("to") ?? "");

  if (to !== "LISTED" && to !== "RESERVED" && to !== "SOLD" && to !== "SHIPPED") {
    return { error: "Unknown lifecycle step." };
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  if (!canTransition(item.state, to as ItemState)) {
    return { error: `A ${item.state.toLowerCase()} item cannot be marked ${to.toLowerCase()}.` };
  }

  if (to === "LISTED") {
    const activeListings = await prisma.listing.findMany({
      where: { itemId, status: "ACTIVE" },
      include: { marketplace: true },
    });
    if (activeListings.length === 0) {
      return {
        error:
          "Record a listing on this item and mark it active first — an item is Listed when one of its offers is live.",
      };
    }
    const international = activeListings.some(
      (listing) => listing.marketplace.region === "INTERNATIONAL"
    );
    if (international && exportGateBlocks(item)) {
      return { error: SKBCB_BLOCKED_MESSAGE };
    }
  }

  await prisma.item.update({
    where: { id: itemId },
    data: { state: to as ItemState },
  });
  revalidateItemPages(itemId);
  return { error: null };
}

const MAX_CERTIFICATE_NUMBER_LENGTH = 100;

// Records Export Clearance evidence (GLOSSARY.md: SKBCB). The certificate
// number is required; a scan may follow on a later sitting — the gate stays
// closed until both are on record. A new scan replaces the stored one, and
// the replaced original is cleaned up on Cloudinary best effort.
export async function recordSkbcb(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const itemId = String(formData.get("itemId") ?? "");
  const certificateNumber = String(formData.get("certificateNumber") ?? "").trim();
  const scanEntry = formData.get("scan");
  const scan = scanEntry instanceof File && scanEntry.size > 0 ? scanEntry : null;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  if (certificateNumber === "") {
    return { error: "Enter the certificate number from the SKBCB letter." };
  }
  if (certificateNumber.length > MAX_CERTIFICATE_NUMBER_LENGTH) {
    return { error: "That certificate number looks too long — check it again." };
  }

  let storedScan: StoredPhoto | null = null;
  if (scan) {
    const problem = photoUploadProblem([scan]);
    if (problem) {
      return { error: problem };
    }
    if (!isPhotoStorageConfigured()) {
      return {
        error: "Photo storage is not configured yet — see README (Cloudinary).",
      };
    }
    try {
      storedScan = await uploadCertificateScan(scan);
    } catch (error) {
      return {
        error:
          error instanceof PhotoStorageError
            ? error.message
            : "Uploading the scan failed — please try again.",
      };
    }
  }

  await prisma.item.update({
    where: { id: itemId },
    data: {
      skbcbCertificateNumber: certificateNumber,
      ...(storedScan
        ? {
            skbcbScanPublicId: storedScan.publicId,
            skbcbScanFormat: storedScan.format,
          }
        : {}),
    },
  });

  if (storedScan && item.skbcbScanPublicId) {
    await destroyItemPhoto(item.skbcbScanPublicId);
  }

  revalidateItemPages(itemId);
  return { error: null };
}

// One row of the needs-clearance checklist: a 50+ flagged item whose SKBCB
// is not fully recorded (number and scan). Exists to drive BPCB/BPK
// assessment batches (spec: start early — the app tracks certificates, it
// cannot obtain them).
export type ClearanceNeededItem = {
  id: string;
  name: string;
  category: ItemCategory;
  state: ItemState;
  thumbnailUrl: string | null;
  hasCertificateNumber: boolean;
  hasScan: boolean;
};

export async function listNeedsClearance(): Promise<ClearanceNeededItem[]> {
  await requireUser();

  const items = await prisma.item.findMany({
    where: {
      fiftyYearsOld: true,
      OR: [{ skbcbCertificateNumber: null }, { skbcbScanPublicId: null }],
    },
    orderBy: { updatedAt: "desc" },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    state: item.state,
    thumbnailUrl: item.photos[0]
      ? photoVariantUrl(item.photos[0], "thumbnail")
      : null,
    hasCertificateNumber: item.skbcbCertificateNumber !== null,
    hasScan: item.skbcbScanPublicId !== null,
  }));
}
