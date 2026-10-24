# 01: Scaffold & spine

**What to build:** A deployed, logged-in skeleton of the seller's cockpit: the family signs in with email/password (no public signup; the Owner invites accounts), Owner and Cataloger roles are enforced on the server, and the test harness is wired to the Server Actions seam against a real test database — proven by one example action test.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] Next.js + TypeScript app with PostgreSQL via Prisma, Tailwind + shadcn/ui, deployed to free-tier hosting on a public URL *(code is deploy-ready; the deploy itself needs the Owner's Vercel + Neon accounts — see README "Deploy")*
- [x] Next.js + TypeScript app with PostgreSQL via Prisma, Tailwind + shadcn/ui
- [x] Owner can sign in and see an empty catalog home page
- [x] Owner can invite a Cataloger account; the Cataloger can sign in
- [x] A Cataloger attempting an Owner-only action is rejected by the server (not merely hidden in the UI)
- [x] Test harness runs an example test through the Server Actions seam against a real test database
- [x] The repo documents how to run the app, run the tests, and deploy

## Comments

**2026-10-24 (agent):** Implemented. Commits `9e1a012` (scaffold & spine) and `e4a079d` (review fixes) on `main`.

- Stack as spec'd, with versions pinned: Next.js 16.4.3, React 19, Prisma **7.10.1** (npm's `latest` tag is an 8.0 release candidate — deliberately avoided), Tailwind 4 + shadcn/ui, Vitest 5. Postgres runs in Docker (`docker compose up -d` creates `antiques_dev` + `antiques_test`).
- Auth: scrypt password hashing (node:crypto), DB sessions (httpOnly cookie holds a random token; DB stores its SHA-256), `requireOwner()` guard throws `ForbiddenError` inside Owner-only Server Actions. No public signup; first Owner comes from `npm run db:seed`; Owner invites Catalogers from the home page by setting a starting password (no email infrastructure in v1, documented in README).
- Tests: 9 tests in `src/lib/auth/actions.test.ts` call the Server Actions directly against the real `antiques_test` database (migrations applied in the vitest global setup). Only mocks: Next.js transport (cookies/redirect/revalidatePath). Covers every ticket criterion including the Cataloger-rejected-by-server case.
- Verified in a real browser against the production build: Owner signs in → empty catalog home; invite flow → Cataloger signs in and sees no invite panel.
- Typecheck, lint, build all clean.

**Remaining for the human:** follow README "Deploy (Vercel + Neon)" — create the two free-tier accounts, set env vars, run `db:deploy` + `db:seed` against the Neon URL, tick the first checkbox above.

**Review notes (deferred, not defects):**
- Glossary gap: the login model is `User`, but GLOSSARY.md only defines Owner/Cataloger ("family login") — worth a `/domain-modeling` pass to glossarize the shared account concept before ticket 02 grows more domain models.
- Spec's "English UI strings written i18n-ready" is satisfied only trivially (few strings, hardcoded) — real i18n scaffolding should land as its own small ticket.
- Timing-equalization on unknown-email sign-in uses a dummy scrypt hash (fixed in `e4a079d`); expired-session rows are deleted lazily on return (acceptable).
