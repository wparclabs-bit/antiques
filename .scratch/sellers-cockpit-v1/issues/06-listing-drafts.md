# 06: Listing Drafts

**What to build:** The copy-paste selling package: Listings recorded against an Item (Marketplace, price, currency, status — one Item can be offered on several channels), and the draft generator that assembles a marketplace-formatted package — title, description built from the Item's attributes (materials, dimensions, age, condition, provenance), photos, and price — for eBay and Etsy, copyable with its sized photo bundle in one action, with the Price Floor shown beside the intended price.

**Blocked by:** 03 (price evidence), 04 (gate must guard the Listed transition), 05 (Price Floor).

**Status:** ready-for-agent

- [ ] Listings can be recorded against an Item: Marketplace, price with currency, status
- [ ] The draft generator produces an eBay-formatted package and an Etsy-formatted package: title, description assembled from Item attributes, photos, price
- [ ] The package is copy-ready in one action, including the photo bundle sized to each marketplace's conventions
- [ ] The Price Floor is displayed beside the intended Listing price
- [ ] The export gate is honored when a Listing transitions to active on an international Marketplace
- [ ] Seam tests cover draft content per marketplace (golden-format assertions), floor display, and gate interaction
