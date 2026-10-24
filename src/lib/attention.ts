import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { missingForCataloged } from "@/lib/catalog/validation";
import { INVENTORY_EXCLUDED_STATES } from "@/lib/lifecycle/lifecycle";
import type { ItemState } from "@/generated/prisma/enums";

// The home page's derived attention rows and stage-chip counts (ticket 10,
// the Ledger home). Nothing here is a task engine: every row is a count
// over records the family already made, and every link is a plain filter
// into the Catalog. Rows with nothing to show simply count zero and the
// page leaves them out.

export type AttentionRow = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export async function getAttentionRows(): Promise<AttentionRow[]> {
  await requireUser();

  // 1. Drafts with photos but incomplete records — a capture that was
  //    started and never finished. Completeness follows the same Catalog
  //    gate the item page shows.
  const drafts = await prisma.item.findMany({
    where: { state: "DRAFT", photos: { some: {} } },
    select: { category: true, attributes: true, _count: { select: { photos: true } } },
  });
  const draftsMissingDetails = drafts.filter((draft) =>
    missingForCataloged({
      category: draft.category,
      attributes: (draft.attributes ?? {}) as Record<string, string | number>,
      photoCount: draft._count.photos,
    }).some((missing) => missing.toLowerCase() !== "at least one photo")
  ).length;

  const [
    catalogedNeverListed,
    listedNeverMarketed,
    reservedNotSold,
  ] = await Promise.all([
    // 2. Cataloged but never put on any marketplace — even a planned
    //    offer means the piece has been prepared for a channel.
    prisma.item.count({
      where: { state: "CATALOGED", listings: { none: {} } },
    }),
    // 3. Standing in Listed with nothing recorded as posted anywhere —
    //    the marketing gap. Stage-derived, like every row, so the row's
    //    link (the LISTED filter) shows exactly the counted pieces.
    prisma.item.count({
      where: { state: "LISTED", socialPosts: { none: {} } },
    }),
    // 4. Verbally committed but not yet marked Sold.
    prisma.item.count({ where: { state: "RESERVED" } }),
  ]);

  return [
    {
      key: "drafts-missing-details",
      label: "drafts have photos but their record is incomplete",
      count: draftsMissingDetails,
      href: "/?state=DRAFT",
    },
    {
      key: "cataloged-never-listed",
      label: "cataloged items have never been put on a marketplace",
      count: catalogedNeverListed,
      href: "/?state=CATALOGED",
    },
    {
      key: "listed-never-marketed",
      label: "listed items have never been recorded as posted anywhere",
      count: listedNeverMarketed,
      href: "/?state=LISTED",
    },
    {
      key: "reserved-not-sold",
      label: "reserved item is waiting to be marked sold",
      count: reservedNotSold,
      href: "/?state=RESERVED",
    },
  ].filter((row) => row.count > 0);
}

// Per-state counts for the stage chips, honoring the view: Inventory is
// the Catalog minus Sold and Shipped, so its chips never show those two.
export async function getStateCounts(
  view: "catalog" | "inventory"
): Promise<Record<ItemState, number>> {
  await requireUser();

  const rows = await prisma.item.groupBy({
    by: ["state"],
    _count: { _all: true },
  });
  const counts: Record<ItemState, number> = {
    DRAFT: 0,
    CATALOGED: 0,
    LISTED: 0,
    RESERVED: 0,
    SOLD: 0,
    SHIPPED: 0,
  };
  for (const row of rows) {
    counts[row.state] = row._count._all;
  }
  if (view === "inventory") {
    for (const state of INVENTORY_EXCLUDED_STATES) {
      counts[state] = 0;
    }
  }
  return counts;
}
