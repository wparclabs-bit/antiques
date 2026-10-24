# 05: Shipping & Price Floor

**What to build:** Knowing what a sale truly costs: an Owner-editable forwarder rates table seeded from the research findings (DHL Express insured, Pos Indonesia economy, sea freight for oversized pieces), a shipping and insurance estimate from an Item's dimensions, weight, and destination zone, one editable FX rate converting between IDR and marketplace currencies, and the Price Floor — cost basis + shipping estimate + marketplace fees + the Owner's margin.

**Blocked by:** 02 (Item dimensions, weight, and cost basis must exist).

**Status:** ready-for-agent

- [ ] The Owner can edit the rates table per forwarder and destination zone; it is seeded with the researched defaults (DHL Express insured 1–2% of declared value with IDR 170k minimum and 70 kg piece limit; Pos Indonesia economy; sea freight per cubic meter)
- [ ] A shipping estimate is produced from an Item's dimensions and weight plus a destination zone
- [ ] An insurance estimate is produced from the declared value using the forwarder's rate
- [ ] One editable FX rate converts IDR costs and marketplace-currency prices, shown side by side
- [ ] The Price Floor is computed and viewable: cost basis + shipping estimate + marketplace fee percentage + margin setting
- [ ] Seam tests cover estimate maths, insurance maths, Price Floor composition, FX conversion, and rates-table editing
