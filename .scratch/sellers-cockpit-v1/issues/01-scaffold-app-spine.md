# 01: Scaffold & spine

**What to build:** A deployed, logged-in skeleton of the seller's cockpit: the family signs in with email/password (no public signup; the Owner invites accounts), Owner and Cataloger roles are enforced on the server, and the test harness is wired to the Server Actions seam against a real test database — proven by one example action test.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Next.js + TypeScript app with PostgreSQL via Prisma, Tailwind + shadcn/ui, deployed to free-tier hosting on a public URL
- [ ] Owner can sign in and see an empty catalog home page
- [ ] Owner can invite a Cataloger account; the Cataloger can sign in
- [ ] A Cataloger attempting an Owner-only action is rejected by the server (not merely hidden in the UI)
- [ ] Test harness runs an example test through the Server Actions seam against a real test database
- [ ] The repo documents how to run the app, run the tests, and deploy
