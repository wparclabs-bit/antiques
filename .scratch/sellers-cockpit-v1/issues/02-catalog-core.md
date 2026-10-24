# 02: Catalog core

**What to build:** Recording an Item end-to-end: an entry form that asks the right attributes for each of the six categories (including manual measurements), photo upload from the phone browser camera with auto-resized marketplace variants, the 50+ years flag (defaulting to yes), condition and provenance, cost basis in IDR visible to the Owner only, the Draft → Cataloged step, and finding any Item again via search, filters, and the Catalog vs Inventory views.

**Blocked by:** 01 (scaffold, roles, test harness).

**Status:** ready-for-human

- [x] An Item can be created in any of the six categories (Furniture, Ceramics & Porcelain, Art & Paintings, Books, Watch, Pen) and the form asks that category's attribute schema including measurement fields
- [x] Photos upload from an Android browser camera and are stored with auto-derived marketplace-sized variants
- [x] The 50+ years flag defaults to yes; condition notes and provenance are captured
- [x] Cost basis in IDR is visible to the Owner only, enforced on the server
- [x] Incomplete Items rest as Draft; completing the record moves them to Cataloged
- [x] The Catalog can be searched and filtered by keyword, category, and lifecycle state; Inventory (currently owned) is viewable separately from the full Catalog
- [x] Seam tests cover Item creation per category template, the role restriction on cost basis, and search/filter behaviour

## Comments

**2026-10-24 (agent):** Implemented on `main` (single commit; see git log "Ticket 02: catalog core").

- **Category templates**: one definition file (`src/lib/catalog/categories.ts`) drives the entry form, server-side validation, and the item detail page, so the three cannot drift. Each template includes manual measurement fields with units; four field types (text / number / select) with per-category required flags.
- **Photos**: one original per photo stored in Cloudinary (signed server-side upload); marketplace variants are *derived URLs* of that original (thumb 400 / display 1200 / eBay 1600 / Etsy 2000) — nothing resized or duplicated. The browser downscales picks to 1600 px JPEG before submit (`src/app/items/resize-photos.ts`), which keeps request bodies inside the Server Action limit locally and Vercel's ~4.5 MB limit in production. Cloudinary is configured via three env vars (README); until then items save fine and photo attach shows a clear error.
- **Cost basis**: `setCostBasis` requires the Owner role server-side; the read actions (`getItem`, `listItems`) only select it for Owners — a Cataloger never receives the value, not just doesn't see it. Editing an item can never touch it (the field is absent from `updateItem`).
- **Lifecycle**: `lifecycle.ts` holds the transition table; only `DRAFT → CATALOGED` exists in v1. `catalogItem` checks completeness (required template fields + at least one photo) and lists what's missing in the error. **Interpretations for the Owner to confirm:** (1) required-ness is enforced at the Draft→Cataloged gate, not at creation — a Draft may save with gaps (spec story 10: "many sittings"); (2) photos are required before Cataloged (an antique record without a photo seemed incomplete — easy to relax); (3) condition/provenance are captured but not required to Catalog; (4) any signed-in role may mark Cataloged (the spec restricts Catalogers only on cost/sales/settings).
- **Search/filters**: keyword matches name, attribute values, condition notes, and provenance (case-insensitive); filters by category and state combine; Inventory = Catalog minus Sold/Shipped, all enforced in `listItems`.
- **Tests**: 40 passing (9 auth + 31 catalog) through the Server Actions seam against the real test DB. Only mocks: Next.js transport (shared `src/test/browser-transport.ts`) and the Cloudinary HTTP endpoint (stubbed `fetch`, documented response shapes). Suites run sequentially (`fileParallelism: false`) — they share one database.
- Also fixed a Next 16 dev-only prerender error (`new Date()` in the session expiry check) by declaring the dynamic boundary with `connection()` in `getSessionUser`; typecheck, lint, and build clean; pages smoke-tested against the production build with real sessions for both roles.

**Remaining for the human:** nothing code-side. Follow README "Deploy" once Vercel/Neon/Cloudinary accounts exist (Cloudinary is a new step for this ticket).

**2026-10-24 (agent):** Accepted by the Owner. Deployed to https://antiques-nine.vercel.app; the Owner signed in on an Android phone, recorded an item with a camera photo end-to-end, and confirmed it works ("Done"). Follow-up requests shipped in commit 1703aa9: an **Other** category for pieces outside the six main ones (full user-defined categories remain a possible future ticket), and **10 photos per item** (server-enforced; bigger batches compressed harder in the browser). The photo-upload failure the Owner hit on first try was a wrong Cloudinary API secret (credentials, not code); errors now surface Cloudinary's own message. Cloudinary secret corrected on file with Vercel.
