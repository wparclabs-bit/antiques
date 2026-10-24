# 04: Lifecycle & export gate

**What to build:** The enforced Item lifecycle — Draft → Cataloged → Listed → Reserved → Sold → Shipped — with invalid transitions rejected on the server, the export-compliance gate from ADR-0002 (an Item flagged 50+ years cannot be Listed internationally until its SKBCB certificate number and scan are recorded; domestic channels unaffected), and a checklist of Items still needing clearance.

**Blocked by:** 02 (Items and their 50+ flag must exist).

**Status:** ready-for-agent

- [x] The full state machine is enforced server-side: valid transitions work, invalid ones are rejected
- [x] An SKBCB certificate number and a scan of the certificate can be recorded on an Item
- [x] With the 50+ flag set and no SKBCB recorded, transitioning to Listed on an international Marketplace is blocked; after recording the certificate it is allowed
- [x] Listing on a domestic (Indonesian) channel is never blocked by the gate
- [x] A needs-clearance checklist shows flagged Items without a recorded SKBCB
- [x] Seam tests cover: gate blocks and then allows, invalid transitions rejected, domestic unaffected, checklist contents

## Comments

2026-10-24 — Implemented (commit follows this ticket file's update).

- Lifecycle logic lives in `src/lib/lifecycle/` (`lifecycle.ts` = pure transition table + gate predicate; `actions.ts` = the seam). `src/lib/catalog/lifecycle.ts` moved there.
- The chain is strictly linear: each state has exactly one successor, no skips, no going back. `transitionItem` (Owner-only) guards Listed → Reserved → Sold → Shipped and takes a `channel` (domestic/international) when entering Listed; Draft → Cataloged keeps its own completeness-gated action (`catalogItem`), and `transitionItem` refuses `to=CATALOGED` so that check cannot be bypassed.
- The gate requires the certificate number **and** scan together (ADR-0002: clearance must be provable). `recordSkbcb` stores both; the scan is a Cloudinary original in `antiques/certificates`, and a replacement scan cleans up the old original.
- Needs-clearance checklist: `/clearance` page (linked from the home header), powered by `listNeedsClearance()`.
- Decisions worth knowing: selling transitions are Owner-only server-side (GLOSSARY: a Cataloger never records sales); SKBCB recording is allowed for both roles (it is cataloging evidence, not finance).
- Open question for the Owner: the checklist is literal (flagged + missing pair, regardless of state), so a flagged Item sold and shipped domestically stays on the list forever. If that gets noisy, filtering out SOLD/SHIPPED is a one-line change — say the word.

Review (standards + spec axes) passed; the unrequested `fiftyYearsOld` index it flagged was removed. All 64 seam tests green; typecheck, lint, and `next build` clean.
