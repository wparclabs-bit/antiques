# Seller's Cockpit v1

**Status:** ready-for-agent

## Problem Statement

An Indonesian family inherited a large collection of antiques from their parents. Today
they have no reliable record of what they own, no idea what individual pieces are worth
on the international market, and no safe path to selling abroad: Indonesian law treats
any object 50+ years old as suspected cultural property that cannot leave the country
without an SKBCB certificate, and violating that risks prison time. Spreadsheets cannot
hold this: every category (furniture, ceramics, paintings, books, watches, pens) needs
different attributes; photos must be resized differently per marketplace; listing
descriptions must be assembled from measurements, materials, age, and condition; and
shipping costs from Indonesia to overseas buyers vary by forwarder, weight, and declared
value. The family needs one tool that captures the collection, prices it with evidence,
respects the export law, and produces ready-to-paste listings — while letting trusted
family members help catalog without exposing family finances.

## Solution

A private web application — a **seller's cockpit** — used by the Owner and family
Catalogers from a browser (including Android). It catalogs every Item with
category-specific attribute templates and auto-resized photos, prices Items through a
human-decided Comparables workflow, and moves each Item through a enforced lifecycle
(Draft → Cataloged → Listed → Reserved → Sold → Shipped) with an export-compliance gate:
Items flagged 50+ years cannot be Listed internationally until an SKBCB certificate is
recorded. For selling, it generates copy-paste-ready Listing Drafts per marketplace
(eBay, Etsy in v1) with photos sized to each platform's rules, computes a Price Floor
from cost + editable forwarder rates + marketplace fees + margin, and drafts social
media posts with a posting log. The Catalog keeps every Item forever — sold prices
compound into the family's own price database. Buyers never use the app; they buy on
the external marketplaces.

## User Stories

### Cataloging

1. As an Owner, I want to record a new Item with its name, category, and photos, so that the collection is captured piece by piece.
2. As an Owner, I want the entry form to ask category-specific attributes (e.g. Furniture: dimensions, wood/material, style, period; Watch: brand, movement, case material), so that every record is complete and comparable.
3. As a Cataloger, I want to upload photos from my Android browser camera, so that I can capture Items where they stand without special equipment.
4. As an Owner, I want photos automatically resized into marketplace-ready variants, so that they are ready to paste into any listing.
5. As an Owner, I want a "50+ years old?" flag on every Item (defaulting to yes), so that export rules can be enforced without me remembering the law.
6. As an Owner, I want to enter measurements manually per the category template, so that dimensions are recorded consistently.
7. As an Owner, I want to record condition notes and provenance (where the piece came from), so that listings and certificates have the story behind the piece.
8. As an Owner, I want to record the cost basis in IDR per Item, so that floors and margins are grounded in real numbers.
9. As a Cataloger, I must NOT see cost prices or sale records, so that sensitive family finances stay with the Owner.
10. As an Owner, I want to save incomplete Items as Drafts and mark them Cataloged when complete, so that cataloging the whole collection can happen in many sittings.
11. As an Owner, I want to search and filter the Catalog by keyword, category, and lifecycle state, so that I can find any Item in seconds.
12. As an Owner, I want to see Inventory (Items currently owned) separately from the full Catalog (including sold), so that I always know what we still hold.

### Valuation

13. As an Owner, I want to record 3–5 Comparables per Item (source marketplace, link, date, sold price, currency, notes), so that every Valuation is backed by evidence.
14. As an Owner, I want the app to generate sold-listing search links on eBay/Etsy from an Item's attributes, so that comparable research is one click instead of a typing chore.
15. As an Owner, I want to set a Valuation price range on each Item — my decision, informed by Comparables — so that prices are human judgment, not guesses.
16. As an Owner, I want Valuation history kept per Item over time, so that I can see how my categories trend as the collection sells.

### Lifecycle & export compliance

17. As an Owner, I want the lifecycle enforced (Draft → Cataloged → Listed → Reserved → Sold → Shipped) with invalid transitions rejected, so that the record always reflects reality.
18. As an Owner, I want the app to block international Listing of any 50+ year Item unless an SKBCB certificate number and scan are recorded, so that the family can never break the law by accident.
19. As an Owner, I want to record an Item's SKBCB certificate number and a scan of the certificate, so that clearance is provable at shipping time.
20. As an Owner, I want a checklist of Items that need SKBCB clearance, so that I can start assessments with the BPCB/BPK office in batches.
21. As an Owner, I want domestic (Indonesian) channels to work without the export gate, so that local selling is not slowed by international rules.

### Selling

22. As an Owner, I want to record which Marketplace(s) an Item is Listed on, with price and currency per Listing, so that one Item can be offered in several channels.
23. As an Owner, I want a copy-paste-ready Listing Draft per marketplace — title, description, photos, price — so that publishing on eBay or Etsy is a paste, not a writing project.
24. As an Owner, I want the description assembled automatically from the Item's attributes (materials, dimensions, age, condition, provenance), so that it writes itself and stays consistent.
25. As an Owner, I want drafts formatted to each marketplace's conventions (title length, structure), so that nothing gets rejected or truncated.
26. As an Owner, I want to copy a draft and download its photo bundle in one action, so that listing takes minutes.
27. As an Owner, I want the Price Floor shown next to my intended Listing price, so that I never list below what the sale is worth to us.

### Shipping & costs

28. As an Owner, I want to maintain an editable rates table per forwarder and destination zone (DHL Express insured, Pos Indonesia economy, sea freight for oversized), so that estimates match reality without code changes.
29. As an Owner, I want a shipping estimate from an Item's dimensions, weight, and destination zone, so that I know what a sale actually costs to fulfill.
30. As an Owner, I want an insurance estimate from declared value using the forwarder's rate (e.g. 1–2% for DHL), so that risk is priced in.
31. As an Owner, I want the Price Floor computed as cost basis + shipping estimate + marketplace fees + my margin setting, so that the minimum acceptable price is a fact, not a feeling.
32. As an Owner, I want one editable FX rate so IDR costs and marketplace-currency prices convert transparently, so that I always see both sides.

### Marketing

33. As an Owner, I want social media post drafts (Instagram caption with hashtags, story text, Facebook post) generated from a Listing, so that marketing an Item is not a separate writing job.
34. As an Owner, I want a posting log recording where and when each Item was posted, so that marketing effort is visible and not repeated accidentally.

### Access & roles

35. As an Owner, I want simple email/password logins for me and family — no public signup — so that only trusted people reach the collection.
36. As an Owner, I want to invite family members as Catalogers and manage their accounts, so that help cataloging does not expose finances or sales rights.
37. As a Cataloger, I want to do everything involved in capturing Items (photos, attributes, measurements), so that I can meaningfully help without Owner bottlenecks.

## Implementation Decisions

- **Seller's cockpit, not a platform** (ADR-0001): no buyer accounts, payments, or escrow. Actual sales happen on external marketplaces; sale outcomes are recorded manually into the app.
- **Stack**: Next.js + TypeScript; PostgreSQL accessed through Prisma; Tailwind CSS with shadcn/ui components; Cloudinary for photo storage with derived marketplace-sized variants; Vercel free tier + a managed Postgres free tier for hosting. All mainstream, tutorial-rich choices.
- **Single-page-app style responsive web app**; no native app in v1. The Android experience is the phone browser, including camera upload.
- **Auth**: email/password with no public signup; the Owner invites accounts. Two roles only — Owner and Cataloger (per GLOSSARY.md). Cataloger restrictions (no cost basis visibility, no sale recording, no settings) are enforced on the server, not just hidden in the UI.
- **Category templates**: six categories in v1 (Furniture; Ceramics & Porcelain; Art & Paintings; Books; Watch; Pen). Each category defines its attribute schema (including measurement fields); Items carry common fields (name, photos, 50+ flag default yes, condition, provenance, cost basis, lifecycle state) plus their category's attributes.
- **Lifecycle state machine** with server-enforced valid transitions; the export gate is part of the machine: transitioning to Listed on an international Marketplace is rejected when the 50+ flag is set and no SKBCB (certificate number + scan) is recorded.
- **Valuations**: Comparables are a per-Item list with source, URL, date, price, currency, notes. The Valuation is a range set by the Owner; history is retained. Sold-search link generation is deterministic assembly of marketplace search URLs from Item attributes — no AI dependency in v1.
- **Listings**: one Item, many Listings (Marketplace, price, currency, status). The Listing Draft generator produces a per-marketplace package (title, description, photos, price) formatted to that marketplace's conventions; copy-to-clipboard and photo-bundle download are first-class.
- **Shipping**: an Owner-editable rates table (forwarder × zone × rate structure), seeded from the research findings (DHL Express insured 1–2% declared value with IDR 170k minimum and 70 kg piece limit; Pos Indonesia economy; sea freight per cubic meter for oversized). Estimates use Item dimensions/weight from the catalog. Price Floor = cost basis + shipping estimate + marketplace fee percentage + margin setting, converted at the single editable FX rate.
- **Money**: cost basis in IDR; Listing prices in the marketplace's currency; one editable FX-rate setting for display conversion; no live currency APIs.
- **Social**: per-platform draft templates (Instagram caption + hashtags, Instagram story, Facebook) assembled from the Listing; a posting log (Item, platform, date, link/notes).
- **Language**: English UI strings written i18n-ready from the start; Bahasa Indonesia is a later layer.

## Testing Decisions

- **One seam**: the Server Actions layer — the app's entire public interface (e.g. add item, record comparables, set valuation, transition lifecycle, generate listing draft, calculate price floor). Tests call these functions directly against a real test database. Confirmed with the Owner.
- A good test drives external behavior through that seam and asserts observable outcomes: the gate blocks a flagged Item's international listing; the Price Floor sums its components; a Sold Item remains in the Catalog; a Cataloger action reading cost basis is rejected server-side. Tests do not inspect internal tables, private helpers, or implementation shape, so they survive refactors.
- **No UI tests in v1**: pages are verified by using the app (the Owner is the visual tester); this avoids the most fragile test category while the product is young.
- **Modules under test through the seam**: catalog CRUD and category templates; role enforcement; lifecycle and export gate; comparables and valuations; listing draft generation (golden-format assertions per marketplace); shipping calculator and Price Floor; social drafts and posting log.
- **Prior art**: none — this is a greenfield repo; this spec's seam is the pattern all future tests follow. Test runner: the ecosystem-standard runner for the stack (Vitest) wired to the test database.

## Out of Scope

- Being a marketplace platform: buyer accounts, payments, escrow (rejected by ADR-0001).
- API auto-publishing to marketplaces — v1 is draft-export, copy-paste.
- AI auto-valuation from photos — future ambition, explicitly not v1.
- Social media auto-posting — drafts and log only.
- Live carrier rate APIs and live currency feeds — editable tables/rates only.
- Native Android app and AR/photo-based measurement — a separate later track; v1 is the responsive web app with manual measurement entry.
- Additional marketplace channels (Catawiki, 1stDibs, European/Dutch platforms) — informed by pending research, added after v1.
- Bahasa Indonesia UI — later layer over i18n-ready strings.

## Further Notes

- Vocabulary is defined in `GLOSSARY.md` (Item, Marketplace, Listing, Listing Draft, Comparables, Valuation, Price Floor, Export Clearance/SKBCB, Catalog vs Inventory, Owner, Cataloger). ADR-0001 (seller's cockpit) and ADR-0002 (export-compliance gate) are binding.
- Legal and carrier research with citations lives in `.scratch/research/export-and-forwarders.md`; it is the source for the export gate and the seeded rates table. European/Dutch furniture-marketplace research lives in `.scratch/research/furniture-marketplaces-europe.md`; its sea-freight figures (LCL Jakarta→Rotterdam ≈ $140–200 per cubic meter all-in, 40–48 days) feed the ticket-05 rates-table seed, and its channel findings (Catawiki as the flagship future EU channel; Catawiki closed lots, LiveAuctioneers, and The Saleroom as free realized-price Comparables sources) inform channels after v1.
- Operational reality: the app tracks SKBCB status but cannot obtain certificates — the family should start BPCB/BPK assessments early for Items they intend to sell abroad; the needs-clearance checklist exists to drive that batch process.
