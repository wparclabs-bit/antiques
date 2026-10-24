# 05: Shipping & Price Floor

**What to build:** Knowing what a sale truly costs: an Owner-editable forwarder rates table seeded from the research findings (DHL Express insured, Pos Indonesia economy, sea freight for oversized pieces), a shipping and insurance estimate from an Item's dimensions, weight, and destination zone, one editable FX rate converting between IDR and marketplace currencies, and the Price Floor — cost basis + shipping estimate + marketplace fees + the Owner's margin.

**Blocked by:** 02 (Item dimensions, weight, and cost basis must exist).

**Status:** ready-for-agent

- [x] The Owner can edit the rates table per forwarder and destination zone; it is seeded with the researched defaults (DHL Express insured 1–2% of declared value with IDR 170k minimum and 70 kg piece limit; Pos Indonesia economy; sea freight per cubic meter)
- [x] A shipping estimate is produced from an Item's dimensions and weight plus a destination zone
- [x] An insurance estimate is produced from the declared value using the forwarder's rate
- [x] One editable FX rate converts IDR costs and marketplace-currency prices, shown side by side
- [x] The Price Floor is computed and viewable: cost basis + shipping estimate + marketplace fee percentage + margin setting
- [x] Seam tests cover estimate maths, insurance maths, Price Floor composition, FX conversion, and rates-table editing

## Comments

2026-10-24 — Implemented (commit follows this ticket file's update).

- Implementation lives in `src/lib/shipping/`: `seed.ts` (researched defaults, idempotent upserts that never overwrite Owner edits — also run by `prisma/seed.ts` and lazily on first settings read), `estimates.ts` (pure maths: measurement extraction, quotes, insurance, Price Floor — every rule written down once in its header), `actions.ts` (the seam). UI: `/settings` page (Owner-only) for rates/fees/FX/margin, and an Owner-only "Shipping & Price Floor" card on the item page that GETs back to the page like the catalog filters — fully server-rendered, no client state.
- Estimate rules worth knowing: chargeable weight = max(actual, volumetric at the forwarder's divisor, 1 kg billing minimum), rounded up to whole kg; a round piece's diameter counts twice (cylinder → square box); framed art bills frame dims over image dims; sea freight needs three recorded dimensions. Piece limits (DHL 70 kg, Pos 30 kg) are checked against ACTUAL weight — a handling limit, not a price — so the 40 kg cabinet stays DHL-eligible and is billed its 146 kg volumetric weight; the comparison view makes obvious why furniture goes by sea.
- Price Floor = (cost basis + shipping + insurance + margin%) ÷ (1 − fee%). The marketplace fee is a percentage OF the listing price, so it is divided out — adding fee% to costs would under-recover. GLOSSARY's Price Floor entry now includes insurance (it didn't before; the ticket's "risk is priced in" requires it).
- v1 limitation: the rates table edits numbers only — the forwarder × zone set (3 × 3) is fixed in the seed. Adding a zone or forwarder is a code change today; if the family needs more zones, that's a small follow-up (add rows to `SEED_RATES` or build add/delete actions).
- Insurance is seeded unpriced (0%) for Pos Indonesia and sea freight — the research found no rates for them ("must be checked per service"); DHL carries the researched 2% / IDR 170k minimum. The declared value is an estimate-form input, not stored on the Item.
- A `Marketplace` table (eBay / Etsy with editable fee %) was added — the floor needs a per-marketplace fee source and ticket 06's Listings build on it. The seeded percentages are editable placeholders, not research figures.
- Everything shipping/pricing is Owner-only on the server (reads null, writes `ForbiddenError`) — same pattern as cost basis and valuations.

Review (standards + spec axes) passed; findings fixed (glossary updated, generated `RateBasis` enum used instead of hand-declared unions, rate-view mapping and default constants deduplicated). All 74 seam tests green; typecheck, lint, and `next build` clean.
