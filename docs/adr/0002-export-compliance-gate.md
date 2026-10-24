# Export-compliance gate for international listings

Indonesian law (UU 11/2010) treats any object 50+ years old as suspected cultural
property (*cagar budaya*); exporting one without an SKBCB certificate risks 6 months to
10 years imprisonment and fines up to Rp 1.5B, and no carrier arranges the certificate.
Therefore the app **enforces** compliance: every Item carries a "50+ years?" flag
(default yes for this collection), and a flagged Item **cannot be Listed internationally
until an SKBCB certificate number and scan are recorded on it**. Domestic channels are
unaffected.

## Consequences

- The lifecycle state machine blocks Draft→Listed for flagged Items without recorded
  Export Clearance (SKBCB); the gate is a core rule, not an optional field.
- The family should start the SKBCB assessment process for Items they intend to sell
  abroad early — the app tracks certificate status, it cannot obtain one.
- Shipping costs/insurance (DHL 1–2% of declared value, etc.) are separate from this
  gate; see `.scratch/research/export-and-forwarders.md` for the legal and carrier
  research behind this decision.
