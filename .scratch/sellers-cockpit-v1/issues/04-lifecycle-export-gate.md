# 04: Lifecycle & export gate

**What to build:** The enforced Item lifecycle — Draft → Cataloged → Listed → Reserved → Sold → Shipped — with invalid transitions rejected on the server, the export-compliance gate from ADR-0002 (an Item flagged 50+ years cannot be Listed internationally until its SKBCB certificate number and scan are recorded; domestic channels unaffected), and a checklist of Items still needing clearance.

**Blocked by:** 02 (Items and their 50+ flag must exist).

**Status:** ready-for-agent

- [ ] The full state machine is enforced server-side: valid transitions work, invalid ones are rejected
- [ ] An SKBCB certificate number and a scan of the certificate can be recorded on an Item
- [ ] With the 50+ flag set and no SKBCB recorded, transitioning to Listed on an international Marketplace is blocked; after recording the certificate it is allowed
- [ ] Listing on a domestic (Indonesian) channel is never blocked by the gate
- [ ] A needs-clearance checklist shows flagged Items without a recorded SKBCB
- [ ] Seam tests cover: gate blocks and then allows, invalid transitions rejected, domestic unaffected, checklist contents
