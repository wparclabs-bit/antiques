# 07: Sales & the archive

**What to build:** Closing the loop when a piece sells: the Reserved, Sold, and Shipped transitions; recording the actual sale (price, currency, marketplace, date) as an Owner-only action; sold Items leaving the Inventory while remaining in the Catalog forever — making the family's own sold-price history compound with every sale.

**Blocked by:** 04 (lifecycle machine), 06 (Listings to sell through).

**Status:** ready-for-agent

- [x] Reserved, Sold, and Shipped transitions work within the enforced state machine
- [x] The actual sale can be recorded on an Item — price, currency, marketplace, date — as an Owner-only action
- [x] A sold Item disappears from Inventory but stays in the Catalog forever with its sale record
- [x] The lifecycle history of an Item is viewable (states and the sale record over time)
- [x] Seam tests cover Owner-only sale recording, archive retention, and Inventory exclusion

## Comments

2026-10-24 — Implemented (commit follows this ticket file's update).

- The sale record lives in `src/lib/sales/` (`recordSale`, `getSale`); a `Sale` row carries price (Decimal(12,2)), currency, the Marketplace it sold through, and `soldOn`, 1:1 with its Item. Sale reads and the write are Owner-only on the server — a Cataloger gets rejections and nulls, the same gate as cost basis (spec story 9).
- **Recording the sale IS the Sold step.** `recordSale` requires a Reserved item and commits the record, the SOLD state, and the history row in one transaction; `transitionItem` refuses `to=SOLD` with a pointer to the record form, exactly as it refuses `to=CATALOGED` — the machine's `canTransition` table is unchanged, but the step cannot be taken without the record. Reserved itself stays a bare step (a verbal commitment carries no data yet).
- Archive mending: pieces marked Sold or Shipped before this ticket (their states were not backdated) can have the record attached afterwards without moving state — the alternative is a permanent hole in "sold Items keep their sale record". Guard against doubles lives in the action.
- Lifecycle history: a `LifecycleEvent` row per state entered, written by the same transaction that moves the state (creation writes Draft; `catalogItem`, `transitionItem`, and `recordSale` write theirs). The migration backfills one Draft event per existing Item at its creation time — later states are not invented. Shown on the item page under the Lifecycle card, oldest first (ties broken by the machine's `STATE_ORDER`), with the sale price/marketplace/date on the Owner's Sold line.
- The Catalog list shows "Sold $X · Marketplace" on the card for the Owner — the family's own sold prices compound visibly. Inventory exclusion of Sold/Shipped already existed (ticket 04's view filter); tests now pin it together with the record.
- Money: the sale price is what the buyer actually paid, so any 3-letter currency is accepted (default follows the chosen marketplace's channel, as listings do); the price regex is now one shared `MONEY_PATTERN` (catalog/display.ts), deduped from the listings and valuation copies.
- Sale dates get a 14-hour future slack before rejection: the family records from UTC+7, where an early-morning "today" is still ahead of a UTC server clock. A typo'd year is still caught.
- Migration note: the generated SQL also drops `Marketplace.region`'s DB default — ticket 06's migration added it as a backfill safety net but the schema never declared it; Prisma's diff aligns the database with `schema.prisma`. Harmless on Neon (every insert names the region).
- Dev DB drift: `migrate dev` demanded a reset because production's corrected `listing_drafts` SQL (region default) had never been replayed into the local dev DB. Repaired by applying the missing default directly — the repo's repair-don't-reset pattern — after which the migration applied cleanly.

Review (standards + spec axes) passed; findings fixed: the sale/state/history writes now commit in one `$transaction` (the review caught a failure path that could strand a Reserved item with an un-recordable sale), the glossary's "always has its Sale" claim was softened to match the mending path, the history sort comment was made truthful, the money regex was deduplicated, and the test fixtures were moved onto the read seam. All 100 seam tests green (9 new in the sales suite, lifecycle suite walks Sold through `recordSale`); typecheck, lint, and `next build` clean.
