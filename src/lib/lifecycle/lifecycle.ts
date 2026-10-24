import type { ItemState } from "@/generated/prisma/enums";

// The item lifecycle (GLOSSARY.md), in order:
//   Draft -> Cataloged -> Listed -> Reserved -> Sold -> Shipped
// Each state has exactly one successor and there is no going back — the
// record reflects what physically happened to the piece. Draft -> Cataloged
// has its own completeness-gated action (catalogItem); transitionItem guards
// everything after it. Anything not listed here is rejected on the server.
const ALLOWED_TRANSITIONS: Partial<Record<ItemState, ItemState[]>> = {
  DRAFT: ["CATALOGED"],
  CATALOGED: ["LISTED"],
  LISTED: ["RESERVED"],
  RESERVED: ["SOLD"],
  SOLD: ["SHIPPED"],
};

export function canTransition(from: ItemState, to: ItemState): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// The export-compliance gate (ADR-0002): Indonesian law treats any object
// 50+ years old as suspected cultural property, so a flagged item may not be
// offered internationally until its SKBCB certificate is on record — number
// and scan together, because clearance must be provable at shipping time.
// Domestic channels are unaffected: the certificate concerns export only.
export function exportGateBlocks(item: {
  fiftyYearsOld: boolean;
  skbcbCertificateNumber: string | null;
  skbcbScanPublicId: string | null;
}): boolean {
  if (!item.fiftyYearsOld) return false;
  return item.skbcbCertificateNumber === null || item.skbcbScanPublicId === null;
}
