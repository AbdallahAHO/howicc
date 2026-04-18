# Implementation Status

**Last audited:** 2026-04-18
**Scope:** `apps/web/`, the API surface it depends on, and the design system it consumes.

This document is the single source of truth for "what's actually built vs. what
the revamp docs describe." The narrative docs (17, 18, 20) describe the **target**;
this one describes the **state**. When they disagree, this doc wins until reality
is updated.

Legend (matches doc 18):

```
✓  built and wired end-to-end
◐  partially built — works for some inputs or surfaces, not all
+  not built yet
```

---

## Scoreboard

| Area | Coverage |
|------|----------|
| Public pages from doc 17 (1, 11) | 1 of 2 partial — landing exists as stub, public profile missing |
| Authenticated pages from doc 17 (4–10) | 2 partial of 7 — `/home` (feed + stats live, clickable titles), `/s/:slug` owner + public view with visibility toggle. Others unbuilt. |
| API endpoints from doc 18 | 17 of 31 (≈55%) — 14 still to add or modify |
| Design system "The Archive" (doc 20) | Color tokens partially adopted; serif typography, cream surfaces, timeline component, warm shadows all not yet implemented |
| Core sharing loop (sync → browse → share → public view) | Sync ✓, Browse ✓, Share ✓, Public view ✓ (all live end-to-end with unique slugs) |

The CLI, parser, canonical/render schemas, contracts, DB, upload path, profile
aggregation, and CLI auth bridge are all in good shape (phases 1–5 of doc 11).
The web app surface is the dominant remaining gap.

---

## Pages (against doc 17 inventory)

Routes match the actual files in `apps/web/src/pages/`. The "Doc 17 route"
column shows the planned slug from doc 17 when it differs.

| # | Built route | Doc 17 route | Status | Notes |
|---|-------------|--------------|--------|-------|
| 1 | `/` | `/` | ◐ | Stub landing — hero, two CTAs, env diagnostic block. No embedded example session, no "How it works" section, no CLI install snippet. |
| 2 | `/login` | `/login` | ✓ | Matches spec (card-centered, sentence case, scopes called out). |
| 3 | `/cli/login` | `/cli/login` | ✓ | CLI bridge with continue-button + status text wired to `wireCliLoginPage`. |
| 4 | `/home` | `/home` | ◐ | Route matches spec (`/dashboard` → 301 → `/home`). Shell uses `@howicc/ui-web` shadcn primitives: sticky header with desktop nav + mobile hamburger + avatar dropdown. The page now server-fetches `GET /profile/stats` and `GET /profile/activity` (limit 10) and renders real data — recent-activity list (title, sessionType, project/repo, models, duration, cost, synced-at) with empty-state CTA when digestCount is 0, and live stat cards (sessions, active days + streak, total cost + coding time). Open: cursor-paginated "load more" island, `/s/:slug` links when the owner page lands. |
| 5 | — | `/insights` | + | Not built. UserProfile data exists in the API but no UI consumes it. |
| 6 | — | `/sessions` | + | Not built. `conversations.list()` works but no filters, no pagination, no UI. |
| 7 | `/s/:slug` | `/s/:slug` (owner) | ◐ | Dynamic route (`pages/s/[slug].astro`). Server-fetches `GET /shared/:slug`; owners see a visibility dropdown + copy-link (`VisibilityMenuIsland`) that `PATCH /conversations/:id/visibility`s. Renders message / activity-group / tool_run / callout / todo / question / compact-boundary blocks today; phase spine and artifact drilldowns still pending. |
| 7 | `/s/:slug` | `/s/:slug` (public) | ◐ | Same route — visibility-gated. Public/unlisted readable without auth; private returns 404 to non-owners. Sidebar swaps in a "Sign in to sync your own" CTA for logged-out visitors. Mobile-first polish still pending. |
| 8 | — | `/r/:owner/:name` | + | Not built as a page. `GET /repo/:owner/:name` exists and is CORS-allowed for the web origin, but it's not GitHub-gated and there is no UI. |
| 9 | — | `/r/:owner/:name/settings` | + | Not built. No visibility or hide-conversation endpoints either. |
| 10 | — | `/settings` | + | Not built. No `/api-tokens` CRUD endpoints either. |
| 11 | — | `/@:username` | + | Not built. No public-profile endpoint, no OG-image generation, no view counter. |
| — | `/debug/auth` | (not in inventory) | ✓ | Internal tool. Not user-facing — keep out of doc 17 main surface but worth a footnote. |

**Net:** 2 pages match spec end-to-end (`/login`, `/cli/login`), `/home` has a
polished shadcn shell awaiting wave-A endpoints, `/` is a stub, `/dashboard`
301-redirects to `/home`, 6 doc-17 pages (5–9, 11) are missing entirely.

### Resolved: `/home` is the post-login route

Doc 17 always specified `/home`. The original `/dashboard` stub has been
renamed: `apps/web/src/pages/home.astro` is the new protected page and
`apps/web/src/pages/dashboard.astro` is a one-line `Astro.redirect('/home', 301)`.
All internal links (`/`, `/login`, `/debug/auth`) and tests point to `/home`.
The `home.astro` shell is built on `@howicc/ui-web` shadcn primitives
(`Card`, `Avatar`, `Badge`, `Button`, `Separator`, `Skeleton`, `DropdownMenu`)
with interactive islands for the user menu, mobile nav, and copyable CLI
commands; static content renders SSR without client JS.

---

## API endpoints (against doc 18 §"Endpoint Status")

Doc 18 already lists what exists vs. what's new with the same legend. This
section just confirms the audit and flags two corrections.

**Confirmed in code:**

| Endpoint | Status | Source |
|----------|--------|--------|
| `POST /uploads/sessions`, `PUT /uploads/:id/assets/:kind`, `POST /uploads/finalize` | ✓ | `apps/api/src/routes/uploads.ts` |
| `GET /conversations` | ✓ (no filters/pagination yet) | `apps/api/src/routes/conversations.ts` |
| `GET /conversations/:id/render` | ✓ | same |
| `GET /conversations/:id/artifacts/:artifactId` | ✓ | same |
| `GET /profile`, `POST /profile/recompute` | ✓ | `apps/api/src/routes/profile.ts` |
| `GET /profile/stats`, `GET /profile/activity` | ✓ (shipped 2026-04-18) | same — stats cherry-picks fields from the materialized profile; activity is cursor-paginated, newest first, joined with `conversations` for slug/visibility |
| `GET /shared/:slug`, `PATCH /conversations/:id/visibility` | ✓ (shipped 2026-04-18) | `apps/api/src/routes/conversations.ts`. Shared is visibility-gated (private → 404 unless owner); visibility PATCH is owner-only and returns 404 for "missing or not owned" to avoid leaking existence. |
| `GET /repo/:owner/:name` | ✓ (public, CORS to web origin, not GitHub-gated) | `apps/api/src/routes/repo.ts` |
| `POST /cli-auth/authorize`, `POST /cli-auth/exchange`, `GET /cli-auth/whoami` | ✓ | `apps/api/src/routes/cliAuth.ts` |
| `GET /pricing/models`, `GET /health` | ✓ | `apps/api/src/routes/pricing.ts`, `health.ts` |
| `GET /viewer/session`, `GET /viewer/protected` | ✓ | `apps/api/src/routes/viewer.ts` (used by debug + auth flows) |

**Still to add or modify (verbatim from doc 18 §"Endpoint Status"):**

- Conversations: `GET /conversations` (◐ add filters + visibility), `GET /conversations/:id` (+), `GET /conversations/:id/digest` (+), ~~`PATCH /conversations/:id/visibility` (+)~~ ✓ shipped 2026-04-18, ~~`GET /shared/:slug` (+)~~ ✓ shipped 2026-04-18.
- Profile: ~~`GET /profile/stats` (+)~~ ✓ shipped 2026-04-18, ~~`GET /profile/activity` (+)~~ ✓ shipped 2026-04-18, `GET /profile/public/:username` (+), `PATCH /profile/settings` (+).
- Repos: `GET /repos` (+), `GET /repos/:owner/:name` (+ GitHub-gated, replaces or wraps current `/repo/:owner/:name`), `PATCH /repos/:owner/:name/visibility` (+), `PATCH /repos/:owner/:name/conversations/:id/repo-visibility` (+).
- Tokens: `GET /api-tokens` (+), `POST /api-tokens` (+), `DELETE /api-tokens/:id` (+).
- Misc: `GET /og/profile/:username.png` (+), `POST /sessions/:id/view` (+).

**Corrections to doc 18:**

1. Doc 18 lists `GET /repo/:owner/:name` as the legacy path with a planned
   rename to `/repos/`. The current route is mounted under `/repo/*` (singular)
   with a `WEB_APP_URL` CORS allowance. The rename to plural `/repos/` should
   be paired with the GitHub-gated variant so both are introduced together.
2. The current `/repo/:owner/:name` returns `{ profile, sessionCount, message }`
   based on `getPublicRepoDigestCount`. It is *already* visibility-aware (returns
   `null` profile when `publicCount === 0`), but it does not check viewer
   identity or GitHub permissions. Doc 18's Page 8 contract should note that
   this endpoint is "public aggregate, no auth" until the gated variant lands.

**Total still to do:** 18 endpoints (matches doc 18's count of "13 existing, 18
new").

---

## Design system (against doc 20 "The Archive")

Actual tokens live in
`packages/ui/shared/src/styles/themes/variables.css` (auto-generated from
`themes.ts` + `colors/*.ts`). The web app pulls them via
`packages/ui/web/src/styles/globals.css` → `@howicc/ui-web/globals.css`.

| Aspect | Doc 20 spec | Actual | Status |
|--------|-------------|--------|--------|
| Surface base | `#FAF9F6` warm cream | `oklch(1 0 0)` pure white | + Cream not yet adopted |
| Surface raised | `#F5F2EC` | Same as base | + Tonal lift not implemented |
| Primary accent | `#C15F3C` amber terracotta | `oklch(0.6387 0.2151 36.46)` (warm orange, hue ≈ 36°) | ◐ Close in spirit; deliberate or accidental match — flag for design review |
| Status colors (sage / rust / honey / slate) | Warm, not neon | `oklch(...)` defaults via tweakcn | ◐ Functional but not the warm palette |
| Body type | Inter (UI) | System default | + Inter not loaded |
| Headline type | Source Serif 4 | None | + Serif not loaded; doc 20's editorial voice is invisible |
| Code type | JetBrains Mono | System mono fallback | + |
| Voice / casing | Sentence case ("Sign in", "Create token") | Sentence case where copy exists | ✓ |
| Corner radius | 4 / 8 / 12 / pill (warm soft) | `--radius: 0.65rem` with derived `sm/md/lg/xl/2xl/3xl/4xl` | ◐ Tailwind defaults map close enough; standardize when the cream surfaces land |
| Warm shadows | `shadow-subtle` … `shadow-overlay` | Tailwind defaults | + Cool/neutral shadows in use |
| Timeline component | Signature pattern (icon nodes + connector) for activity feeds, conversation phases, repo activity | Not built | + Critical missing primitive |
| Phase spine (left rail / sticky bar) | Required for `/s/:slug` | Not built | + Depends on timeline + scrollspy work |

The shadcn primitives in `packages/ui/web/src/components/` (button, card, tabs,
accordion, avatar, badge, table, etc.) are the right base layer. They just need
a re-skin pass once the cream surfaces and serif typography land.

---

## Sharing loop status

The "user syncs a session and shares it with a teammate" loop is the headline
JTBD (doc 15). **As of 2026-04-18 it works end-to-end.** The pieces:

1. ✓ **`PATCH /conversations/:id/visibility`** — owner-only. "Not found" and
   "not owned" both return 404 to avoid leaking existence.
2. ✓ **`GET /shared/:slug`** — visibility-gated render read. Public/unlisted
   are world-readable; private is owner-only. Returns the render document
   plus a `sharedMeta` block (slug, conversationId, visibility, ownerUserId,
   isOwner, updatedAt).
3. ✓ **`/s/:slug` owner view** — `pages/s/[slug].astro` with
   `VisibilityMenuIsland` (copy-link button + visibility radio dropdown).
   Blocks render via `components/session/RenderBlocks.astro` (message,
   activity_group with expandable tool_runs/hook_events, callout, todo,
   question, compact_boundary). Plan context card when present. Session
   metadata in a right-hand sidebar.
4. ✓ **`/s/:slug` public view** — same route, visibility-gated.
   Unauthenticated visitors see a "Sign in to sync your own" CTA in the
   sidebar; owners see the `VisibilityMenuIsland`. 404 renders for private
   conversations viewed by non-owners.
5. ✓ **`/home` feed** — activity titles are now links to `/s/:slug`.
   Stats + 10-most-recent feed both live. Remaining polish: "load more"
   interactive island for pagination beyond the first 10.

### Residual work on the sharing loop

- ~~**Slug collision**~~ ✓ resolved 2026-04-18 (migration `0002_slug_unique.sql`).
  `conversations.slug` is now globally unique via
  `conversations_slug_unique_idx`. Uploads call `resolveUniqueSlug` before
  INSERT: base slug first, `${baseSlug}-${last6(conversationId)}` on
  collision, timestamp-suffixed as a last-resort fallback. The migration
  backfills existing duplicates by appending `-${last6(id)}` to all but the
  oldest row per slug. The `getSharedRenderDocumentBySlug` service dropped
  its `ORDER BY updatedAt DESC` workaround.
- ~~**Phase spine / timeline component**~~ ◐ heuristic MVP shipped
  2026-04-18. `classifyPhases` groups blocks into Investigating → Planning
  → Building → Validating → Summary using positional signals (first plan
  marker, first / last write-tool run, final assistant message). Desktop
  renders a vertical sticky rail via `PhaseSpine.astro`; mobile/tablet
  gets a horizontal sticky chip bar inlined at the top of the article.
  Each phase section carries an anchor so the spine is a real TOC. Single-
  phase sessions render unwrapped. Still to do: Claude-style connector
  lines between blocks within a phase, scrollspy-active state, and moving
  the heuristic into `@howicc/render` once it stabilises.
- **Mobile-first polish for public view** — doc 17 calls this the most
  important mobile surface; current layout is desktop-leaning.
- **Artifact drilldown** — `GET /conversations/:id/artifacts/:artifactId`
  exists but isn't wired from `/s/:slug` yet.
- **"Load more" feed pagination** on `/home` — cursor is returned by the API
  but no UI consumes it.

Everything else (insights, repo pages, settings, public profile, sessions
list) is post-loop and can sequence behind these.

---

## Build sequence (re-derived from doc 17 "Build Order Revised")

Doc 17's build order is correct in principle. The actionable rewrite is:

| Wave | Pages | Endpoints to add | Depends on |
|------|-------|------------------|------------|
| **A — Sharing loop** | `/s/:slug` owner, `/s/:slug` public, `/home` (basic feed) | `PATCH /conversations/:id/visibility`, `GET /shared/:slug`, `GET /conversations/:id`, `GET /profile/stats`, `GET /profile/activity` | Timeline component (or interim list), Archive cream + serif rollout |
| **B — Own your data** | `/sessions`, `/settings` | `GET /api-tokens`, `POST /api-tokens`, `DELETE /api-tokens/:id`, `PATCH /profile/settings` | Wave A endpoints |
| **C — Team features** | `/r/:owner/:name`, `/r/:owner/:name/settings` | `GET /repos`, `GET /repos/:owner/:name` (GH-gated), `PATCH /repos/:owner/:name/visibility`, `PATCH /repos/:owner/:name/conversations/:id/repo-visibility` | GitHub permission helper (read repo membership via OAuth token), wave A live |
| **D — Insights + virality** | `/insights`, `/@:username`, polished `/` | `GET /profile/public/:username`, `GET /og/profile/:username.png`, `POST /sessions/:id/view` | All prior waves; OG image worker; profile opt-in flow |

This re-orders doc 17's "Build Order (Revised)" Phase 1 by combining "/home"
into Wave A so the sharing loop has its landing surface at the same time.

---

## Cross-references

- Page wireframes and copy: doc 17 (`17-web-app-pages-and-screens.md`).
- API contracts per page: doc 18 (`18-data-and-api-per-page.md`).
- Visual system: doc 20 (`20-design-md-the-archive.md`).
- Roadmap phases: doc 11 (`11-execution-roadmap.md`).
- UX flows: doc 15 (`15-jtbd-ux-flows-and-user-journey.md`).
- Repo grouping: doc 14. GitHub team access: doc 16.

Update this doc whenever a row changes status. Keep it short — link out for
detail rather than duplicating spec content.
