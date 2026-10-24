# Research: UI/UX patterns for the Antiques "cockpit" — a family records-first dashboard

Research date: 2026-10-24. Sources: official design-system docs (Shopify Polaris, NN/g, Apple HIG, Material 3), official seller/collection product docs (eBay, Etsy, Mercari, Poshmark, Sortly, PastPerfect, Catawiki, Airtable, Notion), and store/help pages. Each claim is marked **verified** (read directly from the cited page this session) or **reported** (search-result snippet of the cited page, or third-party write-up — re-check before relying on the exact wording).

> **Owner reframe (records-first family dashboard, not a seller tool).** Mid-research the Owner corrected the framing: this is *"a dashboard for the family, to catalogue and records, which is already in marketplace and what stage, which has already been marketed."* I.e. the app is a **private family record-keeping dashboard / collection registry** that tracks the status of things happening OUTSIDE the app: items already listed on external marketplaces, at what lifecycle stage, what has been marketed where, and what sold. Selling happens elsewhere; the app records. All findings and design options below are framed accordingly — "status-of-things" energy, not commerce energy. Merchant-tool evidence (Shopify, eBay) is still used, but as evidence about *status dashboards and work queues*, not as a business model to copy.

---

## 1. Findings

### 1.1 What belongs on the home page of a status-first dashboard

Across every real product examined, the home page is **not a data dump and not the catalog** — it is a thin "what is the state of things / what needs me next" layer sitting on top of the records.

- **Shopify admin Home** is documented as: "On Shopify Home, you can find information about daily tasks, the next steps you need to take with your orders, recent sales activity on your store, personalized recommendations" (**verified**, [Shopify Home help](https://help.shopify.com/en/manual/shopify-admin/shopify-home)). Its concrete blocks: a small **metrics strip** (four customizable numbers: sessions, total sales, total orders, conversion), **order tasks grouped by type** (capture payments, fulfill orders, process returns, review high-risk orders…), updating **home cards**, and **Insights** (data observations, only for stores above a volume threshold). Note the ratio: *one small metrics strip, one work queue, everything else optional feed content*. The admin itself is called "a back office tool for running your business' operations and logistics" (**verified**, [Shopify admin overview](https://help.shopify.com/en/manual/shopify-admin)).
- **eBay Seller Hub's Overview tab** is described by eBay as "a dashboard of elements, a personalised snapshot", showing "your Tasks, Orders, Listings, and Feedback, along with instant access to frequently used actions and selling tools", with "15 modules on this page that you can tailor to display information that's most important to you" (**verified**, [eBay: Seller Hub](https://export.ebay.com/en/services-tools/seller-hub); the same Overview description appears on [eBay Help id=4095](https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095) — **reported** via search snippet). eBay's own onboarding instruction is simply: "On the Selling Overview page, click the List an item button" (**verified**, [eBay seller registration](https://export.ebay.com/en/first-steps/how-to-create-seller-account)) — i.e. the primary action is surfaced right on the overview. Older "My eBay Selling Overview" modules were re-issued as **tasks** in Seller Hub (**reported**, [eBay Fall 2020 release notes](https://export.ebay.com/en/resources/seller-news/releases-archive/ebay-fall-2020-update/listing-promoting)).
- **Etsy's Shop Manager dashboard** is "a quick way for sellers to see important shop info in one convenient place, including shop-specific updates, reminders, and other resources" (**verified** first sentence, [Etsy help](https://help.etsy.com/hc/en-us/articles/360000343908-How-to-Use-Your-Dashboard-to-Manage-Your-Shop)); third-party walkthroughs describe it as modules for shop info/settings, orders, stats, marketing, and reminders (**reported**, [SellingOS guide](https://sellingos.com/etsy-shop-manager-complete-guide)).
- **Catawiki** ships a "Sales Dashboard" giving sellers "easy access to their data and essential channels" and an updated "Sales Overview" for sales/financial data per lot (**reported**, [Catawiki stories](https://www.catawiki.com/en/stories/5711-7-tips-to-increase-your-performance-as-a-catawiki-seller), [Catawiki stories 2](https://www.catawiki.com/en/stories/6283-improve-your-sales-with-new-features-and-seller-tips)).

**Pattern extracted:** home = (1) a *derived* attention queue computed from record state ("orders needing fulfillment" = orders whose state implies an unfinished next step), (2) a *compact* status strip (a few numbers at most), (3) deep links into records. eBay lets users tailor modules; Shopify demotes news to a feed below the fold. NN/g's dashboard guidance is that a dashboard must let users grasp state at a glance using preattentive attributes (length, 2-D position) rather than reading numbers (**reported**, [NN/g dashboards-preattentive](https://www.nngroup.com/articles/dashboards-preattentive)); their complex-application guidelines likewise push task-first, low-chrome layouts (**reported**, [NN/g complex-application-design](https://www.nngroup.com/articles/complex-application-design)).

**For Antiques:** the family's version of "order tasks" is *record-completion and status-progression*: items still Draft with no photos, items Cataloged but never listed anywhere, items Listed but never marketed, items Reserved but not marked Sold, items Sold but not Shipped, export checklist gaps. All of that is derivable from data the app already stores — no task engine needed, just derived counts with links.

### 1.2 How comparable products structure one item's page

- **Shopify Polaris** (the design system for the Shopify merchant admin — the richest documented cockpit UI) has exactly two named layout patterns that map to Antiques' two core screens: **"Resource index layout — Organize and take action on resource objects"** and **"Resource details layout — Create, view, and edit resource objects"** (**verified descriptions**, [Polaris resource-index-layout](https://polaris.shopify.com/patterns/resource-index-layout), [Polaris resource-details-layout](https://polaris.shopify.com/patterns/resource-details-layout)). The pattern model treats an admin as: an *index* (searchable, filterable list of records with bulk actions) plus a *detail* (a titled record page with the object's state in the title area, primary actions pinned in a title bar, related resources split out). Polaris React is now deprecated in favor of web components, but the pattern documentation is the current guidance (**verified**, [Polaris](https://polaris.shopify.com)).
- **eBay's Listings tab** consolidates creation and management: "From this tab you can create, monitor and manage listings", with up to **5,000 saved drafts** (**verified**, [eBay: Seller Hub](https://export.ebay.com/en/services-tools/seller-hub)) — drafts are a first-class record state, not a transient form state.
- **Catawiki** gives every lot an explicit, named status shown to the seller: **Draft** (saved, not yet submitted, deletable), **Submitted** (under expert review), **Planned** ("your lot is scheduled for auction") (**reported** from official help pages, [Catawiki lot statuses](https://www.catawiki.com/en/help/most-asked-questions-of-sellers/what-do-the-different-lot-statuses-mean), [Catawiki help for sellers](https://www.catawiki.com/en/help/seller)).
- **NN/g on progressive disclosure** (directly governs the 10-card stack problem): "Progressive disclosure defers advanced or rarely used features to a secondary screen, making applications easier to learn and less error-prone", but "You have to disclose everything that users frequently need up front, so that they have to progress to the secondary display only on rare occasions", and designs with "three or more levels usually fail" (**verified**, [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)).
- **NN/g on cards vs lists**: a card "bundles a few short, related pieces of information" and works "best for collections of heterogeneous items"; but cards "de-emphasize ranking, are less scannable than lists, take more screen space" and are poor for comparison tasks (**verified**, [NN/g cards-component](https://www.nngroup.com/articles/cards-component)). Implication: card grids for the *catalog gallery* (browsing unique, photo-led objects) — but the item *detail* should be a structured record, not ten equal-weight cards.

**Pattern extracted:** the comparable products all converge on a **status-in-title, sections-below record page**: the object's name, photo, and current stage are visible at the top with the stage-appropriate primary action (e.g. "Submit", "List", "Mark sold"), and the remaining material is grouped into a small number of labeled regions or tabs. Nothing reports success with ten coequal cards.

### 1.3 List vs board: does anyone use a kanban for item lifecycle?

- The closest mainstream pattern is **Notion inventory templates presented as a board grouped by status** (e.g. "In Stock, Low Stock, Out of Stock, Discontinued") (**reported**, [grizzlytemplates](https://www.grizzlytemplates.com/blog/how-to-set-up-a-notion-database-for-your-inventory-management)); Airtable templates similarly lean on **status fields plus multiple views** (grid/board) over the same records (**reported**, [Airtable asset tracker](https://www.airtable.com/templates/asset-tracker/expRq0Ojhi6y8svcV), [Notion inventory templates](https://www.notion.com/templates/category/inventory-management)).
- The serious unique-object products (eBay, Etsy, Catawiki, 1stDibs, Sortly, PastPerfect) all present inventory as a **list/grid with status labels and status filters**, not as a drag-and-drop board. eBay: "all your selling activity is on one screen" on the Orders tab (**verified**, [eBay: Seller Hub](https://export.ebay.com/en/services-tools/seller-hub)). Sortly: a "visual view of your entire inventory" = photo-grid list with filters (**verified**, [Sortly photos](https://www.sortly.com/features/photos)).
- Statuses remain useful *as data*: Catawiki's per-status naming (Draft → Submitted → Planned → …) is effectively Antiques' lifecycle rendered as words, shown inline on the lot row (**reported**, [Catawiki lot statuses](https://www.catawiki.com/en/help/most-asked-questions-of-sellers/what-do-the-different-lot-statuses-mean)).

**Pattern extracted:** boards appear in generic databases where the user configures views; they do not appear in dedicated unique-item products. A board is appropriate when *moving items between stages is the primary daily work and stages are few*; a filterable photo-list is appropriate when the primary work is *finding a specific object and working on its record* — which is Antiques' case (search by memory of the object; the lifecycle is a property of the record, not the organizing principle).

### 1.4 Mobile-first capture: photo → draft → details later

The resale apps are the best-documented camera-to-inventory flows:

- **Poshmark** ("How Do I List an Item?"): "step 1. Tap on the 'sell' button in the app. step 2. Upload or take a photo of the item you wish to sell" (up to **16 photos**), *then* "give your listing a title, description, price, etc." (**verified**, [Poshmark Posh Guide](https://poshmark.com/posh_guide/how_to_list_item)). The App Store description leads with the camera: "Snap a photo and let Smart List AI generate your title, fill in the details, and prepare your listing in seconds" (**reported**, App Store listing via search).
- **Mercari**: "Just take some photos, add a description, and set the price. You can add up to 12 photos"; guidance to shoot in natural light, plain background, every side *including flaws*; and crucially: "Save a listing for later by tapping 'Save draft'" (**verified**, [Mercari: Creating a Listing](https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing)).
- **Depop**: "List preloved items with a few taps, add photos, and start selling fast"; "Simply snap a photo and our AI will scan it, write the description…" (**reported**, [Depop on the App Store](https://apps.apple.com/ve/app/depop-buy-sell-clothes/id518684914), Google Play description via search).
- **Sortly** (photo-inventory product, closer to Antiques than resale apps): "Add up to 8 photos per item or folder"; "Easily add photos on mobile devices with the Sortly app or use the desktop version"; "Track asset condition in real-time by adding photos after each use" (**verified**, [Sortly photos](https://www.sortly.com/features/photos)).
- Platform constraints for the capture screens: Apple requires "a button needs a hit region of at least 44x44 pt" (**verified**, [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)); Material 3 navigation bars "provide access to three to five destinations" for top-level mobile navigation (**verified description** + **reported** detail, [M3 navigation bar](https://m3.material.io/components/navigation-bar/guidelines), [M2 bottom navigation](https://m2.material.io/components/bottom-navigation)), with a 48dp minimum touch target from Material accessibility guidance (**reported**, [M3 accessible design](https://m3.material.io/foundations/accessible-design/overview)).

**Pattern extracted:** every good flow is **camera-first with an immediate draft**: one tap from home to camera, photos land in a named draft record visible in the normal list (with a "needs details" state), and the typing happens later, on any device, or on the same phone but staged. Antiques' Catalogers already work this way in spirit (camera upload → item record); the facelift should make the *draft record with photos but missing details* a visible, first-class state (Mercari's "Save draft" + eBay's 5,000 drafts both say: never lose a capture).

### 1.5 Recording arbitrary external channels (marketplaces + social) — open-ended, not fixed

The family wants to record "listed on X", "posted on Y" for ANY marketplace and ANY social platform, including ones they start using next month. Evidence for open-ended modeling:

- **Sortly custom fields**: users define their own fields per item/folder, with 12 field types (text, number, checkbox, **dropdown**, date, **weblink**, file, barcode…); dropdown options "reduce manual data entry and errors", and custom fields are filterable (**verified**, [Sortly custom fields](https://www.sortly.com/features/custom-fields)). The key design move: Sortly ships *no* fixed "channel" concept — the user's world is modeled with user-defined picklists plus free text/links.
- **Airtable / Notion** inventory designs are built on **user-defined single/multi-select fields and statuses** (the Notion "status property" and Airtable "select" fields are core primitives; templates show status values invented by the user) (**reported**, [Airtable templates](https://www.airtable.com/templates/asset-tracker/expRq0Ojhi6y8svcV), [Notion inventory templates](https://www.notion.com/templates/category/inventory-management)).
- The marketplace products themselves hardcode *their own* channels (eBay Seller Hub has Marketing/Advertising tabs) because they only integrate with themselves — **verified** tab list, [eBay: Seller Hub](https://export.ebay.com/en/services-tools/seller-hub) — which is exactly the model Antiques should NOT copy for external channels.

**Pattern extracted:** model channels as **free-form records** (channel name + kind: marketplace/social/other + optional URL), not a fixed enum; record postings as a **log per item** ("posted to Facebook Group 'Jakarta Antiques', 2026-10-01") with type-ahead over previously used channels; keep the *item lifecycle* (Draft→…→Shipped) fixed, because every comparable product does fix the object lifecycle while leaving metadata open.

### 1.6 Visual language for antiques / premium / vintage

- **1stDibs** presents itself as photography-led editorial: "Discover unique furniture, home décor, jewelry, fashion and art from top sellers worldwide. Elevate your space and style with extraordinary pieces" (**verified**, [1stdibs.com](https://www.1stdibs.com)); it runs a long-standing editorial magazine (Introspective) alongside the marketplace (**reported**, [1stdibs introspective](https://www.1stdibs.com/introspective-magazine/)). The feel: large hero photography on neutral grounds, restrained typography, commerce chrome kept quiet so objects dominate.
- **Vinterior** positions as "Home of Sustainable Vintage Furniture" — "Good quality, good looking, good for the planet" — with founder-led "digital design curation" and styled, homely editorial photography (**reported**, [vinterior.co](https://www.vinterior.co), SCMP interview via search).
- **Catawiki**'s seller experience is organized around curated **auction catalogs** with expert review — the object page and lot statuses read like an archive record, not a shop SKU (**verified structure** via help pages, [Catawiki help for sellers](https://www.catawiki.com/en/help/seller)).
- **Museum/archive tone**: PastPerfect (the standard small-museum CMS) structures every object as a sober catalog record with fields "Collection, Object ID, Object Name, Description, Condition, Status, Home Location", with separate catalogs for objects/photos/archives/library (**reported** from official docs, [PastPerfect introduction](https://museumsoftware.com/WebHelp/Frontmatter/PP5-Introduction.html), [PastPerfect objects](https://museumsoftware.com/WebHelp/Chapters/PP5-6a.htm)). The "archive feel" comes from: provenance and condition treated as first-class fields, IDs/numbers shown plainly, neutral paper-like backgrounds, serif or old-style display type for headings, no promotional banners.
- CatalogIt — a collection-cataloging app aimed at families, collectors and small museums — is the closest product by audience (family archives), but its site is a JS SPA that could not be fetched this session; its museum adoption is documented third-party (**reported**, [Illinois Museums blog](https://www.illinoismuseums.org/Blogs/13546474)).

**Pattern extracted:** for a family antique archive the right register is "private museum catalog": photography is the hero; typography does the aging (serif display accents, tabular/mono numerals for dates and money); neutral warm-paper palette; statuses rendered as small caps / stamped labels; zero marketing noise. The *admin* surfaces (filters, forms, logs) should stay as quiet Polaris-style chrome so the objects carry the personality.

### 1.7 Navigation models observed

- **eBay Seller Hub** uses a long top tab row — Overview, Orders, Listings, Marketing, Advertising, Store, Performance, Payments, Research, Reports — with Overview as the landing tab (**verified**, [eBay: Seller Hub](https://export.ebay.com/en/services-tools/seller-hub)). It works for eBay because each tab is a workspace for a whole staff role; a two-person family app has no role that maps to ten tabs.
- **Etsy Shop Manager** uses a left sidebar over a module dashboard (**reported**, [SellingOS guide](https://sellingos.com/etsy-shop-manager-complete-guide)).
- **Shopify admin** is a left-nav back office ("a back office tool for running your business' operations and logistics", **verified**, [Shopify admin overview](https://help.shopify.com/en/manual/shopify-admin)) whose Home page is the one surfaced summary — i.e. even products with deep navigation still funnel the daily visit through one home.
- **Sortly** organizes everything under folder trees + search, with items as the universal unit (**reported** from [Sortly folders](https://www.sortly.com/features/folders); its photo and custom-field pages were fetched and verified).

**Pattern extracted:** for Antiques, three or four top-level destinations (Catalog, Sale log, Channels, Settings) with Catalog-as-home is the right scale; anything beyond five destinations on mobile violates the M3 navigation-bar guidance ("three to five destinations", **verified**, [M3](https://m3.material.io/components/navigation-bar/guidelines)). Auxiliary pages (export-clearance checklist, admin settings) belong under Settings, not in the top bar.

### 1.8 What could NOT be verified (honesty section)

- **Mobbin**: multiple fetch attempts (mobbin.com, /browse, /browse/android/apps) returned only a client-side rendered shell — title, nav, "Log in / Join for free" — with **no browsable content without an account**; it also has no free public collections API I could reach. No Mobbin screenshots or claims in this document are from Mobbin; nothing is cited to it. (**verified blocked** — do not trust any third-party paraphrase of Mobbin content either.)
- **Polaris pattern page bodies**: the two pattern pages' official descriptions were verified, but the full body text was truncated in fetching; structural claims about title bars/tabs are paraphrase of the pattern docs, marked accordingly.
- **Etsy dashboard module names** (the full module list beyond the verified intro sentence) and **eBay tasks-vs-modules release notes** were only available as search snippets (**reported**).
- **help.shopify.com admin Home article** was fetched successfully, but eBay's main help site (ebay.com/help) is behind a bot-check; eBay claims rely on export.ebay.com (official eBay) plus the cited help URL found via search.
- CatalogIt product structure could not be fetched directly.

---

## 2. Three named design options for the Antiques facelift

All options keep: Next.js, current data model (items, lifecycle states, listings/packages, logs), English UI, camera capture from Android phone browser. They differ in *what the home page is* and *how the item page is organized*. They also all share a common item-page skeleton (photo hero + status header + grouped sections), because no examined product keeps ten coequal cards on a record; the genuine fork between the options is the home page, and the option name reflects it.

---

### Option A — "The Ledger" (item-dossier / record-centric) — RECOMMENDED

**Concept (one line):** The app is the family's private catalog: home is the beautiful, searchable photo-ledger of items (with a slim "Needs attention" strip), and each item is a museum-grade dossier — photo hero + status header, with everything else organized into a few labeled tabs.

**Modeled on:** Polaris "resource index + resource details" two-pattern model (**verified**, [index](https://polaris.shopify.com/patterns/resource-index-layout), [details](https://polaris.shopify.com/patterns/resource-details-layout)); Sortly's photo-forward records and per-item photo sets (**verified**, [Sortly](https://www.sortly.com/features/photos)); PastPerfect's sober catalog record (fields incl. Condition, Status, Home Location) (**reported**, [PastPerfect](https://museumsoftware.com/WebHelp/Frontmatter/PP5-Introduction.html)); 1stDibs/Vinterior photography-led presentation (**verified** tone, [1stdibs](https://www.1stdibs.com); **reported**, [vinterior.co](https://www.vinterior.co)). Attention strip modeled on Shopify Home's order-tasks block (**verified**, [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)).

**(a) Home page (desktop):**

```
+--------------------------------------------------------------------------------------+
| ANTIOUES · family archive            [ Catalog ]  Sale log  Channels  Settings        |
+--------------------------------------------------------------------------------------+
| Search items..............................[ ]   + Add item (camera on phone note)   |
| [All] [Draft 4] [Cataloged 12] [Listed 9] [Reserved 1] [Sold 7] [Shipped 11]         |
+--------------------------------------------------------------------------------------+
| NEEDS ATTENTION (derived, dismissible rows — Shopify Home order-tasks pattern)        |
|  · 4 drafts have photos but no description            -> open list                   |
|  · 9 listed items never posted to any channel         -> open list                   |
|  · 1 reserved item not yet marked sold                -> open item                   |
|  · 2 sold items awaiting shipment                     -> open list                   |
+--------------------------------------------------------------------------------------+
| |photo| Jati cabinet, 1920s      Cataloged   Listed on: eBay, FB Group   Rp 4.5 jt   |
| |photo| Teak sideboard ...        Listed     eBay · Instagram                ...    |
| |photo| ...                        (grid rows or cards; photo always first)           |
+--------------------------------------------------------------------------------------+
```

**(b) Item page (desktop):**

```
+--------------------------------------------------------------------------------------+
| <- Back to catalog     Jati cabinet, 1920s         [CATALOGED]   (status = stamp)     |
| /photos 6 | cost basis recorded | export: SKBCB pending          [ Add to listing ]  |
+--------------------------------------------------------------------------------------+
| |  HERO PHOTO (carousel)  |   Record | Sale | Marketing | Shipping & export | History|
| |                         |  ----------------------------------------------------  |
| |  thumbs 1..6            |  RECORD (open by default — the family's core record)   |
| |                         |   Category · Materials · Dimensions · Age estimate     |
| |                         |   Condition [+]   Provenance [story, inherited from…]  |
| |                         |   Photos (6) — "add photo" always visible              |
| |                         |  (Sale tab: comparables, valuation, listing packages)  |
| |                         |  (Marketing: channel log w/ type-ahead, social drafts) |
| |                         |  (Shipping & export: checklist, certificate)           |
| |                         |  (History: lifecycle + posting log, newest first)      |
+--------------------------------------------------------------------------------------+
```

**Phone layout note:** home = search + filter chips (horizontal scroll) + the same list, single column, photo-left; "Needs attention" collapses to a small banner with count -> tap to expand. Item page = photo carousel at top, status chip, then the same tabs as horizontally scrollable chips; all tap targets >= 44pt ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/buttons)); bottom navigation with 3–4 destinations (Catalog, Add, Sale log, More) per [M3 navigation bar](https://m3.material.io/components/navigation-bar/guidelines). Add-item = camera first, creating a Draft immediately (Mercari "Save draft" model, **verified**).

**Navigation model:** flat — Catalog is home; the four auxiliary areas (Sale log, Channels, Settings/admin) are top-level; item page always reachable in one tap; "Back to catalog" preserved (Polaris pattern behavior).

**What changes in flow vs today:** item page goes from 10 coequal cards to hero + 5 tabs (Record first, because cataloging is the family's core act); home gains a derived attention strip and filter chips become the status vocabulary; everything else (data, fields, logs) is unchanged.

**Pros for this family:** matches the reframe (a records archive, not a sales machine); Catalogers' capture flow unchanged and faster to reach; Owner's marketing/sale state visible per item without scrolling; progressively disclosed item page fixes the long-scroll problem within NN/g's two-level rule (**verified**, [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)); visual pass has an obvious canvas (photo hero, paper background, serif accents).
**Cons:** tab structure must be chosen well or Owner loses "one glance = everything" (mitigate: status/flags summary line under the title); attention strip must stay small (max ~4 rows) to avoid Shopify's 15-module sprawl.
**Effort/risk:** Medium. Mostly information-architecture restructuring + new derived-count queries; no new backend concepts. Low risk of losing current features (all existing cards map to a tab).

---

### Option B — "The Cockpit" (attention-first work queue)

**Concept (one line):** Home is a work queue — "what needs recording next" grouped by stage, like Shopify Home's order tasks — and the catalog is one level down.

**Modeled on:** Shopify Home ("information about daily tasks, the next steps you need to take with your orders…") (**verified**, [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)); eBay Seller Hub Overview (Tasks/Orders/Listings/Feedback summary + tailorable modules) (**verified**, [eBay](https://export.ebay.com/en/services-tools/seller-hub)); Etsy dashboard "updates, reminders, and other resources" (**verified**, [Etsy](https://help.etsy.com/hc/en-us/articles/360000343908-How-to-Use-Your-Dashboard-to-Manage-Your-Shop)).

**(a) Home page (desktop):**

```
+--------------------------------------------------------------------------------------+
| ANTIOUES                 [ Today ]  Catalog  Sale log  Channels  Settings             |
+--------------------------------------------------------------------------------------+
|  Rp 38,2 jt catalog value | 47 items | 9 listed | 7 sold this quarter   (metrics strip)|
+--------------------------------------------------------------------------------------+
| CAPTURE (2)      "2 photo batches waiting for details"      [ open capture inbox ]   |
| CATALOG (4)      "4 drafts missing condition or provenance" [ start cataloging ]     |
| LIST (3)         "3 cataloged items never put on a marketplace" [ prepare listings ]  |
| MARKET (9)       "9 listed items with no posts yet"         [ open marketing queue ] |
| SELL/SHIP (3)    "1 reserved, 2 sold-not-shipped"           [ open sale follow-up ]  |
+--------------------------------------------------------------------------------------+
| Recently touched: |photo| cabinet · |photo| sideboard · |photo| bowl                |
+--------------------------------------------------------------------------------------+
```

**(b) Item page (desktop):** same dossier as Option A (this option's difference is the home + entry points, not the item page).

**Phone layout note:** the queue becomes a stack of stage cards with counts; "Add" and each stage jump straight to a filtered list. Metrics strip shrinks to one line.

**Navigation model:** Today (queue) is home; Catalog, Sale log, Channels, Settings are peers. Item page reached via queue rows or Catalog.

**What changes in flow vs today:** adds a derived task engine (stage + completeness rules) and makes "Today" the landing page; cataloging entry becomes queue-driven.

**Pros:** strongest daily-momentum tool for the Owner (always knows the next action — Shopify's whole model, **verified**); makes the marketing/selling stage visible, which today is buried mid-scroll; queue rows are great phone ergonomics.
**Cons for this family:** a task engine is real backend work (rules, dedup, dismissal state); risk of dashboard noise — eBay needed *15 tailorable modules* to get this right (**verified**), and a 2-person family does not have time to tune modules; Catalogers (capture-only) are served worse than in A; the reframe says *record-keeping*, not *task management* — a cockpit can over-push "you must do X" energy onto a family archive.
**Effort/risk:** Medium-high (task derivation + dismissal UX). Low feature-loss risk, but highest risk of feeling like "another admin app" rather than a family archive.

---

### Option C — "The Wall" (pipeline/board-first)

**Concept (one line):** Home is a kanban wall of item thumbnails by lifecycle stage (Draft → Cataloged → Listed → Reserved → Sold → Shipped); stages are columns, progress is visible at a glance.

**Modeled on:** Notion inventory board views grouped by status (**reported**, [grizzlytemplates](https://www.grizzlytemplates.com/blog/how-to-set-up-a-notion-database-for-your-inventory-management)); Catawiki's explicit lot statuses (Draft/Submitted/Planned) as the vocabulary (**reported**, [Catawiki](https://www.catawiki.com/en/help/most-asked-questions-of-sellers/what-do-the-different-lot-statuses-mean)); Airtable's multi-view status databases (**reported**, [Airtable](https://www.airtable.com/templates/asset-tracker/expRq0Ojhi6y8svcV)).

**(a) Home page (desktop):**

```
+--------------------------------------------------------------------------------------+
| ANTIOUES           [ Wall ]  List view  Sale log  Channels  Settings    + Add item   |
+--------------------------------------------------------------------------------------+
| DRAFT(4)   | CATALOGED(12)| LISTED(9)  | RESERVED(1)| SOLD(7)    | SHIPPED(11)        |
| |photo|    | |photo|       | |photo|    | |photo|    | |photo|    | |photo|            |
| |photo|    | |photo|       | |photo|    |            | |photo|    | |photo|            |
| |photo|    | |photo|       | |photo|    |            | |photo|    | |photo|            |
|   ...      |   ...         |   ...      |            |   ...      |   ...              |
| (drag cards between columns; click card -> item dossier)                             |
+--------------------------------------------------------------------------------------+
```

**(b) Item page (desktop):** same dossier as Option A.

**Phone layout note:** board collapses to one column per screen with a stage switcher (swipe or segmented control); drag-and-drop is impractical on a phone browser, so stage changes happen via buttons on the item page.

**Navigation model:** Wall is home; a list view kept as a peer (needed for search); item page from card click.

**What changes in flow vs today:** adds drag-to-advance as the primary stage-change gesture; list becomes secondary.

**Pros:** the lifecycle is instantly visible — "which stage, how many" answered in one glance (the Owner's reframe literally asks "which is already in marketplace and what stage"); genuinely nice on a big desktop monitor for ~40–100 items; board view is a cheap add on top of the existing filter query.
**Cons:** **against the documented evidence for this product class** — no unique-item product (eBay, Etsy, Catawiki, Sortly, PastPerfect) leads with a board; they use filterable lists with status labels (findings 1.3). Phone ergonomics are poor for the primary capture users (family catalogers never touch the wall); kanban drag adds gesture/permission complexity in a mobile browser; a 6-column wall with hundreds of archived (Shipped) items goes stale; NN/g card guidance warns cards are weak for scanning/comparison (**verified**, [NN/g cards](https://www.nngroup.com/articles/cards-component)) — a wall of photo cards optimizes the wrong moment (the family mostly *searches for a specific remembered object*, or *works one item through*).
**Effort/risk:** Medium (board UI + drag interactions, mobile fallback). Medium feature-loss risk: if the board becomes home, search/cataloging speed — today's strength — is demoted; phone users effectively get a different app.

---

## 3. Comparison table

| Axis | A — The Ledger (dossier-first) | B — The Cockpit (queue-first) | C — The Wall (board-first) |
|---|---|---|---|
| Phone ergonomics (family capture) | Excellent: list + camera-first add, bottom nav, 44pt targets | Good: queue stack works, but capture is one hop deeper than list | Poor–medium: board unusable for drag; needs a separate phone mode |
| Cataloging speed (Catalogers) | Excellent: Catalog is home, capture -> draft in list immediately | Medium: capture reachable but "Today" noise first | Medium: hidden behind board -> list-view switch |
| Marketing/selling flow visibility (Owner) | Good: status + attention rows + per-item Marketing tab | Excellent: dedicated MARKET stage in the queue | Good: LISTED/SOLD columns show state, not next actions |
| Effort to build | Medium (IA restructure, tabs, derived counts) | Medium-high (task engine + dismissal state + metrics) | Medium (board UI + drag + mobile fallback) |
| Risk of losing current features | Low (all cards map to tabs; list preserved) | Low (list preserved; queue is additive) | Medium (search demoted; phone flow diverges) |
| Fits "family records dashboard" reframe | Strong — archive with a conscience | Medium — leans back toward "seller tool" energy | Medium — process view, not record view |
| Evidence alignment | Polaris resource-index/details; Sortly; PastPerfect; NN/g progressive disclosure | Shopify Home; eBay Seller Hub; Etsy dashboard | Notion/Airtable boards; contradicted by dedicated unique-item products |

---

## 4. Recommendation

**Adopt Option A ("The Ledger") as the pass-1 (wireframe/flow) target, borrowing one element from Option B; reject Option C as a home page (keep a board only as an optional Owner view later, if ever).**

Reasoning, grounded in the findings:

1. **The reframe decides it.** The Owner described "a dashboard for the family, to catalogue and records." Option A's home *is* the catalog — the records themselves, photo-first — with a thin derived "Needs attention" strip supplying the dashboard function. Option B inverts that into a task manager (merchant-tool energy the Owner explicitly stepped away from), and Option C turns records into process decoration.
2. **The two-pattern structure is the industry's answer to Antiques' exact screens.** Polaris — the most thoroughly documented admin design system — models everything as a filterable resource index plus a status-in-title resource detail (**verified** pattern descriptions). Antiques already has both; the facelift is mostly *aligning the item page to the dossier pattern* (hero photo + status header + a few tabs) and *adding derived attention rows to the index*.
3. **Progressive disclosure fixes the 10-card stack within its documented limits.** NN/g: disclose everything frequently needed up front; two levels, not three (**verified**). Record (identity, category, condition, provenance, photos) is the frequent layer — everything else (sale, marketing, shipping/export, history) is genuinely "rare occasions" per tab. The status/flags summary line under the item title preserves the Owner's glanceability without keeping ten cards open.
4. **Capture stays camera-first and loses nothing.** Poshmark (tap sell -> photo -> details, 16 photos) and Mercari (12 photos, "Save draft") **verified** the pattern; Sortly **verified** photo-per-item as the record's center of gravity on mobile. A's phone home (search + chips + list, bottom nav, 44pt/48dp targets) keeps the Catalogers' two-tap habit and makes drafts a visible state.
5. **Open channels, closed lifecycle.** Following Sortly's user-defined fields (**verified**) vs eBay's hardcoded self-channels (**verified**), pass 1 should introduce a `channels` concept (name + kind + optional URL, type-ahead from history) and a per-item posting log — while the six lifecycle states stay fixed, matching every comparable product.
6. **Pass 2 (beautify) gets a clear brief from the antiques/premium evidence:** photography as hero on warm-neutral paper grounds, serif display accents for headings and item names, tabular numerals for money/dates, small-caps status "stamps" (Catawiki-style, **reported**), quiet Polaris-style chrome for forms and filters, zero promotional elements. 1stDibs/Vinterior prove the register; PastPerfect proves the archival sobriety; the combination is what a family archive should feel proud of.

Sequencing suggestion for pass 1: (1) item-page dossier restructure + status header, (2) home attention strip + status filter chips with counts, (3) channels/posting-log data model, (4) phone bottom-nav + capture-to-draft tuning. Pass 2 then applies the visual language on top of this IA with no structural rework.

---

## 5. Sources

**Design systems / UX authorities**
- Shopify Polaris — patterns (resource index / resource details): https://polaris.shopify.com/patterns/resource-index-layout · https://polaris.shopify.com/patterns/resource-details-layout · https://polaris.shopify.com
- Shopify admin & Home page: https://help.shopify.com/en/manual/shopify-admin · https://help.shopify.com/en/manual/shopify-admin/shopify-home
- Nielsen Norman Group — progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group — cards component: https://www.nngroup.com/articles/cards-component
- Nielsen Norman Group — dashboards/preattentive: https://www.nngroup.com/articles/dashboards-preattentive (reported)
- Nielsen Norman Group — complex applications: https://www.nngroup.com/articles/complex-application-design (reported)
- Apple HIG — Buttons (44x44pt hit region): https://developer.apple.com/design/human-interface-guidelines/buttons
- Material 3 — Navigation bar: https://m3.material.io/components/navigation-bar/guidelines · M2 bottom navigation: https://m2.material.io/components/bottom-navigation · M3 accessible design (48dp): https://m3.material.io/foundations/accessible-design/overview (reported)

**Seller/collection products**
- eBay Seller Hub (official export help): https://export.ebay.com/en/services-tools/seller-hub · https://export.ebay.com/en/first-steps/how-to-create-seller-account · https://export.ebay.com/en/resources/seller-news/releases-archive/ebay-fall-2020-update/listing-promoting (reported) · https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095 (reported)
- Etsy Shop Manager dashboard: https://help.etsy.com/hc/en-us/articles/360000343908-How-to-Use-Your-Dashboard-to-Manage-Your-Shop · https://sellingos.com/etsy-shop-manager-complete-guide (reported)
- Mercari listing guide: https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing
- Poshmark listing guide: https://poshmark.com/posh_guide/how_to_list_item
- Depop App Store listing: https://apps.apple.com/ve/app/depop-buy-sell-clothes/id518684914 (reported)
- Catawiki seller help & lot statuses: https://www.catawiki.com/en/help/seller · https://www.catawiki.com/en/help/most-asked-questions-of-sellers/what-do-the-different-lot-statuses-mean (reported) · https://www.catawiki.com/en/stories/5711-7-tips-to-increase-your-performance-as-a-catawiki-seller (reported)
- Sortly: https://www.sortly.com/features/custom-fields · https://www.sortly.com/features/photos · https://www.sortly.com/features/folders
- PastPerfect (museum CMS): https://museumsoftware.com/WebHelp/Frontmatter/PP5-Introduction.html · https://museumsoftware.com/WebHelp/Chapters/PP5-6a.htm (reported)
- Airtable / Notion templates: https://www.airtable.com/templates/asset-tracker/expRq0Ojhi6y8svcV · https://www.airtable.com/templates/inventory-tracker/expDrHGuyjSQlrKTq · https://www.notion.com/templates/category/inventory-management · https://www.grizzlytemplates.com/blog/how-to-set-up-a-notion-database-for-your-inventory-management (reported)

**Antiques/premium visual register**
- 1stDibs: https://www.1stdibs.com · https://www.1stdibs.com/introspective-magazine/ (reported)
- Vinterior: https://www.vinterior.co (reported)
- CatalogIt (family/collection cataloging, museum adoption): https://www.illinoismuseums.org/Blogs/13546474 (reported; product site could not be fetched)

**Attempted but inaccessible**
- Mobbin (https://mobbin.com, /browse): client-side rendered shell only; no content reachable without login. No Mobbin-derived claims appear in this document.
