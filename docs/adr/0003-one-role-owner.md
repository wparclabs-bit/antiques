# One role: every account is an Owner

The original spec (stories 9 and 35–37) defined two roles: the Owner with full
rights and a restricted Cataloger for family members who help capture Items but
must never see cost prices or record sales. The role was enforced on the server
everywhere (reads returned null, writes threw) and drove most of the
pricing/selling UI's conditional rendering.

On 2026-10-24, during the ticket-10 (UI facelift) scoping grill, the Owner
decided otherwise: **"no need role, all owner."** The family are all full,
trusted members; every account invited from now on sees everything — cost
prices, sales, rates, settings, invites. The Cataloger role and all its
server-side gating are removed.

## Consequences

- The `User.role` column and the `Role` enum are dropped; the migration promotes
  any existing account to Owner before dropping the column, so no record is lost.
- The invite form invites a family member (full rights) — no role question.
- All server-side role gates (`user.role !== "OWNER"` reads returning null,
  `requireOwner` throwing) collapse to plain signed-in checks (`requireUser`).
  The distinction between "must be signed in" and "must be the Owner" no longer
  exists; signing in IS being the Owner.
- Seam tests that asserted Cataloger rejection/null reads are removed with the
  gates; signed-out rejection tests remain — authentication still gates
  everything (buyers never use this app; ADR-0001).
- Spec stories 9 and 35–37 are superseded in the part that defines the
  Cataloger; story 37 (Catalogers capture items) is absorbed into "every family
  member can do everything". The spec file itself is left as the historical
  record; this ADR is binding.
- The GLOSSARY.md Cataloger entry is removed; "Owner" now simply means a family
  login.
- Reintroducing a restricted role later (e.g. for non-family helpers) would be a
  new ADR — the git history of this one documents exactly what was removed.
