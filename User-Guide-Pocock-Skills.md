# User Guide: Matt Pocock's Agent Skills

A field manual for the 35 skills installed in this environment (from
[mattpocock/skills](https://github.com/mattpocock/skills), "Skills for Real Engineers").
It covers what each skill does, when to reach for it, the detailed steps each one runs,
and — in §12 — a team playbook mapping real development use cases to personas and skills.

> **Upstream note:** the GitHub repo also ships `implement-spec`, `retro`, `pr`, and
> `wait-what`, which are **not installed** in this environment. Everything else in this
> guide reflects the actual skill files on disk.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [How Invocation Works](#2-how-invocation-works)
3. [Step 0 — One-Time Setup](#3-step-0--one-time-setup)
4. [The Main Flow: Idea → Ship](#4-the-main-flow-idea--ship)
   - [grill-with-docs / grill-me / grilling](#41-grill-with-docs--grill-me--grilling)
   - [to-spec](#42-to-spec)
   - [to-tickets](#43-to-tickets)
   - [triage](#44-triage)
   - [implement](#45-implement)
   - [tdd](#46-tdd)
   - [code-review](#47-code-review)
5. [On-Ramps: Other Ways In](#5-on-ramps-other-ways-in)
   - [diagnosing-bugs](#51-diagnosing-bugs)
   - [wayfinder](#52-wayfinder)
6. [Detours & Helpers](#6-detours--helpers)
7. [Codebase Health & Design](#7-codebase-health--design)
8. [Understanding Existing Code](#8-understanding-existing-code)
9. [Session Management](#9-session-management)
10. [Learning & Meta Skills](#10-learning--meta-skills)
11. [Full Skill Inventory](#11-full-skill-inventory)
12. [Team Playbook: Personas & Use Cases](#12-team-playbook-personas--use-cases)
13. [Cheat Sheet: Which Skill When?](#13-cheat-sheet-which-skill-when)

---

## 1. The Big Picture

The collection is built around one **main flow** — taking a vague idea to shipped code —
plus **on-ramps** (other starting situations that merge onto it), **detours** (helpers you
drop into mid-flow), and a **vocabulary layer** that runs underneath everything.

```
                        ┌───────────────────────────────────────┐
                        │        THE MAIN FLOW: IDEA → SHIP      │
                        └───────────────────────────────────────┘

   ON-RAMPS                             MAIN FLOW
   ═════════                            ═════════
                                            ┌──────────────┐
   vague idea ────────────────────────────▶ │ 1. GRILL     │ /grill-with-docs
                                            └──────┬───────┘   (one unbroken
   bugs & requests piling up ──▶ /triage ────────┤    context window
                                                  │     for steps 1–3)
   something's broken ────▶ /diagnosing-bugs ─────┤
                                                  ▼
   huge foggy effort ─────▶ /wayfinder ──────┐  ┌──────────────┐
   (map clears, hands off)───────────────────┴─▶│ 2. SPEC      │ /to-spec
                                                 └──────┬───────┘
                                                        ▼
                    design question ──▶ /prototype ┐  ┌──────────────┐
                    (via /handoff out & back) ─────┴─▶│ 3. TICKETS   │ /to-tickets
                                                      └──────┬───────┘
                                                             │  fresh context
                                                             ▼  per ticket
                                                      ┌──────────────┐
                                                      │ 4. BUILD     │ /implement
                                                      │  (+ /tdd)    │ driving
                                                      └──────┬───────┘ /tdd
                                                             ▼
                                                      ┌──────────────┐
                                                      │ 5. REVIEW    │ /code-review
                                                      └──────────────┘ (two axes)
```

**Context hygiene rule** (from `ask-matt`): keep steps 1–3 in **one unbroken context
window** — don't `/clear` or `/compact` until after `/to-tickets`, so the grilling, spec,
and tickets all build on the same thinking. Then start each `/implement` **fresh**, working
only from the ticket. The limit is the *smart zone* (~150k tokens) — past it, models stop
reasoning sharply; compact at the nearest phase boundary instead of pushing on.

---

## 2. How Invocation Works

Skills split by who triggers them:

| Type | Triggered by | Character | Examples |
|---|---|---|---|
| **User-invoked** | You, explicitly (`/grill-me`) | Orchestrate a phase of work | `to-spec`, `implement`, `triage` |
| **Model-invoked** | The agent itself, when a situation matches | Reusable discipline, held under the main skills | `tdd`, `domain-modeling`, `code-review` |

A user-invoked skill may call model-invoked skills (e.g. `/implement` drives `/tdd` then
`/code-review`), but never another user-invoked one — *you* stay the orchestrator.

---

## 3. Step 0 — One-Time Setup

**`/setup-matt-pocock-skills`** — run once per repo before any engineering flow.

```
  ┌──────────────────────────── CONFIGURES ────────────────────────────┐
  │                                                                    │
  │  1. Issue tracker     GitHub / GitLab / local markdown / custom    │
  │  2. Triage labels     the five canonical roles (or your own)       │
  │  3. Domain doc layout single-context or multi-context              │
  │                                                                    │
  │  Writes:  AGENTS.md or CLAUDE.md  (## Agent skills block)          │
  │           docs/agents/issue-tracker.md                             │
  │           docs/agents/triage-labels.md                             │
  │           docs/agents/domain.md                                    │
  └────────────────────────────────────────────────────────────────────┘
```

**This repo (Antiques) is already configured:** local-markdown tracker (`.scratch/<feature>/`),
default triage labels, single-context docs. Every other skill reads these files — if one
tells you to "run `/setup-matt-pocock-skills`", it means it couldn't find them.

With the local tracker, tickets physically look like this:

```
   .scratch/<feature-slug>/
   ├── spec.md                      ← published by /to-spec
   └── issues/
       ├── 01-<slug>.md             ← one file per ticket, numbered in
       ├── 02-<slug>.md                dependency order (blockers first)
       └── 03-<slug>.md
```

---

## 4. The Main Flow: Idea → Ship

### 4.1 grill-with-docs / grill-me / grilling

**What it does:** a relentless interview that stress-tests your plan until you and the
agent reach genuine shared understanding. Nothing gets built during it — the output is a
*settled design*, not code.

There are three faces of the same interview:

| Skill | Stateful? | Writes docs? | Use when |
|---|---|---|---|
| `/grill-with-docs` | yes | yes — `GLOSSARY.md` + ADRs | **Working in a repo (always here)** |
| `/grill-me` | no | no | No working directory (a plan, a piece of writing) |
| `/grilling` | — | — | The raw primitive; called internally by `triage`, `wayfinder`, `improve-codebase-architecture` |

`grill-with-docs` = `grilling` + `domain-modeling`. If you're in a repo it is *strictly
better* than `grill-me`: same interview, plus a paper trail.

**How the interview runs:**

```
   ┌────────────────────────────────────────────────────────────┐
   │  The plan is a DESIGN TREE:                                │
   │                                                            │
   │              [root decision]                               │
   │             /      |       \                               │
   │        [sub-decision] [sub-decision] ...                   │
   │        /       \                                           │
   │   [leaf]     [leaf]                                        │
   └────────────────────────────────────────────────────────────┘

   Work it in ROUNDS:
     1. Compute the FRONTIER = every question whose prerequisites
        are already settled (askable NOW, without guessing).
     2. Ask the WHOLE frontier in one round, each numbered:

          ❓ **Q1** - **Title**: question body, maybe with choices
          ➡️ <recommended answer>        ← worded so "yes" accepts it

     3. Wait for your answers. Each answer settles a branch and
        pushes the frontier outward → recompute → next round.
     4. Done when the frontier is EMPTY: nothing left silently assumed.
```

Key disciplines baked into the primitive:

- **Facts are the agent's job; decisions are yours.** Anything the agent could look up
  (filesystem, docs), it dispatches a sub-agent for instead of asking you.
- **`grill-with-docs` writes as it goes:** fuzzy terms get pinned into `GLOSSARY.md`
  ("you keep saying *item* — the physical object or the listing?"), and genuinely
  hard-to-reverse trade-offs become ADRs in `docs/adr/`.
- The session ends only when the **frontier is empty** and you confirm shared understanding.

---

### 4.2 to-spec

**What it does:** turns the current conversation into a spec and publishes it to the
issue tracker. **No interview** — pure synthesis of what was already discussed in the grill.

**Steps it runs:**

1. **Explore the repo** (if not already explored). Use glossary vocabulary; respect ADRs.
2. **Sketch the test seams** — the boundaries where the feature will be tested.
   Prefer existing seams; use the *highest* seam possible; fewer is better (ideal: one).
   **It checks these with you before writing.**
3. **Write the spec** from the fixed template and publish it, already labelled
   `ready-for-agent` — specs from a grill need no further triage.

**Spec template:**

```
   ## Problem Statement        ← the problem, user's perspective
   ## Solution                 ← the solution, user's perspective
   ## User Stories             ← LONG numbered list:
   │                             "As an <actor>, I want <feature>, so that <benefit>"
   ## Implementation Decisions ← modules, interfaces, schema, API contracts...
   │                             (NO file paths or code snippets — they go stale)
   ## Testing Decisions        ← what makes a good test here, which modules, prior art
   ## Out of Scope             ← explicitly excluded
   ## Further Notes
```

---

### 4.3 to-tickets

**What it does:** breaks a spec (or plan, or conversation) into **tracer-bullet tickets** —
vertical slices with explicit blocking edges — and publishes them to the tracker.

**The vertical-slice rules:**

```
   ✅ A ticket cuts a narrow but COMPLETE path through EVERY layer:

        ┌───────────────────────────────────────┐
        │  schema ──▶ API ──▶ UI ──▶ tests      │   tracer bullet
        └───────────────────────────────────────┘   demoable on its own,
                                                    sized to ONE context window
   ❌ NOT a horizontal slice of one layer:

        [all schema]  [all API]  [all UI]          nothing works until the last one
```

**Steps it runs:**

1. **Gather context** — from the conversation, or fetch the spec/issue you pass in.
2. **Explore the codebase** — looking for *prefactoring* opportunities
   ("make the change easy, then make the easy change").
3. **Draft vertical slices** with blocking edges.
   **Wide-refactor exception:** a mechanical change with a huge blast radius (rename a
   column, retype a shared symbol) can't land green as one slice — sequence it as
   **expand → migrate in batches → contract**:
4. **Quiz you:** present the numbered breakdown (title / blocked-by / what it delivers)
   and ask: granularity right? edges right? merge or split anything? Iterate until approved.
5. **Publish** — one file per ticket under `.scratch/<feature>/issues/NN-<slug>.md`
   (blockers first), each carrying the template:

```markdown
   # <NN>: <Ticket title>

   **What to build:** the end-to-end behaviour, user's perspective
   **Blocked by:** 01-..., or "None (can start immediately)"
   **Status:** ready-for-agent

   - [ ] Acceptance criterion 1
   - [ ] Acceptance criterion 2
```

**Working the tickets:** any ticket whose blockers are all done is on the **frontier** and
can be grabbed. A linear chain just goes top to bottom.

---

### 4.4 triage

**What it does:** moves issues (and external PRs, if enabled) through a small state machine
of triage roles, verifying claims, grilling under-specified ones, and writing agent-ready
briefs. Use it for issues **you didn't create** — bug reports, incoming requests. Tickets
produced by `/to-tickets` are already agent-ready; **don't re-triage them**.

**The state machine:**

```
   unlabeled issue ──▶ ┌──────────────┐
                       │ needs-triage │ ◀─────────────┐
                       └──────┬───────┘               │ reporter replies
                 ┌────────────┼──────────────┐        │
                 ▼            ▼              ▼        │
        ┌────────────┐ ┌────────────────┐ ┌─────────┴──┐   ┌─────────┐
        │ needs-info │ │ ready-for-agent│ │ ready-for- │   │ wontfix │
        └────────────┘ └────────────────┘ │   human    │   └─────────┘
                                          └────────────┘

   PLUS one category role on every issue:   bug  |  enhancement
```

**Steps for a specific issue:**

1. **Gather context** — full issue (body, comments, labels), explore the codebase, then
   two checks: **redundancy** (does this already exist? → `wontfix`) and **prior
   rejection** (check `.out-of-scope/*.md`).
2. **Recommend** a category + state, with reasoning. Wait for your direction.
3. **Verify the claim** — reproduce the bug from the reporter's steps, or check out the
   PR and run its tests. A verified claim makes a much stronger agent brief.
4. **Grill if needed** — calls `grilling` + `domain-modeling` to flesh out vague requests.
5. **Apply the outcome** — post an **agent brief** (`ready-for-agent`), post triage notes
   (`needs-info`), or close (`wontfix`, with the reason recorded; genuine rejections land
   in `.out-of-scope/` so they're never re-suggested).

Invocation is natural language: *"show me what needs attention"* (it presents three
buckets, oldest first), *"let's look at #42"*, *"move #42 to ready-for-agent"*.

Every comment it posts starts with: `> *This was generated by AI during triage.*`

---

### 4.5 implement

**What it does:** builds the work described by a ticket or spec. The workhorse of the flow.

**Steps:**

1. Fetch the ticket you reference, and **state its title** before starting.
2. Call **`tdd`** where possible, at the seams pre-agreed in the spec.
3. **Typecheck regularly. Run single test files regularly. Full suite once at the end.**
4. When done, call **`code-review`** on the work.
5. **Commit** to the current branch.

Each ticket is self-contained by design, so run `/implement` in a **fresh context per
ticket** — the previous ticket's context is disposable.

---

### 4.6 tdd

**What it does:** the red → green loop, plus the discipline that makes the tests worth
keeping. Model-invoked: `/implement` drives it, or call it directly to build one behaviour
test-first.

```
        ┌─────────────────────────────────────────────────────┐
        │  ONE SLICE AT A TIME (vertical, never horizontal):  │
        │                                                     │
        │   ┌─────┐  write failing   ┌───────┐  minimal      │
        │   │ RED │ ──── test ──────▶ │ GREEN │ ◀─code to pass│
        │   └─────┘                   └───────┘               │
        │      ▲   pick the next test from what               │
        │      └── the last cycle taught you  ──▶ repeat      │
        └─────────────────────────────────────────────────────┘
        (Refactoring is NOT in the loop — it belongs to /code-review.)
```

**Core rules:**

- **Tests live at seams** — public boundaries where you observe behaviour without reaching
  inside. **Only test at pre-agreed seams** (agreed with you before any test is written).
- A good test reads like a specification ("user can checkout with valid cart") and
  survives refactors because it tests behaviour, not implementation.
- **Anti-patterns:** implementation-coupled tests (break when you refactor but behaviour
  didn't change), tautological tests (assertion recomputes what the code computes), and
  horizontal slicing (all tests first, then all code — tests imagined behaviour).
- **Red before green.** No code until a test fails. One seam, one test, one minimal
  implementation per cycle.
- When the *shape* of the interface is in question, it pulls in **`codebase-design`**
  vocabulary (module, seam, depth — see §7).

---

### 4.7 code-review

**What it does:** reviews the diff between `HEAD` and a fixed point along **two independent
axes**, run as parallel sub-agents so they don't pollute each other's context:

```
   ┌───────────────────────────┐      ┌───────────────────────────┐
   │  AXIS 1: STANDARDS        │      │  AXIS 2: SPEC             │
   │  Does the code follow the │      │  Does the code faithfully │
   │  repo's documented        │      │  implement what the       │
   │  standards?               │      │  issue/spec asked for?    │
   │  + Fowler smell baseline  │      │  missing / scope creep /  │
   │  (Mysterious Name,        │      │  wrong implementation     │
   │   Duplicated Code, ...)   │      │                           │
   └───────────────────────────┘      └───────────────────────────┘
              │                                  │
              └──────── reported SIDE BY SIDE ───┘
        (never merged or reranked — one axis must not mask the other)
```

Why two axes: code can pass one and fail the other — standards-perfect code that
implements the wrong thing, or spec-faithful code that breaks conventions.

**Steps:**

1. **Pin the fixed point** (commit, branch, tag). Verify it resolves and the diff
   (`git diff <point>...HEAD`) is non-empty *before* spawning sub-agents.
2. **Find the spec source:** commit-message issue refs → path you passed → files under
   `docs/`, `specs/`, `.scratch/` matching the branch → ask you.
3. **Find standards sources** (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, …) — the repo's
   documented rules always override the built-in smell baseline; smells are always
   labelled judgement calls, never hard violations. Tooling-enforced rules are skipped.
4. **Spawn both sub-agents in parallel** (each report under 400 words).
5. **Aggregate** under `## Standards` and `## Spec`, ending with per-axis counts and the
   worst issue in each — no single cross-axis winner.

---

## 5. On-Ramps: Other Ways In

### 5.1 diagnosing-bugs

**What it does:** a six-phase discipline for hard bugs and performance regressions — the
flake, the intermittent failure, the regression between two known-good states. Its core
conviction: **no hypothesis before there's a feedback loop.**

```
   ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
   │ 1. FEEDBACK  │─▶│ 2. REPRODUCE │─▶│ 3. HYPOTHESISE│─▶│ 4. INSTRUMENT│
   │    LOOP      │  │  + MINIMISE  │  │  3–5 ranked,  │  │  ONE variable│
   │  (the skill) │  │              │  │  falsifiable  │  │  at a time   │
   └──────────────┘  └──────────────┘  └───────────────┘  └──────┬───────┘
          ▲                                                      ▼
   ┌──────┴───────┐                                     ┌──────────────┐
   │ 6. CLEANUP   │◀────────────────────────────────────│ 5. FIX +     │
   └──────────────┘                                     │ REGRESSION   │
                                                        └──────────────┘
```

**Phase highlights:**

1. **Build a feedback loop** — *"this is the skill; everything else is mechanical."*
   One command that goes **red on this bug**: a failing test, a curl script, a headless
   browser run, a replayed trace, a bisection harness, a fuzz loop… Then **tighten** it:
   faster, sharper signal, more deterministic. A 2-second deterministic loop is a
   debugging superpower; a 30-second flaky one is barely a loop. Flaky bug? Raise the
   *reproduction rate* (loop it 100×, stress it) until it's debuggable.
   **No red-capable command → no Phase 2. Reading code for a theory first is the exact
   failure this skill prevents.**
2. **Reproduce + minimise** — confirm it's *the user's* failure mode, then cut inputs one
   at a time until every remaining element is load-bearing.
3. **Hypothesise** — 3–5 ranked, falsifiable hypotheses ("if X is the cause, changing Y
   makes the bug disappear"). Show you the list before testing — you often re-rank it
   instantly.
4. **Instrument** — one variable at a time; debugger > targeted logs > never
   "log everything and grep". Every debug log tagged `[DEBUG-a4f2]` for one-grep cleanup.
   Perf regressions: measure first, fix second.
5. **Fix + regression test** — the test comes **before** the fix, at a *correct* seam. If
   no correct seam exists, **that itself is the finding** — the architecture is preventing
   the bug from being locked down.
6. **Cleanup** — original repro green, instrumentation removed, throwaways deleted, and
   the winning hypothesis recorded in the commit message so the next debugger learns.

All output is **redacted first** (`<REDACTED>` for every secret); loops are built against
env vars so credentials stay out of what's shown.

---

### 5.2 wayfinder

**What it does:** plans work **too big for one session** — a greenfield project, a huge
feature — as a shared **map of decision tickets**, and resolves them one at a time until
the route is clear. The most cognitively demanding skill here; **save it for work you
genuinely can't hold in one session**, never a well-scoped feature.

Key mindset: it produces **decisions, not deliverables** — the map is done when the way is
clear, and it **hands off, it doesn't build** (merge back into the main flow at `/to-spec`).

```
   ┌─────────────────── MAP (map.md, one per effort) ───────────────────┐
   │ ## Destination      what "reached the end" looks like              │
   │ ## Notes            domain, skills to consult, standing prefs      │
   │ ## Decisions so far   one line per CLOSED ticket: gist + link      │
   │ ## Not yet specified  ◀── THE FOG OF WAR                           │
   │ ## Out of scope       consciously ruled out (never graduates)      │
   └────────────────────────────────────────────────────────────────────┘
              │ child tickets (decision questions, sized to one session)
              ▼
     01-research ──blocks──▶ 02-grilling ──blocks──▶ 03-task ──▶ ...
     └──────────────── THE FRONTIER: open + unblocked + unclaimed ─────┘
```

**Ticket types** (each carries a `wayfinder:<type>` label, never a triage label):

| Type | HITL/AFK | Resolves by |
|---|---|---|
| `research` | AFK | background subagent reading primary sources |
| `prototype` | HITL | a cheap concrete artifact to react to (via `/prototype`) |
| `grilling` | HITL | conversation (default) — always with `domain-modeling` |
| `task` | either | doing the thing that unblocks a decision (provision access, move data) |

**Fog of war:** the map is deliberately incomplete. The test for ticket-vs-fog is whether
you can **state the question precisely now** — not whether you can answer it yet. Each
resolution clears fog ahead of it, graduating now-specifiable questions into fresh tickets.

**Two invocation modes:**

- **Chart the map** — grill the destination first (it fixes scope), then grill
  breadth-first for open decisions; create the map + first tickets; wire blocking edges in
  a second pass; fire research subagents. Then stop — charting hand-resolves nothing.
- **Work through the map** — load the low-res map, take the first frontier ticket (or the
  one you name), **claim it before any work**, resolve it per its type label, record the
  answer, close it, update the map, graduate fog. **Never more than one ticket per
  session** (research tickets are the exception). Parallel sessions may work other
  frontier tickets.

---

## 6. Detours & Helpers

Drop-in skills for specific situations mid-flow.

### prototype

**Throwaway code that answers one design question.** Two branches — picking the wrong one
wastes the whole prototype:

- **"Does this logic/state model feel right?"** → a single shareable HTML file: free-play
  buttons + tabbed guided walkthroughs pushing the state machine through hard cases.
- **"What should this look like?"** → several *radically different* UI variations on one
  route, switchable via a URL param and a floating bar.

Rules: trivial to run (one command), no persistence by default, no polish, **surface the
state** after every action. When done: fold the validated decision into real code, then
commit the prototype to a throwaway branch as a **primary source**, pointed at from the
implementation issue.

### research

Delegates reading legwork to a **background agent** so you keep working. It investigates
against **primary sources** (official docs, source code, first-party APIs — not
second-hand write-ups), follows every claim to its owner, and leaves a **cited Markdown
file** in the repo. The file feeds *into* the main flow (e.g. a grill), it doesn't replace it.

### handoff & claude-handoff

Both compact the current conversation into a handoff document (saved to the OS temp dir,
redacted, no duplication of artifacts already on disk — they're referenced by path):

- **`/handoff`** — writes the doc for *you* to hand to a fresh session. Narrow use: new
  harness, new directory, a colleague, or forking a side task mid-phase.
- **`/claude-handoff`** — same doc, then **launches a background agent** seeded with it,
  which picks the work up immediately.

Both include a "suggested skills" section naming what the next agent should call.

### to-questionnaire

The inverse of grilling: when the answer you need lives **in someone else's head**, it
writes them a Markdown questionnaire to fill in async or in a meeting. It grills **the
send, not the subject** — (1) who's it going to? (2) what do you need back? (3) write the
questionnaire, most-important-first (async means maybe one pass), grouped by theme, every
question single-idea with an answer stub. Output: `to-questionnaire-<slug>.md`.

### wizard

For steps **only a human can take**: provisioning infra, CI secrets, one-off migrations,
clicking through an unfamiliar dashboard. It generates an interactive **bash wizard** —
stage-by-stage progress, opens each URL, says exactly what to click, captures values
(hidden entry for secrets), writes them into `.env` / GitHub secrets, confirms before
irreversible actions. Built from a shared template (the library above the `STAGES` marker
is never hand-edited); steps: scope the procedure → map each stage's journey → author →
verify (`bash -n`, shellcheck, trace statically — never run it end-to-end yourself).
Ephemeral by default; commit only if it should become the repeatable setup path.

---

## 7. Codebase Health & Design

### domain-modeling  *(model-invoked, runs underneath)*

The **active** discipline for the project's language — driven by `grill-with-docs`, `triage`,
and `wayfinder`, or reachable directly when the *words* are the problem:

- **Challenge** terms that conflict with `GLOSSARY.md`; **sharpen** fuzzy ones into
  canonical terms; stress-test domain relationships with concrete edge-case scenarios;
  cross-reference claims against what the code actually does.
- **Update `GLOSSARY.md` inline, the moment a term resolves** — never batched. The
  glossary is *only* a glossary: no implementation details, no spec content.
- **ADRs are offered sparingly** — only when a decision is *hard to reverse*, *surprising
  without context*, and *the result of a real trade-off*. All three, or no ADR.
- Files are created lazily: the first resolved term creates `GLOSSARY.md`.

### codebase-design  *(model-invoked, the vocabulary layer)*

The single source of truth for **deep-module vocabulary**, used by `tdd` and
`improve-codebase-architecture`: **module, interface, implementation, depth, seam,
adapter, leverage, locality**.

```
   DEEP MODULE (the goal)                SHALLOW MODULE (avoid)
   ┌───────────────────────┐             ┌─────────────────────────┐
   │   small interface     │             │    large interface      │
   ├───────────────────────┤             ├─────────────────────────┤
   │                       │             │                         │
   │  lots of behaviour    │             │  thin pass-through      │
   │  hidden inside        │             │  implementation         │
   │                       │             │                         │
   └───────────────────────┘             └─────────────────────────┘
   leverage for callers                  every change fans out
   locality for maintainers              across the callers
```

Key principles: the **deletion test** (delete the module — does complexity vanish
(pass-through) or reappear across N callers (earning its keep)?); **the interface is the
test surface**; **one adapter = hypothetical seam, two adapters = real seam**; accept
dependencies, don't create them; return results, don't produce side effects.

### improve-codebase-architecture

**What it does:** scans the codebase for **deepening opportunities** (shallow → deep
modules), presents them as a **visual HTML report**, then grills you through whichever
candidate you pick. Run it every few days / whenever you have a spare moment.

**Steps:**

1. **Explore** — scope first (YAGNI): weight recently-changed hot spots from
   `git log`. A sub-agent walks the code organically looking for friction: bouncing
   between many small modules, interfaces as complex as implementations, bugs hiding in
   *how* extracted functions are called, untestable seams. The **deletion test** filters
   candidates.
2. **HTML report** (written to the OS temp dir, opened for you): one card per candidate —
   files, problem, solution, benefits in locality/leverage terms, a hand-crafted
   **before/after diagram**, and a badge: `Strong` / `Worth exploring` / `Speculative` —
   ending with a top recommendation. ADR conflicts are flagged, not silently proposed.
3. **Grilling loop** on your chosen candidate (constraints, seam placement, what tests
   survive), with `domain-modeling` updating the glossary/ADRs inline as decisions land.

---

## 8. Understanding Existing Code

The **`understand`** family analyzes a codebase into a **knowledge graph**
(`.ua/knowledge-graph.json`: 13 node types, 26 edge types, architectural layers, a guided
tour) that powers an interactive dashboard. Seven phases: scan → batch → analyze (parallel
sub-agents) → assemble-review → architecture → tour → validate & save. Incremental updates
re-analyze only files changed since the last commit.

| Skill | Use it to… |
|---|---|
| `understand` | Build/update the knowledge graph (flags: `--full`, `--review`, `--language`, `--exclude`) |
| `understand-dashboard` | Launch the interactive web dashboard |
| `understand-chat` | Ask questions about the codebase via the knowledge graph |
| `understand-explain` | Deep-dive one file, function, or module |
| `understand-diff` | Analyze a git diff / PR: what changed, affected components, risks |
| `understand-onboard` | Generate an onboarding guide for new team members |
| `understand-domain` | Extract business domain knowledge → interactive domain flow graph |
| `understand-figma` | Analyze a Figma file → design knowledge graph |
| `understand-knowledge` | Graph a Karpathy-style LLM wiki knowledge base |

Valueless on an empty repo; the first thing to reach for when joining or re-entering an
existing codebase.

---

## 9. Session Management

At any **phase boundary** (end of grilling, end of a ticket, end of QA) there are five
moves, in rough order of preference:

```
   ┌───────────┬────────────────────────────────────────────────────────┐
   │ Continue  │ stay put — rule this out LAST, not first               │
   │ /clear    │ empty the window — when nothing here matters next      │
   │ /handoff  │ portable markdown doc — new harness/dir/colleague      │
   │ Subagent  │ tightly-scoped task out, report back                   │
   │ /compact  │ compress + seed a fresh session — the default          │
   └───────────┴────────────────────────────────────────────────────────┘
```

Two rules from `ask-matt` worth internalizing:

- **One unbroken window** through grill → spec → tickets; **fresh window per ticket**
  when implementing.
- `/retro`-style reflection (upstream skill) runs *in* the session it looks back on,
  before clearing.

---

## 10. Learning & Meta Skills

| Skill | What it does |
|---|---|
| `ask-matt` | **The router.** Ask "which skill fits?" — it reads the actual SKILL.md files and maps your situation onto the main flow, on-ramps, or standalone skills. When in doubt, start here. |
| `teach` | A **stateful multi-session teaching workspace** in the current directory: `MISSION.md` (why you're learning), `./lessons/*.html` (one short self-contained lesson each, in your zone of proximal development), `./reference/*.html` (print-ready cheat sheets), `RESOURCES.md`, `./learning-records/*.md`, reusable `./assets/`. Designs for long-term retention (retrieval practice, spacing, interleaving), not just in-the-moment fluency. |
| `scaffold-exercises` | Creates course exercise directory structures (`sections/XX/XX.YY-name/{problem,solution,explainer}`) that pass the `ai-hero-cli` linter. Specific to Matt's course repos. |
| `loop-me` | A stateful grilling session whose only output is **workflow specs** (`workflows/*.md`) for recurring loops in your life/work. Vocabulary: trigger (event vs schedule), checkpoint (pushed as far right as possible), brief (decision-ready summary, never raw output). Done when an implementer could build it without asking a single question. |
| `writing-for-agents` | The reference for **writing documents agents consume** (skills, `AGENTS.md`, pointed-at docs): context pointers, the two loads (context vs cognitive), the information hierarchy (steps / in-file reference / disclosed reference), progressive disclosure, completion criteria, leading words, pruning. Model-invoked — the agent reaches for it when *you* ask for a new skill or an `AGENTS.md` edit. |

---

## 11. Full Skill Inventory

35 skills installed. (U = user-invoked, M = model-invoked.)

### Engineering — the pipeline

| Skill | Inv | One-liner |
|---|---|---|
| `setup-matt-pocock-skills` | U | One-time per-repo config: tracker, triage labels, doc layout |
| `grill-with-docs` | U | Relentless interview + builds `GLOSSARY.md`/ADRs as you go |
| `grill-me` | U | Same interview, stateless (no repo needed) |
| `grilling` | M | The interview primitive: rounds, frontier, design tree |
| `to-spec` | U | Conversation → published spec (no interview) |
| `to-tickets` | U | Spec → tracer-bullet tickets with blocking edges |
| `triage` | U | Issue/PR state machine → agent-ready briefs |
| `implement` | U | Build a ticket/spec, driving tdd, closing with code-review |
| `tdd` | M | Red-green loop at pre-agreed seams; anti-pattern police |
| `code-review` | M | Two-axis (Standards + Spec) parallel sub-agent review |

### Engineering — on-ramps & support

| Skill | Inv | One-liner |
|---|---|---|
| `diagnosing-bugs` | M | Feedback loop → reproduce → hypothesise → instrument → fix → cleanup |
| `wayfinder` | U | Huge foggy work as a map of decision tickets, resolved one at a time |
| `prototype` | M | Throwaway HTML prototype to answer one design question |
| `research` | M | Background agent investigates primary sources → cited Markdown file |
| `domain-modeling` | M | Active glossary/ADR upkeep as terms and decisions crystallize |
| `codebase-design` | M | Deep-module vocabulary (module, seam, depth, adapter, leverage…) |
| `improve-codebase-architecture` | U | Scan for deepening opportunities → HTML report → grill |
| `wizard` | M | Interactive bash wizard for human-only steps (creds, secrets, migrations) |

### Productivity & session

| Skill | Inv | One-liner |
|---|---|---|
| `ask-matt` | U | Router: which skill/flow fits your situation |
| `handoff` | U | Compact conversation → handoff doc (temp dir) |
| `claude-handoff` | U | Handoff doc + launch a background agent to continue immediately |
| `to-questionnaire` | U | Turn an unanswerable decision into a questionnaire for someone else |
| `teach` | U | Multi-session teaching workspace (lessons, references, records) |
| `loop-me` | U | Grill recurring loops in your work into `workflows/*.md` specs |
| `scaffold-exercises` | M | Scaffold course exercise directories (problem/solution/explainer) |
| `writing-for-agents` | M | Reference for writing skills, `AGENTS.md`, agent-facing docs |

### The `understand` family (existing codebases)

| Skill | Inv | One-liner |
|---|---|---|
| `understand` | U | Codebase → interactive knowledge graph (7 phases, incremental) |
| `understand-dashboard` | U | Launch the graph's web dashboard |
| `understand-chat` | U | Q&A over the knowledge graph |
| `understand-diff` | U | Diff/PR analysis: changes, affected components, risks |
| `understand-domain` | U | Business domain extraction → flow graph |
| `understand-explain` | U | Deep-dive explanation of a file/function/module |
| `understand-figma` | U | Figma file → design knowledge graph |
| `understand-knowledge` | U | LLM wiki knowledge base → knowledge graph |
| `understand-onboard` | U | Onboarding guide generation |

---

## 12. Team Playbook: Personas & Use Cases

Everything above describes the *machinery*. This section maps it onto a **real team**: the
use cases that actually happen in development, the persona that owns each one, and the
skills that get run.

### 12.1 How the hat system works (one human + one agent)

The skills are built for **one human + one agent**. There is no role system inside them —
anyone can run anything. Roles enter through **hats**: when a use case calls for the PM,
*you* put on the PM hat — and put the **same hat on the agent**. Both sides are then in
role, with a clean split that every skill already assumes:

```
   ┌───────────────────────────── HAT WORN BY BOTH ─────────────────────────────┐
   │                                                                            │
   │   YOU (human)                            AGENT                             │
   │   the role's DECISIONS                   the role's LEGWORK                │
   │   scope, priority, what "done" means,    reading the codebase, drafting    │
   │   which risk is acceptable, which        artifacts, verifying claims,      │
   │   trade-off wins                         running the skills                │
   │                                                                            │
   │   "decisions are the human's"            "facts are the agent's job"       │
   │   — the rule behind /grilling —          — dispatch a sub-agent, don't ask —│
   └────────────────────────────────────────────────────────────────────────────┘
```

A hat is not a permission — it's a **conversation contract**: it tells both sides which
decisions matter right now. Switch hats at phase boundaries (§9).

**Putting a hat on** is just how you phrase the request:

```
   "Put on the PM hat — interview me about the wishlist feature."  → /grill-with-docs
   "QA hat: triage what came in overnight."                        → /triage
   "Architect hat: break the checkout spec into tickets."          → /to-tickets
   "Developer hat: implement ticket 01 from .scratch/checkout/issues/." → /implement
   "Orchestrator hat: what's on the frontier, and what can run now?"    → frontier check
```

### 12.2 The seven hats at a glance

| Hat | Owns the question | You (the human) decide | The agent runs | Typical artifacts |
|---|---|---|---|---|
| **Product Manager** | *What* and *why* | Scope, priorities, user stories, what ships | `/grill-with-docs`, `/to-spec`, `/to-questionnaire`, `/triage`, `/research` | `spec.md`, `GLOSSARY.md` terms, triaged backlog |
| **Developer** | *How it gets built* | Design trade-offs, when code is good enough | `/implement`, `/tdd`, `/diagnosing-bugs`, `/prototype` | Commits, tests, fixes, prototypes |
| **QA** | *Is it right?* | Severity, what gets accepted, what "reproduced" means | `/triage` (verify claims), `/code-review` (Spec axis), `/diagnosing-bugs` | Verified briefs, review findings |
| **Lead Architect** | *Shape & direction* | Seams, ADRs, which deepening to do | `/improve-codebase-architecture`, `/codebase-design`, `/domain-modeling`, `/wayfinder` | HTML report, ADRs, wayfinder maps |
| **Orchestrator** | *Throughput* | What runs in parallel, session boundaries | Frontier checks, `/wayfinder` (work mode), `/handoff`, subagent dispatch | An advancing ticket frontier |
| **DevOps** | *The plumbing* | What gets provisioned, when to cut over | `/wizard`, `/research`, `/diagnosing-bugs` (flaky CI, perf) | Wizard scripts, `.env`, CI secrets |
| **Security** | *What risk is acceptable* | Accept/reject risk, severity calls | `/triage`, `/code-review`, `/diagnosing-bugs`, `/research`, `/wizard` | Verified vuln briefs, hardened standards |

**Honest note on Security and DevOps:** there is no dedicated "security" or "devops"
skill. Those hats are *lenses* over the pipeline:

- **Security** plugs in through `/code-review` — whatever security rules you document in
  `CODING_STANDARDS.md` get enforced by the Standards axis — through `/triage` (verifying
  vulnerability reports the same way as bugs), `/diagnosing-bugs` (reproducing an exploit
  as a red-capable loop), and `/wizard` (whose `ask_secret` keeps new credentials out of
  the chat entirely).
- **DevOps** plugs in through `/wizard` (provisioning, secrets, migrations, cutovers),
  `/research` (CI/docs legwork), and `/diagnosing-bugs` (flaky pipelines and perf
  regressions *are* bugs with feedback loops).

### 12.3 Real use-case walkthroughs

Each walkthrough names the hat worn by **both** of you, the steps, and what comes out.

---

**UC1 — A feature idea needs shaping** · hat: **PM**

*Scenario: collectors keep asking for a wishlist; you have one paragraph of an idea.*

1. Agent runs `/grill-with-docs`: rounds of frontier questions ("Saved items vs. cart —
   same list or two concepts?"), you answer; terms get pinned into `GLOSSARY.md` as they
   resolve. Frontier empty → shared understanding.
2. Same window, run `/to-spec`: the agent publishes `.scratch/wishlist/spec.md`, already
   labelled `ready-for-agent`.

*Out: a spec, glossary entries, zero code — which is the point.*

---

**UC2 — A bug report arrives** · hat: **QA**

*Scenario: the tracker gets "applying a 100% discount makes the total negative."*

1. `/triage`: the agent reads the issue, checks whether the behavior already exists
   (redundancy check), then **reproduces it from the reporter's steps** before anything else.
2. Confirmed → an agent brief is posted and the issue labelled `ready-for-agent`; vague
   repro → `needs-info` with specific questions back to the reporter.

*You called severity; the agent made the claim verified instead of anecdotal.*

---

**UC3 — Approved spec → work plan** · hat: **Lead Architect**

*Scenario: the wishlist spec is approved; the sprint starts Monday.*

1. `/to-tickets`: the agent drafts tracer-bullet slices (each cuts schema → API → UI →
   tests, each demoable alone), declares blocking edges, and sequences any wide refactor
   as expand → migrate → contract.
2. It quizzes you — granularity? edges right? merge or split? — iterates, then publishes
   one file per ticket under `.scratch/wishlist/issues/`, blockers first.

*Out: a numbered ticket set whose frontier says exactly what can start now.*

---

**UC4 — Build a ticket** · hat: **Developer**

*Scenario: ticket `01` is on the frontier.*

1. **Fresh session**, Dev hat on both sides. `/implement`: the agent states the ticket
   title, then drives `/tdd` at the spec's pre-agreed seams — red before green, one slice
   at a time. Typechecks regularly; full suite once at the end.
2. It closes by running `/code-review` (Standards + Spec axes) and committing to the branch.

*You settled the trade-offs it surfaced; the agent wrote the code and proved it.*

---

**UC5 — "Search has been slow since yesterday"** · hats: **Developer**, then **QA**

1. Dev hat, `/diagnosing-bugs`: the agent builds a **red-capable feedback loop first**
   (never a theory first), minimises the repro, shows you 3–5 ranked falsifiable
   hypotheses, instruments one variable at a time, and writes the regression test
   *before* the fix.
2. Switch to QA hat to close out: re-run the loop against the original scenario, and
   check the winning hypothesis made it into the commit message.

*Out: a fix, a regression test, and a reusable loop.*

---

**UC6 — Provisioning & secrets before launch** · hat: **DevOps**

*Scenario: Stripe keys, CI secrets, and one DB migration stand between you and launch.*

1. `/wizard`: the agent reads `.env` and `.github/workflows/*` (every `secrets.*`
   reference is a value to produce), maps each human step — which URL, what to click —
   and authors a bash wizard: opens URLs, hidden secret entry, writes `.env` + GitHub
   secrets, confirms before the irreversible migration step.
2. You run the script; the agent verifies it statically (`bash -n`, shellcheck, every
   secret name matches a CI reference).

*Why a script: the values never touch the chat, and the procedure stops being
re-explained to an agent every time.*

---

**UC7 — The codebase feels tangled** · hat: **Lead Architect**

1. `/improve-codebase-architecture`: the agent scopes by recent hot spots, walks the code
   for friction (shallow modules, missing locality), and writes an HTML report to your
   temp dir — before/after diagrams, `Strong` / `Worth exploring` / `Speculative` badges.
2. You pick a candidate → the grilling loop designs the deepened module; a genuinely
   hard-to-reverse outcome becomes an ADR. Hand the designed module to the PM/Dev hats
   as a new idea (UC1 → UC4).

---

**UC8 — A security advisory drops** · hat: **Security**

*Scenario: a CVE is published for a library you depend on.*

1. `/research` in the background: the agent reads the advisory and the library's fix
   commit against primary sources, and leaves a cited Markdown file in the repo.
2. Still in the Security hat, `/triage` the follow-up issue: verify the vulnerable
   pattern actually occurs in *this* codebase, then post an agent brief for the upgrade.
3. After the fix, `/code-review` enforces whatever security rules you've documented in
   `CODING_STANDARDS.md`.

*Out: cited research, a verified brief, standards that stick.*

---

**UC9 — A new teammate starts Monday** · hat: **Lead Architect**

1. `/understand` builds the knowledge graph (architecture, layers, guided tour);
   `/understand-dashboard` opens it visually.
2. `/understand-onboard` turns the graph into an onboarding guide; `/teach` gives the
   newcomer a stateful learning workspace (`MISSION.md`, lessons, reference sheets) for
   the stack specifics.

---

**UC10 — A release sprint, orchestrated** · hat: **Orchestrator**

The `/to-tickets` blocking edges *are* the parallelism plan. See §12.4.

---

### 12.4 The Orchestrator pattern — both meanings

The Orchestrator hat has two levels, and they compose:

```
   ┌───────────────────────────────────────────────────────────────┐
   │              ORCHESTRATOR HAT   (you + agent)                 │
   │   claims frontier tickets · dispatches workers · drafts the   │
   │   NEXT tickets (QA acceptance, docs) while workers run        │
   └────────┬────────────────────────┬─────────────────────────────┘
            │ dispatch               │ dispatch
            ▼                        ▼            (queued — blocked by 01+02)
   ┌──────────────────┐    ┌──────────────────┐   ┌────────────────────┐
   │  DEV WORKER      │    │  DEV WORKER      │   │  QA TICKET 03      │
   │  ticket 01       │    │  ticket 02       │   │  acceptance check  │
   └────────┬─────────┘    └────────┬─────────┘   └────────────────────┘
            └───────────┬───────────┘
                        ▼
      tickets 01+02 done → ticket 03 joins the frontier
                        → a QA-hat worker picks it up
```

- **Level 1 — coordinator:** the classic loop. One session = one ticket; you are the
  orchestrator *between* sessions, picking the next frontier ticket each time.
- **Level 2 — parallel dispatch:** the orchestrator session dispatches worker
  sessions/subagents on ready tickets **and keeps working** — drafting the QA tickets
  that block on the dev tickets, wiring edges, absorbing results. (Exactly the pattern
  you described: engineer subagent runs while the orchestrator creates QA tasks.)

**Mechanics, honestly stated:**

- In this environment the orchestrator is your main session; workers are subagents /
  background agents it dispatches. `/wayfinder`'s chart mode already fires research
  workers this way, in parallel.
- Workers **claim first** (`Status: claimed` on the ticket file) so two workers never
  build the same ticket. Blocking edges are the safety: a worker only ever gets a ticket
  whose blockers are all done.
- **Beginner path: run it serially first.** One `/implement` per ticket, fresh context,
  you advance the frontier by hand. Parallel dispatch earns its keep only when tickets
  are genuinely independent — and the edges tell you when that's true.
- Upstream, `implement-spec` automates the whole pattern (parallel implementers, one
  integration branch, one final code-review) — not installed here, but the local-markdown
  workflow above is its manual equivalent.

### 12.5 Hat etiquette

- **One hat per phase**, switched at phase boundaries (§9). The same hat on both sides
  of the table.
- **The agent never decides in your place.** Wayfinder's rule is the general law: an
  agent that answers its own grilling questions has broken the contract. The agent may
  recommend (every skill does, with a recommended answer) — the call is yours.
- **Solo reality:** you'll wear all seven hats in one afternoon. That's fine — the hats
  are cheap to switch. What keeps the roles honest is the **artifact trail**: the spec is
  the PM's word, the ticket's `Status:` line is QA's verdict, the ADR is the architect's
  memory. Trust the trail, not your memory of the conversation.

---

## 13. Cheat Sheet: Which Skill When?

```
   "I have a vague idea"                  → /grill-with-docs
   "The interview surfaced everything"    → /to-spec
   "Turn the spec into work"              → /to-tickets
   "Fresh bug reports / feature requests" → /triage
   "Build ticket 01"                      → /implement  (fresh context!)
   "Build one behaviour test-first"       → /tdd
   "Review my branch/PR"                  → /code-review
   "This bug resists a first glance"      → /diagnosing-bugs
   "Too big to spec in one session"       → /wayfinder
   "Will this state model feel right?"    → /prototype
   "Go read the docs for me"              → /research
   "The answer is in someone else's head" → /to-questionnaire
   "Only I can do these manual steps"     → /wizard
   "Which skill do I need?"               → /ask-matt
   "Teach me X over multiple sessions"    → /teach
   "Hand this conversation to someone"    → /handoff  (or /claude-handoff)
   "Spare moment; keep the codebase good" → /improve-codebase-architecture
   "New codebase to understand"           → /understand
```

And the four habits that make the whole system work:

1. **Grill before building** — most agent failures are spec failures; the interview is
   where they're prevented.
2. **Keep the shared language alive** — `GLOSSARY.md` and ADRs are written *during*
   grilling and read by *every* other skill.
3. **Vertical slices, one context window each** — tracer bullets that demo on their own.
4. **Close the loop** — `/code-review` after building; fix the *environment*, not just the
   bug, so the next session starts smarter.
