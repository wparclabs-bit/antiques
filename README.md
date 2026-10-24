# Antiques — Seller's Cockpit

A private web application for an Indonesian family selling inherited antiques
abroad: catalog every Item, price it with evidence, respect Indonesia's export
law (SKBCB), and produce ready-to-paste listings for eBay and Etsy. Buyers
never use this app — they buy on the external marketplaces.

This is ticket 02 of [`.scratch/sellers-cockpit-v1/`](.scratch/sellers-cockpit-v1/spec.md):
**catalog core** — recording Items in six categories with photos, the Draft →
Cataloged step, and a searchable Catalog with Inventory view. (Ticket 01 laid
the accounts, roles, and test harness.) Valuation arrives in ticket 03.

## Stack

- **Next.js 16** (App Router, TypeScript) — pages and Server Actions
- **PostgreSQL** via **Prisma 7** (driver-adapter setup with `@prisma/adapter-pg`)
- **Tailwind CSS 4** + **shadcn/ui** components
- **Cloudinary** — photo storage; marketplace-sized variants are derived
  URLs, not stored copies
- **Vitest** — tests call the Server Actions layer directly against a real
  test database
- Local databases run in **Docker**; production targets Vercel + a managed
  Postgres (Neon)

## How accounts work

There is **no public signup**. The first **Owner** account is created by a seed
script. The Owner then invites **Catalogers** from the home page by setting a
starting password for them (the app sends no email). Both roles sign in with
email + password; roles are enforced on the server, not just hidden in the UI.

## How items and photos work

Items are recorded at **Record an Item**. A record always saves (as a
**Draft**), even when incomplete — required attributes are only enforced when
you press **Mark as Cataloged** on the item page, which lists exactly what is
still missing. The **50+ years old** flag defaults to yes (export rules are
the safe assumption) and can be turned off per item.

Photos upload straight from the phone camera or gallery. Each original is
stored once in Cloudinary; every other size (catalog thumbnail, item display,
eBay 1600px, Etsy 2000px) is a **derived URL** of that original — nothing is
duplicated, and no binaries are stored in the database.

Photo storage needs a free [Cloudinary](https://cloudinary.com) account:

1. Create an account and open **Dashboard → Account Details**.
2. Copy `Cloud Name`, `API Key`, and `API Secret` into `.env` (see
   `.env.example`) — locally — and into the Vercel environment variables —
   in production.
3. Restart the app. Until then, recording items still works; attaching
   photos shows a clear error instead.

## Run the app (local development)

Prerequisites: Node.js 20+ and Docker Desktop.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env         # then edit if your ports/credentials differ

# 3. Start PostgreSQL (creates antiques_dev and antiques_test databases)
docker compose up -d

# 4. Create the database schema
npm run db:migrate

# 5. Create the first Owner account
npm run db:seed

# 6. Start the app
npm run dev
```

Open http://localhost:3000 and sign in with the seeded Owner:

- Email: `owner@antiques.local`
- Password: `antiques-owner-1` (from `SEED_OWNER_PASSWORD` in `.env`)

## Run the tests

The PostgreSQL container must be running (`docker compose up -d`); the test
suite applies migrations to the `antiques_test` database automatically at
startup.

```bash
npm test           # run once
npm run test:watch # re-run on file changes
```

What the tests cover and why: see [Testing](#testing) below.

## Other useful commands

| Command            | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `npm run typecheck`| TypeScript, no output means clean                   |
| `npm run lint`     | ESLint                                              |
| `npm run build`    | Production build                                    |
| `npm start`        | Serve the production build                          |
| `npm run db:deploy`| Apply committed migrations (used in production)     |

## Testing

The app's entire public interface is the **Server Actions layer** (`src/lib/auth/actions.ts`
and `src/lib/catalog/actions.ts`; valuation, listing and shipping actions
arrive in later tickets). Tests call these functions directly against a real
PostgreSQL test database — no mocked app logic. The only mocks are Next.js
runtime transport (the browser cookie jar, page redirects, cache invalidation,
shared via `src/test/browser-transport.ts`) and, in the photo tests, the
Cloudinary HTTP endpoint (stubbed `fetch` with documented response shapes).

Two suites, each next to the code it tests:

- `src/lib/auth/actions.test.ts` — ticket-01 criteria: sign-in, wrong-password
  rejection, Owner invites a Cataloger, the Cataloger can sign in, **a
  Cataloger attempting an Owner-only action is rejected by the server**, and
  sign-out.
- `src/lib/catalog/actions.test.ts` — ticket-02 criteria: one full record per
  category template, lenient Drafts (bad data rejected, gaps allowed),
  **cost basis hidden from Catalogers and settable only by the Owner**,
  Draft → Cataloged completeness gate, keyword/category/state search, the
  Catalog vs Inventory views, and photo upload/derivation/removal.

Test files run against one shared database, so they execute sequentially
(`fileParallelism: false` in `vitest.config.ts`).

Conventions for future tests follow `.scratch/sellers-cockpit-v1/spec.md`
("Testing Decisions"): drive external behavior through the seam, assert
observable outcomes, never inspect internal tables or private helpers.

## Deploy (Vercel + Neon, both free tier)

The repo is deploy-ready; the deploy itself needs your accounts.

1. **Database**: create a project at [neon.tech](https://neon.tech) (free
   tier). Copy the pooled connection string (it looks like
   `postgresql://...neon.tech/...?sslmode=require`).
2. **Photos**: create an account at [cloudinary.com](https://cloudinary.com)
   (free tier) and copy `Cloud Name`, `API Key`, `API Secret`.
3. **Repository**: push this repo to GitHub.
4. **Vercel**: import the repo at [vercel.com](https://vercel.com). Next.js is
   auto-detected; no build settings needed.
5. **Environment variables** (Vercel project → Settings → Environment
   Variables):
   - `DATABASE_URL` = the Neon connection string
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` =
     the Cloudinary values
   - `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_NAME` = the real
     Owner's sign-in details (choose a long random password)
6. **Deploy**. The build runs `prisma generate` automatically (via
   `postinstall`).
7. **Schema + Owner**: from your machine. The seed command below creates the
   real Owner's sign-in — pick your actual email and a long random password
   (they are never committed anywhere; they land in the Neon database):
   ```bash
   DATABASE_URL="<neon-connection-string>" \
   SEED_OWNER_EMAIL="<your-real-email>" \
   SEED_OWNER_PASSWORD="<long-random-password>" \
   SEED_OWNER_NAME="<your-name>" \
   npm run db:seed
   DATABASE_URL="<neon-connection-string>" npm run db:deploy
   ```
   (Run the seed first or second; both just need the Neon URL.)
8. Open the Vercel URL, sign in as the Owner, invite family Catalogers.

## Project layout

```
prisma/
  schema.prisma           # User (Owner|Cataloger), Session, Item, Photo
  migrations/             # committed SQL migrations
  seed.ts                 # creates the first Owner (npm run db:seed)
src/
  app/
    login/                # sign-in page
    page.tsx              # the Catalog: search, filters, Catalog/Inventory
    invite-form.tsx       # client form -> inviteCataloger action
    items/
      new/                # Record an Item
      item-form.tsx       # shared create/edit form (category-driven fields)
      [id]/               # item page: photos, attributes, cost basis, gate
      [id]/edit/          # edit form
  proxy.ts                # HTTP-level redirect for signed-out visitors
  lib/
    db.ts                 # Prisma client singleton
    auth/
      actions.ts          # sign-in seam: signIn, signOut, inviteCataloger
      session.ts          # session create/read/destroy + role guards
      password.ts         # scrypt hashing (node:crypto)
      errors.ts           # ForbiddenError
    catalog/
      actions.ts          # CATALOG SEAM: createItem, updateItem, getItem,
                          #   listItems, setCostBasis, catalogItem, addPhotos,
                          #   removePhoto
      categories.ts       # the six category templates (single source for
                          #   form + validation + detail page)
      validation.ts       # form parsing + Draft→Cataloged completeness
      lifecycle.ts        # allowed state transitions (Draft→Cataloged in v1)
      display.ts          # label/number helpers for pages
    photos/
      cloudinary.ts       # signed uploads, derived-variant URLs, guards
  test/
    browser-transport.ts  # shared Next.js transport mocks for the suites
docker-compose.yml        # local PostgreSQL (dev + test databases)
vitest.config.ts          # test harness wired to the test database
```

## Domain language

See [`GLOSSARY.md`](GLOSSARY.md) for the project's vocabulary (Item, Owner,
Cataloger, Listing, Price Floor, SKBCB, …). Architecture decisions live in
[`docs/adr/`](docs/adr); the binding ones are ADR-0001 (seller's cockpit, not
a marketplace) and ADR-0002 (export-compliance gate).
