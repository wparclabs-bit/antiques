# Antiques — Seller's Cockpit

A private web application for an Indonesian family selling inherited antiques
abroad: catalog every Item, price it with evidence, respect Indonesia's export
law (SKBCB), and produce ready-to-paste listings for eBay and Etsy. Buyers
never use this app — they buy on the external marketplaces.

This is ticket 01 of [`.scratch/sellers-cockpit-v1/`](.scratch/sellers-cockpit-v1/spec.md):
the signed-in skeleton — accounts, roles, and the test harness. Cataloging
arrives in ticket 02.

## Stack

- **Next.js 16** (App Router, TypeScript) — pages and Server Actions
- **PostgreSQL** via **Prisma 7** (driver-adapter setup with `@prisma/adapter-pg`)
- **Tailwind CSS 4** + **shadcn/ui** components
- **Vitest** — tests call the Server Actions layer directly against a real
  test database
- Local databases run in **Docker**; production targets Vercel + a managed
  Postgres (Neon)

## How accounts work

There is **no public signup**. The first **Owner** account is created by a seed
script. The Owner then invites **Catalogers** from the home page by setting a
starting password for them (the app sends no email). Both roles sign in with
email + password; roles are enforced on the server, not just hidden in the UI.

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
today; catalog, valuation, listing and shipping actions arrive in later
tickets). Tests call these functions directly against a real PostgreSQL test
database — no mocked app logic. The only mocks are Next.js runtime transport
(the browser cookie jar, page redirects, cache invalidation), because there is
no HTTP request in a test process.

The suite lives next to the code it tests (`src/lib/auth/actions.test.ts`) and
covers the ticket-01 acceptance criteria: sign-in, wrong-password rejection,
Owner invites a Cataloger, the Cataloger can sign in, **a Cataloger attempting
an Owner-only action is rejected by the server**, and sign-out.

Conventions for future tests follow `.scratch/sellers-cockpit-v1/spec.md`
("Testing Decisions"): drive external behavior through the seam, assert
observable outcomes, never inspect internal tables or private helpers.

## Deploy (Vercel + Neon, both free tier)

The repo is deploy-ready; the deploy itself needs your accounts.

1. **Database**: create a project at [neon.tech](https://neon.tech) (free
   tier). Copy the pooled connection string (it looks like
   `postgresql://...neon.tech/...?sslmode=require`).
2. **Repository**: push this repo to GitHub.
3. **Vercel**: import the repo at [vercel.com](https://vercel.com). Next.js is
   auto-detected; no build settings needed.
4. **Environment variables** (Vercel project → Settings → Environment
   Variables):
   - `DATABASE_URL` = the Neon connection string
   - `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_NAME` = the real
     Owner's sign-in details (choose a long random password)
5. **Deploy**. The build runs `prisma generate` automatically (via
   `postinstall`).
6. **Schema + Owner**: from your machine, with the Neon URL:
   ```bash
   DATABASE_URL="<neon-connection-string>" npm run db:deploy
   DATABASE_URL="<neon-connection-string>" npm run db:seed
   ```
7. Open the Vercel URL, sign in as the Owner, invite family Catalogers.

## Project layout

```
prisma/
  schema.prisma           # User (Owner|Cataloger), Session
  migrations/             # committed SQL migrations
  seed.ts                 # creates the first Owner (npm run db:seed)
src/
  app/
    login/                # sign-in page
    page.tsx              # home: empty catalog + Owner's invite panel
    invite-form.tsx       # client form -> inviteCataloger action
  proxy.ts                # HTTP-level redirect for signed-out visitors
  lib/
    db.ts                 # Prisma client singleton
    auth/
      actions.ts          # SIGN-IN SEAM: signIn, signOut, inviteCataloger
      session.ts          # session create/read/destroy + role guards
      password.ts         # scrypt hashing (node:crypto)
      errors.ts           # ForbiddenError
docker-compose.yml        # local PostgreSQL (dev + test databases)
vitest.config.ts          # test harness wired to the test database
```

## Domain language

See [`GLOSSARY.md`](GLOSSARY.md) for the project's vocabulary (Item, Owner,
Cataloger, Listing, Price Floor, SKBCB, …). Architecture decisions live in
[`docs/adr/`](docs/adr); the binding ones are ADR-0001 (seller's cockpit, not
a marketplace) and ADR-0002 (export-compliance gate).
