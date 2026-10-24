import type { ItemState } from "@/generated/prisma/enums";

// The item lifecycle (GLOSSARY.md), in order:
//   Draft -> Cataloged -> Listed -> Reserved -> Sold -> Shipped
// Ticket 02 implements only Draft -> Cataloged; the later transitions and
// the export-compliance gate arrive with the lifecycle ticket. Anything not
// listed here is rejected on the server.
const ALLOWED_TRANSITIONS: Partial<Record<ItemState, ItemState[]>> = {
  DRAFT: ["CATALOGED"],
};

export function canTransition(from: ItemState, to: ItemState): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
