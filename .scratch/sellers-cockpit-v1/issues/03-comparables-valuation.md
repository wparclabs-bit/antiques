# 03: Comparables & Valuation

**What to build:** Evidence-based pricing for every Item: Comparables (source marketplace, link, date, sold price with currency, notes) recorded against an Item, one-click sold-listing search links for eBay and Etsy generated from the Item's attributes, and an Owner-set Valuation price range with full history kept over time.

**Blocked by:** 02 (Items must exist to hold Comparables).

**Status:** ready-for-agent

- [x] Comparables can be recorded against an Item: source marketplace, URL, date, sold price with currency, and notes
- [x] Sold-listing search links for eBay and Etsy are generated from the Item's attributes in one click
- [x] The Owner can set a Valuation price range on an Item; setting Valuations is an Owner-only action
- [x] Valuation history is retained per Item and viewable over time
- [x] Seam tests cover Comparables recording, deterministic search-link generation, the Owner-only Valuation action, and history retention

## Comments

**2026-10-24 (agent):** Implemented (single commit; see git log "Ticket 03"). 53 seam tests green (9 auth + 33 catalog + 11 valuation).

- **Data**: `Comparable` (source, URL optional, soldOn date, price Decimal(12,2) + 3-letter currency, notes) and `Valuation` (min/max range + currency + who set it) — the Valuation table is append-only, so **the table itself is the history**; the view shows the newest row as current.
- **Roles**: everything in the pricing domain is Owner-only on the server — recording/removing Comparables, setting Valuations, and the reads (`getComparables`, `getValuation` return null for a Cataloger, like cost basis in ticket 02). Sold-search links are Owner-only too (story 14 is an Owner story; code-review caught the initial broadening).
- **Search links**: deterministic assembly from the item's name plus its template's `identifying` fields (brand/model/artist/material/period…, declared per category in `categories.ts`). eBay links filter to **sold + completed**; Etsy has no public sold-only search, so its link is a plain search and the UI says so.
- **Interpretations for the Owner to confirm**: (1) Comparable URL is optional (evidence without a link can still be recorded); (2) `removeComparable` exists for typo fixes though not asked for; (3) future sold dates are rejected; (4) money is Decimal(12,2) with a free 3-letter currency (forms offer USD/EUR/GBP/IDR/SGD/JPY via a shared list).
- Valuation history is viewable per item on the item page (Owner only), along with the comparables list and the sold-search buttons.

**2026-10-24 (agent):** Accepted by the Owner on the deployed app ("Okay done").
