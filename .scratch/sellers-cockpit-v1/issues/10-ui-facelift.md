# 10: UI facelift

**What to build:** The agreed facelift, in two passes. **Pass 1 — wireframe & flow (structure before skin):** rebuild the app's information architecture around Option A "The Ledger" from the UI research (`.scratch/research/sellers-cockpit-ui-patterns.md`) — home as the photo-led catalog with a derived "Needs attention" strip, the item page as a dossier with tabs, a Sale log page, one consolidated Settings page, open channels (add any marketplace / social platform), and a single Owner role (ADR-0003). **Pass 2 — beautify:** apply the "private museum catalog" visual language (warm paper background, serif display headings, photography as hero, small-caps status stamps, quiet chrome) on top of the now-stable structure.

**Blocked by:** 08 ✓ (restyling once, after the last new screens exist).

**Status:** ready-for-agent

## Pass 1 — structure (the agreed scope)

- [ ] **Home = the catalog.** Photo-led searchable list, stage filter chips with counts, plus a "Needs attention" strip (max 4 derived rows, computed from existing data, each linking to a filtered list): drafts with photos but missing details · cataloged but never listed on any marketplace · listed but never recorded as posted anywhere · reserved but not yet sold.
- [ ] **Item page = dossier.** Photo hero + name + stage stamp at the top, a one-line summary (stage · listed-on · marketed-on · sold price), then five tabs: **Record** (photos, category details, condition, provenance) · **Sale** (cost basis, comparables, valuation, listings + draft packages) · **Marketing** (social drafts + posting log) · **Shipping & export** (forwarder estimates, SKBCB) · **History** (lifecycle events + sale record). All current features regrouped, none removed.
- [ ] **Sale log page.** Every recorded sale, newest first (photo, piece, price, marketplace, date), linking to the item.
- [ ] **One Settings page** holding: **Marketplaces** (add any — name, domestic/international, optional fee %; deletable only while no listing/sale references it) · **Social platforms** (editable list that feeds the posting log's picker; "Other…" free text stays for one-offs and does not auto-join the list) · **Delivery rates** (existing) · **FX & margin** (existing) · **Family** (invite a member — no role question, ADR-0003).
- [ ] **Single role (ADR-0003).** Cataloger role removed everywhere: server gates collapse to signed-in checks, the role column is dropped (migration promotes existing accounts first), invite form has no role choice, GLOSSARY updated.
- [ ] **Navigation.** Desktop top bar: Catalog (home) · Sale log · Clearance · Settings. Phone bottom bar: Catalog · Add · Sale log · More (More = Settings + Clearance). Touch targets ≥ 44px; 3–5 top destinations per platform guidance.
- [ ] **Capture flow unchanged** (name + category → photos → Draft exists immediately); drafts missing details surface in the attention strip.
- [ ] Seam tests updated: removed gates replaced by signed-in checks; new coverage for marketplace adding (and unused-only deletion), the social platform list feeding the posting log, and the Sale log read.

## Pass 2 — beautify (after pass 1 is used and accepted)

- [ ] "Private museum catalog" look applied consistently: warm paper background, serif headings for item names, photos as heroes, small-caps status stamps, tabular numerals for money/dates, quiet gray forms, zero promotional noise. (1stDibs/Vinterior tone + PastPerfect sobriety — see research file §1.6.)
- [ ] The Owner approves the new look on the deployed app (phone included — feeds ticket 09's Android check).

**Deliberately out of scope:** camera-first capture reorder, kanban board view, a unified channels data model (marketplaces and social stay separate, both open-ended), any reskin during pass 1, Bahasa Indonesia UI.

## Comments

2026-10-24 — Scope agreed through research + grill:

- Research dispatched per the Owner's request ("research deep dive, 3 options"): `.scratch/research/sellers-cockpit-ui-patterns.md` — Shopify Polaris patterns, eBay/Etsy/Catawiki seller docs, Poshmark/Mercari capture flows, Sortly open-field modeling, NN/g progressive disclosure, 1stDibs/Vinterior visual register. Mobbin is login-walled; no claims from it.
- Three options presented: **A "The Ledger"** (catalog-first home + item dossier), **B "The Cockpit"** (task-queue home), **C "The Wall"** (kanban home). Owner chose **A**.
- Grill round 1: channels become self-serve, consolidated into ONE settings page (marketplaces + social + delivery + FX + invites) — Owner's addition; attention strip rows and item tabs approved; Sale log page approved; capture flow stays.
- Grill round 2: **single role — "no need role, all owner"** (ADR-0003; spec stories 9, 35–37 superseded); social list feeds the posting log picker with "Other…" one-offs; navigation split desktop-top / phone-bottom agreed; pass-2 style fixed as "private museum catalog"; scope guard agreed (see out-of-scope above).
- Build order within pass 1: item dossier first, then home strip/chips, then Sale log, then Settings consolidation + role removal, then navigation; seam tests ride along with each slice.
