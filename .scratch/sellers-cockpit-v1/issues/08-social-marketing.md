# 08: Social marketing

**What to build:** Marketing an Item without a second writing job: from a Listing, generate platform-ready social drafts — Instagram caption with hashtags, Instagram story text, and a Facebook post — copy-ready in one action, plus a posting log recording where and when each Item was posted.

**Blocked by:** 06 (drafts are generated from Listings).

**Status:** ready-for-agent

- [x] From a Listing, an Instagram caption with hashtags, an Instagram story text, and a Facebook post are generated, assembled from the Item and Listing
- [x] Each draft is copy-ready in one action
- [x] Posting log entries can be recorded: Item, platform, date, link or notes
- [x] The posting history per Item is viewable
- [x] Seam tests cover draft content generation and posting-log recording

## Comments

2026-10-24 — Implemented (commit follows this ticket file's update).

- Drafts are generated, not stored — same model as the Listing Drafts (ticket 06). `src/lib/social/drafts.ts` assembles all three formats deterministically from the Item's own record (the same shared body the marketplace drafts paste: category details, 50+ age line, condition, provenance) and the Listing's offer (price, marketplace name). No AI anywhere, per the spec's draft-generator pattern.
- **Formats (golden-pinned, exact strings in `src/lib/social/actions.test.ts`):** the Instagram caption leads with the one-line opening (name — category, identifying summary — shared with Etsy's title shape), then "Offered at $X on Marketplace.", the item body, "Interested? Message us — the listing is on {marketplace}." (captions can't carry links), and hashtags. The story text stays to three short lines (name · identifying summary · price on marketplace). The Facebook post is the caption without hashtags, with a link-carrying call to action ("here or on {marketplace}"). Hashtags are deterministic: evergreen antique tags, category words plus an antique compound for single-word categories (#antiquefurniture), identifying values squashed (#early20thcentury), deduped, capped at 12.
- **Copy-ready in one action:** each platform's copy block is its labeled text plus a PHOTOS section at display size (1200px) — one button, everything a post needs. Social photos use the app's display variant, not a marketplace's sized bundle.
- Social drafts ride on each non-ended Listing in the `getListings` view and render under that listing's package in the Listings card (Owner-only, like all marketing reads/writes — spec stories 33–34 are Owner stories). Ended listings carry none, mirroring their marketplace package (ticket 06's rule).
- Posting log: a `SocialPost` row (migration `20261024124001_social_posting_log`) — Item, platform (free text; the form suggests the three drafted platforms plus Other), `postedOn`, optional link (must start http(s):// with a host) and notes. Shown on the item page as the Owner-only "Posting log" card, newest first (same-day entries read most-recent-recorded first); entries are removable (a mistyped entry must not stay) — a small extension the comparables card already models. The posting date shares the sale date's 14-hour future slack: the family records from UTC+7.
- Glossary: **Social Draft** and **Posting Log** added to GLOSSARY.md (the schema cites it).
- Reuse per the dedup precedent: `oneLineOpening`, `draftBody`, `photoBundleSection`, and a new `plainMoneyText` (nbsp-safe money) now live in `listings/drafts.ts` and are shared by the marketplace packages and the social drafts — marketplace golden output is byte-identical (suite green).

Review (standards + spec axes) passed; findings fixed: the glossary gained the two new terms (the schema's GLOSSARY.md citation had been dangling), the money formatter was deduplicated, and the listings view's ended/draft/social assembly was collapsed to one computation. Accepted as deliberate, not changed: ended-listing exclusion (ticket-06 rule), log-entry removal, photo bundles in social copy blocks (the "one action" reading), and the platform free-text option. All 111 seam tests green (11 new in the social suite); typecheck, lint, and `next build` clean.
