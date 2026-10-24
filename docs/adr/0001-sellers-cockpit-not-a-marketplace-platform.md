# Seller's cockpit, not a marketplace platform

The family needs to sell inherited antiques to international buyers, but building a
marketplace *platform* (buyer accounts, payments, escrow, fraud, liability) is a startup,
not a tool — so Antiques is a **seller's cockpit**: buyers never use this app. The app
manages Items, Valuations, Listing Drafts, and shipments, and sellers copy-paste or
publish those drafts to external Marketplaces (eBay, Etsy, ...) where the actual
transaction happens.

## Considered Options

- **Build a marketplace platform** — rejected: enormous scope (payments, multi-user
  trust, legal liability) inappropriate for a first family project; the value is in the
  family's inventory, not in hosting a venue.
- **Seller's cockpit** (chosen) — every feature serves the family; marketplaces are
  integration targets, not competitors.

## Consequences

- No buyer accounts, no payment processing, no escrow — ever, unless this ADR is
  superseded.
- Sales data (what sold, for how much) must flow *back* into the app manually or via
  later marketplace-API work, since transactions happen outside it.
