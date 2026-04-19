# Execution Roadmap

This document translates the revamp into a realistic build sequence.

The goal is to avoid trying to rebuild everything in one chaotic step.

> **Status as of 2026-04-18:** phases 0–5 are done; phase 6 (web app on render
> documents) covers the full sharing loop — `/login`, `/cli/login`, `/home`
> (with live feed + stats), and `/s/:slug` (owner visibility toggle + public
> view) are all built end-to-end. `/dashboard` redirects 301 to `/home`.
> Phases 7–9 are partially scaffolded (auth + tokens shipped via CLI bridge;
> jobs worker exists but no consumers; legacy transition not started). See
> [doc 21](21-implementation-status.md) for the live status board and
> [doc 17](17-web-app-pages-and-screens.md) "Build Order (Revised)" for the
> page-level wave plan.

## Guiding Strategy

Build the revamp from the inside out:

1. schemas
2. parser
3. render layer
4. contracts
5. storage and API
6. web app
7. migration and rollout

That lets the most foundational pieces settle first.

## Phase 0: Lock The Design — ✓ done

Outcome:

- revamp docs are complete enough to implement from

Tasks:

- finalize canonical session shape
- finalize render document shape
- finalize artifact union
- finalize package boundaries

Acceptance:

- no major schema ambiguity remains

## Phase 1: Create Core Packages — ✓ done

Outcome:

- `packages/canonical`
- `packages/render`
- `packages/parser-core`

Tasks:

- add package scaffolds
- add TypeScript build setup
- add Zod schemas
- add basic tests

Acceptance:

- canonical and render schemas validate example documents

## Phase 2: Build The Claude Code Adapter — ✓ done

Outcome:

- `packages/provider-claude-code`

Tasks:

- implement discovery
- implement source bundle builder
- implement transcript parsing and branch recovery
- implement first-wave artifact extractors

First-wave extractors:

- plans
- questions
- tool decisions
- tool outputs

Acceptance:

- fixture-driven tests pass for first-wave Claude Code imports

## Phase 3: Produce Canonical And Render Outputs Locally — ✓ done

Outcome:

- the CLI can inspect and preview local imports before any backend work

Tasks:

- add `howicc inspect`
- add `howicc export`
- add `howicc preview`

Acceptance:

- local import of anonymized fixtures produces stable canonical and render outputs

## Phase 4: Add Contracts And Database Layer — ✓ done

Outcome:

- `packages/contracts`
- `packages/db`

Tasks:

- define API contracts
- define Drizzle schema for D1
- define revision and asset storage model

Acceptance:

- contract schemas and DB schema compile and validate in CI

## Phase 5: Build API And Storage Path — ✓ done (with gaps tracked in doc 18 §"Endpoint Status" and doc 21)

Outcome:

- `apps/api`
- upload/finalize path works end-to-end

Tasks:

- implement Hono routes
- implement draft upload session persistence
- implement API-mediated asset upload into R2 draft keys
- implement finalize-time promotion into revision keys
- persist revision metadata to D1
- enqueue post-upload jobs
- implement stored render reads from revision assets

Acceptance:

- CLI can upload canonical, render, and bundle artifacts successfully
- API can return a stored render document from the latest revision without reparsing local source data

## Phase 6: Build The Web App On Render Documents — ◐ in progress

Outcome:

- `apps/web` reads `render_document` instead of markdown-first data

Today: only `/login` and `/cli/login` are built end-to-end. `/` and
`/dashboard` are stubs. No render-document UI ships yet. Re-sequenced into
waves to match doc 17's "Build Order (Revised)":

### Wave A — Sharing loop (mostly shipped 2026-04-18)

- ✓ `/s/:slug` owner: render-document viewer with copy-link +
  `VisibilityMenuIsland` radio-toggle dropdown that `PATCH`es visibility.
- ✓ `/s/:slug` public: same route, visibility-gated; CTA for logged-out
  visitors to sign in.
- ✓ `/home`: shadcn shell + server-fetched `GET /profile/stats` and
  `GET /profile/activity` render real data; activity titles link to
  `/s/:slug`. `/dashboard` 301-redirects to `/home`.
- ✓ API: `PATCH /conversations/:id/visibility`, `GET /shared/:slug`,
  `GET /profile/stats`, `GET /profile/activity`.
- Residual: mobile-first polish for public view, artifact drilldown,
  "load more" feed island, scrollspy-active state on the phase spine, and
  a dedicated `GET /conversations/:id` metadata endpoint if owner-view
  ever needs fields outside the render document. (Slug uniqueness
  resolved 2026-04-18 via migration `0002_slug_unique.sql`; phase-spine
  MVP with classifier + desktop rail + mobile chip bar shipped same day.)
- Foundation: ship the Timeline / Phase Spine component (or interim list)
  and the warm cream + serif typography rollout from doc 20

Acceptance: a real imported Claude Code conversation renders correctly from
render JSON only, both for the owner and via a public share link.

### Wave B — Own your data

- `/sessions`, `/settings`
- API: `/api-tokens` CRUD, `PATCH /profile/settings`

### Wave C — Team features

- `/r/:owner/:name` page (replaces the un-gated `/repo/:owner/:name` shell),
  `/r/:owner/:name/settings`
- API: GitHub-gated `/repos/*` family + visibility/hide endpoints

### Wave D — Insights and virality

- `/insights`, `/@:username`, polished `/`
- API: `/profile/public/:username`, `/og/profile/:username.png`,
  `POST /sessions/:id/view`

## Phase 7: Add Auth, Tokens, And User Flows — ◐ partial

Outcome:

- GitHub auth
- CLI token issuance
- user settings area

Tasks:

- add auth package wiring
- add token management UI
- add owner-only revision and publish flows

Acceptance:

- authenticated sync works with CLI tokens

Status: GitHub OAuth + Better Auth session cookie + CLI bridge with
`POST /cli-auth/authorize` / `exchange` and `GET /cli-auth/whoami` are all
shipped. Token management UI (Wave B above) and owner-only revision/publish
flows (Wave A) are still pending.

## Phase 8: Post-Upload Processing And Ops — + scaffolded only

Outcome:

- job workers
- analysis
- observability

Tasks:

- queue consumers
- privacy revalidation
- summary generation if desired
- error and job monitoring

Acceptance:

- revision processing is observable and recoverable

Status: `apps/jobs` worker scaffold exists (env, runtime, bindings) but no
queue consumers, no privacy revalidation, no summary generation. Profile
recompute is currently lazy on `GET /profile`.

## Phase 9: Legacy Transition — + not started

Outcome:

- old records remain viewable
- new records use the new model

Tasks:

- mark legacy markdown records clearly
- avoid fake migrations unless they are truly reliable
- move traffic and docs to the new import path

Acceptance:

- new system handles all new imports
- old system is no longer the ingestion default

## Practical First Milestone

If we want the strongest first milestone, I would target this bundle:

1. `packages/canonical`
2. `packages/render`
3. `packages/provider-claude-code`
4. CLI local `inspect/export/preview`

That would prove the hardest part of the revamp before backend complexity enters.

## What Not To Do

Avoid this order:

1. build the new API first
2. build the DB first
3. keep parser details vague

That would force backend decisions before the source-of-truth model is stable.

## Milestone Definition

Each phase should end with:

- updated docs
- passing tests
- at least one working end-to-end path for that layer

That discipline will keep the rebuild coherent.
