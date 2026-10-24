import { revalidatePath } from "next/cache";

// Every mutation that touches an Item (or its satellites — photos,
// listings, certificates) refreshes the same three pages: the item's own
// page, the Catalog list, and the needs-clearance checklist (the 50+ flag
// and SKBCB visibility change with the record). Spelled once so a new
// action cannot forget a page.
export function revalidateItemPages(itemId: string) {
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
  revalidatePath("/clearance");
}
