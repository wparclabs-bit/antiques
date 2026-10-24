# Antiques

A seller's cockpit for an Indonesian family's inherited antiques: catalog the collection,
research what things are worth, publish listings to external marketplaces, and manage
international shipping. Buyers never use this app — they buy on the marketplaces.

## Language

**Item**:
A single physical antique owned by the family and recorded in the app. Every Item is
unique — there is no stock quantity.
_Avoid_: product, stock, asset

**Marketplace**:
An external sales channel the family sells through (e.g. eBay, Etsy, Catawiki). Buyers
transact there, never in this app.
_Avoid_: our store, shop, platform

**Listing**:
An offer to sell one Item on one Marketplace at a set price. One Item can have many
Listings over its life; a Listing is not the Item itself.
_Avoid_: ad, post, product

**Owner**:
A family login with full rights: sees cost prices, records sales, manages settings.
_Avoid_: admin

**Cataloger**:
A family login that can add and edit Items, photos, and measurements, but cannot see
cost prices or record sales.
_Avoid_: user, member

**Comparables (Comps)**:
Recorded evidence of sold prices for items similar to an Item — the basis of a Valuation.
_Avoid_: market data, references

**Valuation**:
A price range for an Item, decided by a human, derived from its Comparables. Never an
automatic output.
_Avoid_: auto-price, estimate

**Export Clearance (SKBCB)**:
The Surat Keterangan Bukan Cagar Budaya — a certificate from the provincial BPCB/BPK
office proving an Item is not cultural property. Required before a 50+ year Item can be
Listed internationally. It is not a permit; it is proof the permit is not needed.
_Avoid_: export permit, customs papers

**Listing Draft**:
A marketplace-ready package (title, description, photos, price) generated for one
Marketplace, meant to be copy-pasted into that marketplace's own listing form.
_Avoid_: template, content

**Social Draft**:
A platform-ready post for one social network (Instagram caption with hashtags,
Instagram story text, or Facebook post) generated from one Listing — the Item's
record and that Listing's offer assembled into copy-pasteable text. Social media
is marketing only: it points buyers at the Marketplace listing; nothing is sold
and nothing is auto-posted from here.
_Avoid_: content, campaign

**Posting Log**:
The record of where and when each Item was posted on social media — the
platform, the date, and the live post's link or notes. It keeps the family's
marketing effort visible so the same Item is never posted twice by accident.
_Avoid_: schedule, social media history

**Sale**:
The recorded outcome of selling an Item: the actual price and currency, the
Marketplace it sold through, and the date. Recording it is an Owner-only act and is
what marks the Item Sold. The Sale stays with the Item in the Catalog forever, so the
family's own sold prices compound with every sale.
_Avoid_: order, transaction, payment

**Price Floor**:
The suggested minimum Listing price for an Item: cost basis + shipping +
insurance + marketplace fees + the Owner's margin.
_Avoid_: break-even, minimum price

## Categories

The v1 Item categories, each defining the attribute fields its Items carry:

- **Furniture**
- **Ceramics & Porcelain**
- **Art & Paintings**
- **Books**
- **Watch**
- **Pen**
- **Other** — anything outside the six main categories; records what the piece is in its own words plus the shared attributes. More fixed categories can be added later; fully user-defined schemas are a separate future feature.

## Lifecycle

**Catalog**: every Item ever recorded, including sold ones — the archive and the long-term
price database. _Avoid_: database, records

**Inventory**: the Items the family currently owns — Catalog minus sold Items.
_Avoid_: stock

Item states, in order: **Draft** (being entered) → **Cataloged** (complete record) →
**Listed** (offered on a Marketplace; internationally blocked without Export Clearance) →
**Reserved** (verbally committed) → **Sold** (the Sale is recorded) → **Shipped**. Sold
Items stay in the Catalog forever. Every state an Item enters is kept as its lifecycle
history, shown on the Item with the Sale record.
