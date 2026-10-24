# 07: Sales & the archive

**What to build:** Closing the loop when a piece sells: the Reserved, Sold, and Shipped transitions; recording the actual sale (price, currency, marketplace, date) as an Owner-only action; sold Items leaving the Inventory while remaining in the Catalog forever — making the family's own sold-price history compound with every sale.

**Blocked by:** 04 (lifecycle machine), 06 (Listings to sell through).

**Status:** ready-for-agent

- [ ] Reserved, Sold, and Shipped transitions work within the enforced state machine
- [ ] The actual sale can be recorded on an Item — price, currency, marketplace, date — as an Owner-only action
- [ ] A sold Item disappears from Inventory but stays in the Catalog forever with its sale record
- [ ] The lifecycle history of an Item is viewable (states and the sale record over time)
- [ ] Seam tests cover Owner-only sale recording, archive retention, and Inventory exclusion
