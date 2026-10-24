# 06: Listing Drafts

**What to build:** The copy-paste selling package: Listings recorded against an Item (Marketplace, price, currency, status — one Item can be offered on several channels), and the draft generator that assembles a marketplace-formatted package — title, description built from the Item's attributes (materials, dimensions, age, condition, provenance), photos, and price — for eBay and Etsy, copyable with its sized photo bundle in one action, with the Price Floor shown beside the intended price.

**Blocked by:** 03 (price evidence), 04 (gate must guard the Listed transition), 05 (Price Floor).

**Status:** ready-for-agent

- [x] Listings can be recorded against an Item: Marketplace, price with currency, status
- [x] The draft generator produces an eBay-formatted package and an Etsy-formatted package: title, description assembled from Item attributes, photos, price
- [x] The package is copy-ready in one action, including the photo bundle sized to each marketplace's conventions
- [x] The Price Floor is displayed beside the intended Listing price
- [x] The export gate is honored when a Listing transitions to active on an international Marketplace
- [x] Seam tests cover draft content per marketplace (golden-format assertions), floor display, and gate interaction

## Comments

2026-10-24 — Implemented (commit follows this ticket file's update).

- Implementation lives in `src/lib/listings/`: `drafts.ts` (pure generator — one shared description body from the category template's fields plus the 50+ age line, condition, and provenance; per-marketplace title/opening conventions), `floors.ts` (pure Price-Floor maths beside a listing's price), `actions.ts` (the seam: `recordListing`, `setListingStatus`, `getListings`). UI: an Owner-only "Listings & draft packages" card on the item page (record form, status buttons, draft panel, one-action copy button, per-photo download links).
- Marketplace formats, pinned by golden tests: eBay — titles ≤ 80 chars, space-joined keywords, two-line opening; Etsy — titles ≤ 140 chars, comma-joined, one-line opening (its search weighs the first characters); anything else gets the plain generic package at display size. Titles trim back to whole words, never mid-word.
- "Copy-ready in one action, including the sized photo bundle": the Copy button puts the whole package — title, description, price, and the photo URLs sized 1600px (eBay) / 2000px (Etsy) — on the clipboard as one text block. Downloading the photos themselves is one click per photo (Cloudinary `fl_attachment` links). A true single-click zip download is a v1 limitation, same family as ticket 05's fixed rates table — say the word and it becomes a small follow-up.
- Listings carry their own forward-only status: PLANNED → ACTIVE → ENDED (planned may also be discarded straight to ENDED). The ticket's "transitions to active" made ACTIVE the natural pivot: activating on an international marketplace is where the export gate (ADR-0002) now binds for offers, and the item's own Listed step follows — it requires at least one ACTIVE listing and derives domestic/international from those listings' `Marketplace.region` (replacing ticket 04's channel form choice, as that code's comment anticipated). Ended listings keep their record but hide the draft panel (a stale ready-to-paste package on a dead offer invites mistakes; relisting is a new Listing).
- Price Floor beside each price: with a destination zone chosen in the Shipping & Price Floor card, the floor includes the CHEAPEST eligible forwarder's shipping + insurance (declared value = the listing price in IDR); without a zone the floor still shows, flagged as excluding shipping. A price below the floor is flagged with the shortfall.
- Money follows the spec's one-FX-rate model: international listings price in the FX setting's marketplace currency, domestic listings in IDR — enforced on the server, auto-chosen by the form. A listing whose currency no longer matches a later FX change still shows its floor with an explicit note.
- Deviation worth the Owner's eye: the seed adds **Tokopedia** as a third marketplace (DOMESTIC, fee 6.50% — an editable placeholder, not researched). Without a domestic row, spec story 21 ("domestic channels work without the export gate") has nothing to run on now that channels derive from `Marketplace.region`. eBay and Etsy stay INTERNATIONAL. Removing Tokopedia later is deleting one seed row.
- Migration `20261024104257_listing_drafts` adds the `region` column with `DEFAULT 'INTERNATIONAL'` so production's existing eBay/Etsy rows migrate cleanly (the raw Prisma draft had no default and would have failed on the non-empty Neon table; the dev database's recorded checksum was repaired to match the corrected SQL — the documented pattern for this repo).

Review (standards + spec axes) passed; findings fixed: floor maths extracted to a pure module with the zone's rates loaded once (no per-listing re-querying); generated `ListingStatus`/`MarketplaceRegion` enum types replace hand-declared unions; the pricing-defaults read, currency-code regex, item-page revalidation, and the SKBCB gate message were each deduplicated to one shared definition; marketplace-currency enforcement added (spec: "Listing prices in the marketplace's currency"). All 91 seam tests green (17 new in the listings suite, lifecycle suite reworked for the listings-driven Listed step); typecheck, lint, and `next build` clean.

**2026-10-24 (agent):** Accepted by the Owner after trying it on the deployed Vercel app. Deploy: commit 16b1548 pushed, Neon migrated through `20261024104257_listing_drafts` and seeded (Tokopedia installed), live on antiques-nine.vercel.app.
