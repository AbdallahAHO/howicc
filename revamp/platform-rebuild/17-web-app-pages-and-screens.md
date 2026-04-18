# Web App Pages and Screens

Complete page inventory for `apps/web/`. Every page with wireframes, data sources,
responsive behavior, and build phases.

Derived from:
- [15-jtbd-ux-flows-and-user-journey.md](15-jtbd-ux-flows-and-user-journey.md)
- [14-repositories-and-project-grouping.md](14-repositories-and-project-grouping.md)
- [16-team-access-and-github-integration.md](16-team-access-and-github-integration.md)

> **Design direction:** The canonical visual system is **[The Archive](20-design-md-the-archive.md)** —
> warm cream backgrounds, serif page titles, sentence-case UI, soft 8px corners,
> and Claude-style timeline components. The ASCII wireframes below show structure
> and information hierarchy; treat visual styling (colors, typography, corners,
> voice) as specified in doc 20, not in the wireframe characters. Earlier
> references to UPPERCASE labels and `[STATUS]` brackets have been updated to
> sentence case and natural language.

> **Implementation status:** the live audit lives in
> [doc 21](21-implementation-status.md). As of 2026-04-18, `/login`,
> `/cli/login`, `/home` (with live feed + stats linking to `/s/:slug`), and
> `/s/:slug` (owner + public views with visibility toggle + block renderer)
> are all built end-to-end; `/dashboard` redirects 301 to `/home`. `/` is
> a stub. Pages 5, 6, 8, 9, 10, 11 are not yet built. Per-page section
> headings below carry a ✓/◐/+ badge mirroring doc 21.

---

## Design Principles

**1. The shared conversation is the product.** Everything else supports it.
Invest 80% of design effort here.

**2. Narrative over list.** Long sessions have phases. Show them, don't flatten them.

**3. Mobile-first for public reading.** Shared links land on phones. Authenticated
pages (dashboard, settings, repo admin) are desktop-first and get simpler mobile layouts.

**4. Progressive disclosure.** Dense data is available on demand, not upfront.
Collapse aggressively, let users expand.

**5. Warm density.** Dense data but warm to read. Tonal shifts (not hard lines)
define sections. Serif for page titles, sans for UI, mono for code only. Never
pure black or pure white.

**6. Natural language everywhere.** Labels are sentence case ("Create token"),
errors are sentences ("We couldn't connect. Try again?"), section headings are
human ("Recent activity" not "RECENT"). No `[STATUS]` brackets.

**7. Timeline as the signature component.** Any sequence of events — activity
feeds, session block lists, repo activity — uses the vertical timeline pattern
with icon nodes and connector lines. See doc 20 for the full spec.

---

## Page Map

```
  PUBLIC                               AUTHENTICATED
  ──────                               ─────────────
  /                  Landing           /home            Home (feed + stats)
  /login             GitHub OAuth      /insights        Analytics deep-dive
  /s/:slug           Shared session    /sessions        Session list (filterable)
  /@:username        Public profile    /s/:slug         Owner view of conv
                                       /r/:owner/:name  Repo team page
                                       /r/.../settings  Repo moderation (admin)
                                       /settings        Account + tokens + profile

  /cli/login         CLI auth bridge   (shared)
```

### Responsive Breakpoints

```
  mobile        tablet        desktop       wide
  < 768         768-1023      1024-1439     1440+

  Single col    1-2 cols      2-3 cols      3 cols max
  No sidebars   Drawers       Sticky rails  Fixed panels
```

### Navigation

```
  ┌────────────────────────────────────────────────────────────────┐
  │  Desktop (authenticated):                                      │
  │  HowiCC    Home   Sessions   Insights          [avatar]        │
  │            ────                                                │
  │            ↑ active item: amber underline, amber text          │
  │                                                                │
  │  Mobile:                                                       │
  │  ☰  HowiCC                                     [avatar]        │
  │                                                                │
  │  Public pages (logged out):                                    │
  │  HowiCC                                        Sign in         │
  │                                                                │
  │  Serif logo "HowiCC" at 18px weight 500.                      │
  │  Nav links in Inter 14px, sentence case, no brackets.          │
  │  Active link: amber primary text + 2px amber underline.        │
  │  See doc 20 for full spec.                                     │
  └────────────────────────────────────────────────────────────────┘
```

---

## Page 1: Landing (`/`) — ◐ stub

**Auth:** None
**Context:** First-time visitor understanding what HowiCC is
**Key action:** Sign in or install CLI

### Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                                     [Sign in]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                                                                          │
│           Your AI coding sessions, shared as real artifacts.             │
│                                                                          │
│           Not a chat log. The full story —                              │
│           tools, plans, decisions, and code.                            │
│                                                                          │
│           [  Sign in with GitHub  ]    [  How it works  ]              │
│                                                                          │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  LIVE EXAMPLE  (embedded public conversation, real data)                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Fix authentication middleware  ·  1.2h  ·  debugging             │  │
│  │                                                                    │  │
│  │  [─── USER ─────────────────────────────────────────────────]     │  │
│  │  The auth middleware is rejecting valid session cookies...        │  │
│  │                                                                    │  │
│  │  [─── INVESTIGATING ── 12 tool runs ── expand ───────────]        │  │
│  │                                                                    │  │
│  │  [─── ASSISTANT ──────────────────────────────────────────]       │  │
│  │  The issue is in the cookie parsing. SameSite is Strict...        │  │
│  │                                                                    │  │
│  │                                          [Read full session →]   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  $ npm install -g @howicc/cli                                            │
│  $ howicc login                                                          │
│  $ howicc sync                                                           │
│                                                                          │
│  ──────────────────────────────────────────────────────────────────────  │
│  HowiCC · GitHub · Docs                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile

```
┌─────────────────────────────┐
│  HowiCC          [Sign in]  │
├─────────────────────────────┤
│                             │
│  Your AI coding sessions,   │
│  shared as real artifacts.  │
│                             │
│  Not a chat log. The full   │
│  story — tools, plans,      │
│  decisions, and code.       │
│                             │
│  [  Sign in with GitHub  ]  │
│  [  How it works  ]         │
│                             │
│  ─────────────────────────  │
│                             │
│  LIVE EXAMPLE               │
│  ┌─────────────────────────┐│
│  │ Fix auth middleware     ││
│  │ 1.2h · debugging        ││
│  │                         ││
│  │ [User]                  ││
│  │ The auth middleware is  ││
│  │ rejecting valid...      ││
│  │                         ││
│  │ [▸ 12 runs]             ││
│  │                         ││
│  │ [Assistant]             ││
│  │ The issue is in the     ││
│  │ cookie parsing...       ││
│  │                         ││
│  │ [Read full →]          ││
│  └─────────────────────────┘│
│                             │
│  ─────────────────────────  │
│                             │
│  $ npm i -g @howicc/cli     │
│  $ howicc login             │
│  $ howicc sync              │
│                             │
└─────────────────────────────┘
```

**Key principle:** Embed a real shared conversation as the example, not a mockup.
This is the single best demo of what the product does.

---

## Page 2: Login (`/login`) — ✓ built

**Auth:** None (initiates OAuth)
**Context:** OAuth entry point
**Responsive:** Same layout mobile/desktop, centered card

```
          ┌─────────────────────────────────────┐
          │                                     │
          │        Sign in to HowiCC            │
          │                                     │
          │  [  Continue with GitHub  ]         │
          │                                     │
          │  We request access to verify        │
          │  repository permissions.            │
          │                                     │
          │  No code access. No webhooks.       │
          │  Just identity and repo roles.      │
          │                                     │
          └─────────────────────────────────────┘
```

---

## Page 3: CLI Auth Bridge (`/cli/login`) — ✓ built

Already implemented. Same centered card pattern as login.

---

## Page 4: Home (`/home`) — ◐ shell built on shadcn; feed + stats wait on wave-A endpoints

**Auth:** Required
**Replaces:** Previous `/dashboard`
**Context:** The landing page after login. Shows what you've been doing.
**Primary content:** Recent sessions feed (2/3 width)
**Secondary content:** Key stats sidebar (1/3 width)

### Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions  Insights                   abdallah  [avatar] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───── RECENT SESSIONS ────────────────────┐ ┌── SNAPSHOT ────────────┐ │
│  │                                            │ │                        │ │
│  │  ● Add user profile system                │ │  119 sessions          │ │
│  │    personal/howicc · building              │ │  96.2 hours            │ │
│  │    268 msgs · 435 tools · 7.6h · $2.14    │ │                        │ │
│  │    [private]                    2h ago    │ │  ┌──────────────────┐  │ │
│  │                                            │ │  │   $47.80         │  │ │
│  │  ● Fix auth middleware                     │ │  │   total cost     │  │ │
│  │    axetay/really-app · debugging           │ │  └──────────────────┘  │ │
│  │    42 msgs · 67 tools · 1.2h · $0.45      │ │                        │ │
│  │    [unlisted]                   5h ago    │ │  ┌──────────────────┐  │ │
│  │                                            │ │  │  2-day streak    │  │ │
│  │  ● Explore caching strategy                │ │  │  longest: 4      │  │ │
│  │    axetay/really-app · exploring           │ │  └──────────────────┘  │ │
│  │    18 msgs · 23 tools · 0.4h · $0.12      │ │                        │ │
│  │    [private]                    1d ago    │ │  TOP REPOS             │ │
│  │                                            │ │  really-app     47    │ │
│  │  ● Refactor data pipeline                  │ │  howicc         34    │ │
│  │    axetay/really-data · building           │ │  really-data    18    │ │
│  │    156 msgs · 289 tools · 3.1h · $1.20    │ │                        │ │
│  │    [private]                    2d ago    │ │  [ See insights → ]    │ │
│  │                                            │ │                        │ │
│  │  ● Debug deploy failure                    │ │                        │ │
│  │    axetay/really-app · debugging           │ │                        │ │
│  │    31 msgs · 52 tools · 0.8h · $0.30      │ │                        │ │
│  │    [public]                     3d ago    │ │                        │ │
│  │                                            │ │                        │ │
│  │                      [ Load more ]        │ │                        │ │
│  └────────────────────────────────────────────┘ └────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

```
┌─────────────────────────────┐
│  ☰  HowiCC          [ab]    │
├─────────────────────────────┤
│                             │
│  119 sessions · 96.2h       │
│  $47.80 · 2-day streak      │
│                             │
│  RECENT                     │
│  ┌─────────────────────────┐│
│  │ ● Add user profile      ││
│  │   system                ││
│  │   howicc · building     ││
│  │   268 msgs · 7.6h       ││
│  │   [private]       2h ago││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ ● Fix auth middleware   ││
│  │   really-app · debug    ││
│  │   42 msgs · 1.2h        ││
│  │   [unlisted]      5h ago││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ ● Explore caching       ││
│  │   really-app · explore  ││
│  │   18 msgs · 0.4h        ││
│  │   [private]       1d ago││
│  └─────────────────────────┘│
│                             │
│  [ Load more ]              │
│                             │
│  [ See insights → ]         │
└─────────────────────────────┘
```

### Empty state (digestCount === 0)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                          Welcome to HowiCC                               │
│                                                                          │
│                    You haven't synced any sessions yet.                  │
│                                                                          │
│           ┌──────────────────────────────────────────┐                  │
│           │                                          │                  │
│           │  $ npm install -g @howicc/cli            │                  │
│           │  $ howicc login                          │                  │
│           │  $ howicc sync                           │                  │
│           │                                          │                  │
│           └──────────────────────────────────────────┘                  │
│                                                                          │
│                 Your Claude Code sessions will appear here.              │
│                                                                          │
│                          [ CLI docs →  ]                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Data:** `GET /profile/stats` (header) + `GET /profile/activity?limit=20` (feed)

**Changes from v1 of this doc:**
- Removed 5-stat row (AI slop tell)
- Removed bottom 4-panel grid (heatmap, tools, languages, repos)
- Split layout: feed dominant, compact sidebar
- Analytics moved to `/insights`

---

## Page 5: Insights (`/insights`) — + not built

**Auth:** Required
**New page** — splits out analytics from the home feed
**Context:** "How am I using Claude Code?" deep-dive

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions  Insights                   abdallah  [avatar] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Insights                                           [Last 90 days ▼]    │
│                                                                          │
│  ┌─── ACTIVITY HEATMAP ────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │        M   T   W   T   F   S   S                                │    │
│  │  w-12  ░   ░   ▒   ▒   ▓   ░   ░                                │    │
│  │  w-11  ░   ▒   ▓   █   ▓   ░   ░                                │    │
│  │  w-10  ░   ░   ▒   ▓   ░   ░   ░                                │    │
│  │  ...                                                             │    │
│  │  w-0   ░   ▓   ▓   █   ░   ░   ░                                │    │
│  │                                                                  │    │
│  │  16 active days · peak 23:00-02:00 · busiest Thursday           │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─── SESSION TYPES ──────────┐  ┌─── TOP REPOS ─────────────────────┐ │
│  │                             │  │                                    │ │
│  │  building     ████████  56  │  │  axetay/really-app    47 · 136h   │ │
│  │  debugging    █████     34  │  │  personal/howicc      34 ·  96h   │ │
│  │  exploring    ██         18 │  │  axetay/really-data   18 ·  42h   │ │
│  │  investigating █          7 │  │  axetay/branding       8 ·  12h   │ │
│  │  mixed        █           4 │  │  [ 4 more ]                       │ │
│  │                             │  │                                    │ │
│  └─────────────────────────────┘  └────────────────────────────────────┘ │
│                                                                          │
│  ┌─── TOOL CRAFT ─────────────┐  ┌─── LANGUAGES ─────────────────────┐ │
│  │                             │  │                                    │ │
│  │  write    ████████████ 42% │  │  TypeScript   ██████████████  68% │ │
│  │  command  ████████████ 38% │  │  Python       ████            22% │ │
│  │  read     █████        16% │  │  SQL          █                5% │ │
│  │  agent    █             3% │  │  YAML         ░                3% │ │
│  │  plan     ░             1% │  │  Other        ░                2% │ │
│  │                             │  │                                    │ │
│  │  error rate: 2.1%          │  │  1,203 files changed              │ │
│  │  rejection rate: 4.2%      │  │  3,847 files read                 │ │
│  └─────────────────────────────┘  └────────────────────────────────────┘ │
│                                                                          │
│  ┌─── MODELS ─────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  claude-sonnet-4      98 sessions · 3.8M tokens · $38.42          │ │
│  │  claude-opus-4        21 sessions · 0.9M tokens · $9.38           │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Mobile:** Stack all panels vertically. Heatmap scrolls horizontally.

**Data:** `GET /profile` (full UserProfile)

---

## Page 6: Sessions (`/sessions`) — + not built

**Auth:** Required
**Replaces:** Previous `/dashboard/sessions`
**Context:** Find a specific session with filters

### Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions  Insights                   abdallah  [avatar] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Sessions (119)                                                          │
│                                                                          │
│  [ Search... ]  [All repos ▼] [All types ▼] [All ▼] [Date ▼]  [Sort ▼] │
│                                                                          │
│  Showing 119 · 96.2h total · $47.80                                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Add user profile system          howicc         building         │  │
│  │  chore/howicc-revamp · 268 · 435 · 7.6h · $2.14       [private]   │  │
│  │  ──────────────────────────────────────────────────────────────   │  │
│  │  Fix auth middleware              really-app     debugging        │  │
│  │  fix/auth-session · 42 · 67 · 1.2h · $0.45          [unlisted]    │  │
│  │  ──────────────────────────────────────────────────────────────   │  │
│  │  Explore caching strategy         really-app     exploring        │  │
│  │  feat/cache · 18 · 23 · 0.4h · $0.12                  [private]   │  │
│  │  ──────────────────────────────────────────────────────────────   │  │
│  │  ...                                                               │  │
│  │                                                                    │  │
│  │  ← 1  2  3  4  5  6 →                                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile

```
┌─────────────────────────────┐
│  ☰ HowiCC          [ab]     │
├─────────────────────────────┤
│                             │
│  Sessions (119)             │
│                             │
│  [ Search... ]   [ 🎛 ]    │
│  ↑ tap to expand filters    │
│                             │
│  ┌─────────────────────────┐│
│  │ Add user profile system ││
│  │ howicc · building       ││
│  │ 268 · 7.6h · $2.14      ││
│  │ [private]         2h ago││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ Fix auth middleware     ││
│  │ really-app · debug      ││
│  │ 42 · 1.2h · $0.45       ││
│  │ [unlisted]        5h ago││
│  └─────────────────────────┘│
│  ...                        │
│                             │
│  ← 1  2  3 →               │
└─────────────────────────────┘
```

**Empty state with filters:** "No sessions match. [Clear filters]"
**Empty state no filters:** Same as `/home` empty state (CLI install).

**Data:** `GET /profile/activity?page=X&filters=...`

---

## Page 7: Conversation Detail (`/s/:slug`) — THE PRODUCT — ◐ owner + public views live with phase spine; mobile polish / artifact drilldown / scrollspy pending

**The most important page. Invest design effort here.**

### The Phase Spine

The key innovation: instead of a flat block list, the page has a **phase spine**
derived from the block sequence. Phases are detected by analyzing tool category
ratios and activity group clustering:

```
  PHASE DETECTION HEURISTICS
  ──────────────────────────
  Investigating  →  read-heavy, few edits, exploratory queries
  Planning       →  plan artifact, question interactions
  Building       →  write-heavy, edit-heavy, file creation
  Validating     →  bash test runs, type checks, debugging
  Summarizing    →  long final assistant message, no tools

  Phases derived from block runs, displayed as a left rail on desktop,
  a sticky top nav on mobile.
```

### Desktop Owner View (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions  Insights                   abdallah  [avatar] │
├──────────────────────────────────────────────────────────────────────────┤
│  ← Home                                                                 │
│                                                                          │
│  Add user profile system with digest extraction                          │
│  personal/howicc · chore/howicc-revamp-foundation                       │
│  268 msgs · 435 tools · 7.6h · ~$2.14 · building                       │
│                                                                          │
│  [ Visibility: private ▼ ]     [ Copy share link ]     [ Export ▼ ]    │
│                                                                          │
│  ┌─────────────┐ ┌────────────────────────────────────┐ ┌────────────┐ │
│  │             │ │                                    │ │            │ │
│  │  PHASES     │ │  ┌─ PLAN ─────────────────────┐    │ │  CONTEXT   │ │
│  │             │ │  │                            │    │ │            │ │
│  │  ● Plan     │ │  │  ## User Profile           │    │ │  Created   │ │
│  │   ─────     │ │  │     Aggregation System     │    │ │  2h ago    │ │
│  │  │          │ │  │                            │    │ │            │ │
│  │  │ Invest   │ │  │  Build a profile pipeline  │    │ │  Model     │ │
│  │  │  (47)    │ │  │  that extracts digests...  │    │ │  sonnet-4  │ │
│  │  │          │ │  │                 [Show ▼]   │    │ │            │ │
│  │  │          │ │  └────────────────────────────┘    │ │  Cache hit │ │
│  │  ● Build    │ │                                    │ │  96.7%     │ │
│  │  │  (156)   │ │  ─── INVESTIGATING ─────────────   │ │            │ │
│  │  │          │ │                                    │ │  ────────  │ │
│  │  │ Valid    │ │  [User]                            │ │            │ │
│  │  │  (42)    │ │  I've reviewed the revamp docs     │ │  FILES (33)│ │
│  │  │          │ │  and the current code...           │ │  service.ts│ │
│  │  ● Summary  │ │                                    │ │  schema.ts │ │
│  │   ─────     │ │  [▸ Explored codebase · 12 runs]  │ │  assets.ts │ │
│  │             │ │                                    │ │  [ +30 ]   │ │
│  │             │ │  [Assistant]                       │ │            │ │
│  │             │ │  The plan is approved. A few...    │ │  ARTIFACTS │ │
│  │             │ │                                    │ │  1 plan    │ │
│  │             │ │  ─── BUILDING ──────────────────   │ │  18 decis  │ │
│  │             │ │                                    │ │  3 quest   │ │
│  │             │ │  [? Question]                      │ │  5 todos   │ │
│  │             │ │   "Should I start with Phase 1?"   │ │            │ │
│  │             │ │   ● Phase 1 and 2 together         │ │  SUBAGENTS │ │
│  │             │ │     ← selected                     │ │  3 Explore │ │
│  │             │ │                                    │ │  1 Plan    │ │
│  │             │ │  [▸ Built upload service · 47]     │ │  5 general │ │
│  │             │ │                                    │ │            │ │
│  │             │ │  [!] Hook blocked: lint failed     │ │  TOOLS     │ │
│  │             │ │                                    │ │  Bash  145 │ │
│  │             │ │  [⁘ Subagent · Explore · 106]     │ │  Edit  129 │ │
│  │             │ │                                    │ │  Read   84 │ │
│  │             │ │  ─── VALIDATING ────────────────   │ │            │ │
│  │             │ │                                    │ │            │ │
│  │             │ │  [▸ Ran tests · 23 runs]          │ │            │ │
│  │             │ │                                    │ │            │ │
│  │             │ │  ─── SUMMARY ───────────────────   │ │            │ │
│  │             │ │                                    │ │            │ │
│  │             │ │  [Assistant]                       │ │            │ │
│  │             │ │  All tests pass. Here's what       │ │            │ │
│  │             │ │  was implemented...                │ │            │ │
│  │             │ │                                    │ │            │ │
│  └─────────────┘ └────────────────────────────────────┘ └────────────┘ │
│   phase rail      main content (scrollable)              context       │
│   sticky          50ch max width for readability          sticky        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layout specifics:**
- Phase rail: 160px, sticky, shows current phase highlighted as you scroll
- Main content: `max-width: 50ch` (~640px for readability), centered in remaining space
- Context sidebar: 240px, sticky, collapsible

**Activity groups collapsed by default.** User sees `[▸ Explored codebase · 12 runs]`
as a single line. Click to expand. Even a 435-tool session becomes ~20 collapsed
blocks to scan.

### Tablet (768px - 1023px)

```
┌────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions          abdallah  [avatar]   │
├────────────────────────────────────────────────────────┤
│  ← Home                                                │
│                                                        │
│  Add user profile system with digest extraction        │
│  personal/howicc · building                           │
│  268 msgs · 7.6h · $2.14                              │
│                                                        │
│  [ Visibility: private ▼ ] [ Copy link ] [ ⓘ Info ]  │
│                                                        │
│  PHASES:  ● Plan  ─ Invest  ─ Build  ─ Valid  ─ Sum   │
│            (horizontal nav chips, scrollable)          │
│                                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │  ┌─ PLAN ─────────────────────────────────────┐   │ │
│  │  │  ## User Profile Aggregation System         │   │ │
│  │  │  Build a profile pipeline that...  [Show ▼]│   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  │                                                   │ │
│  │  ─── INVESTIGATING ────────────────────────────   │ │
│  │                                                   │ │
│  │  [User] I've reviewed the revamp docs...         │ │
│  │                                                   │ │
│  │  [▸ Explored codebase · 12 runs]                 │ │
│  │                                                   │ │
│  │  [Assistant] The plan is approved...              │ │
│  │                                                   │ │
│  │  ─── BUILDING ─────────────────────────────────   │ │
│  │                                                   │ │
│  │  [? Question] Should I start with Phase 1?        │ │
│  │    ● Phase 1 and 2 together ← selected            │ │
│  │                                                   │ │
│  │  ...                                              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  Info drawer (slides in from right when ⓘ tapped)     │
└────────────────────────────────────────────────────────┘
```

**Tablet pattern:** Phase rail becomes horizontal chips at the top. Context sidebar
becomes a drawer triggered by an info icon. Main content takes full width.

### Mobile (< 768px) — The Critical View

Mobile is the primary context for public shared conversations. This view must be excellent.

```
┌─────────────────────────────┐
│  ← HowiCC       [Sign in]   │
├─────────────────────────────┤
│                             │
│  Add user profile system    │
│  with digest extraction     │
│                             │
│  by abdallah · howicc       │
│  building · 268 msgs · 7.6h │
│                             │
│  ┌─────────────────────────┐│
│  │ ● Plan                  ││ ← sticky phase bar
│  │ ○ ─ ─ ─ ─               ││   shows current phase
│  └─────────────────────────┘│   tap to jump
│                             │
│  ┌─ PLAN ──────────────────┐│
│  │ ## User Profile         ││
│  │ Aggregation System      ││
│  │                         ││
│  │ Build a profile         ││
│  │ pipeline that...        ││
│  │                [Show ▼] ││
│  └─────────────────────────┘│
│                             │
│  ── INVESTIGATING ───────   │
│                             │
│  [User]                     │
│  I've reviewed the revamp   │
│  docs and the current code. │
│                             │
│  [▸ Explored codebase       │
│     12 tool runs ]          │
│                             │
│  [Assistant]                │
│  The plan is approved. A    │
│  few tactical observations  │
│  before you start...        │
│                             │
│  ── BUILDING ────────────   │
│                             │
│  [? Question]               │
│  Should I start with        │
│  Phase 1?                   │
│  ● Phase 1 and 2 together   │
│                             │
│  [▸ Built upload service    │
│     47 tool runs ]          │
│                             │
│  [!] Hook blocked:          │
│  lint failed                │
│                             │
│  [⁘ Subagent · Explore      │
│     106 events ]            │
│                             │
│  ...                        │
│                             │
│  ─────────────────────────  │
│  Shared via HowiCC          │
│  howi.cc/cli                │
└─────────────────────────────┘
```

**Mobile specifics:**
- Phase bar is sticky under the nav, scrollable chips, shows current phase
- Max width: viewport - 16px padding
- Block containers full width
- No sidebar — "info" button in header opens bottom sheet with stats/files/artifacts
- Activity groups default-collapsed (tap to expand)
- User/assistant messages use subtle color differentiation, not boxed borders
- Touch targets ≥ 44px

### Public View vs Owner View

**Differences:**
- Public: no visibility dropdown, no "Copy share link" button, no export
- Public: shows "by <author>" in header
- Public: footer includes "Shared via HowiCC · howi.cc/cli" attribution
- Public: no context sidebar on desktop (or heavily simplified)
- Public: session info (cost, cache hit) hidden by default, "Show details" toggle

### Empty/Error States

```
  /s/:slug returns 404:
  ┌─────────────────────────────────────────┐
  │                                         │
  │     Conversation not found              │
  │                                         │
  │     This conversation doesn't exist     │
  │     or has been made private.           │
  │                                         │
  │     [  Back to home  ]                  │
  │                                         │
  └─────────────────────────────────────────┘
```

**Data:**
- Owner: `GET /conversations/:id` + `GET /conversations/:id/render` + `GET /conversations/:id/digest`
- Public: `GET /shared/:slug`
- Visibility: `PATCH /conversations/:id/visibility`

---

## Page 8: Repository Page (`/r/:owner/:name`) — + not built (public aggregate endpoint live, not GH-gated, no UI)

**Auth:** Required. GitHub permission checked on view.
**Structure:** Stats-led, with contributors as a prominent expandable panel

### Desktop — Contributor View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC   Home  Sessions  Insights                   abdallah  [avatar] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  axetay/really-app                                  Your role: member    │
│  47 sessions · 3 contributors · members visibility                      │
│                                                                          │
│  ┌── AGGREGATE ────────────────────────────────────────────────────────┐ │
│  │  136.2h duration  ·  $38.40 est cost  ·  12,847 tool runs          │ │
│  │  Session types:  building 24 · debugging 14 · exploring 6 · 3      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── CONTRIBUTORS ─────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ┌─────────────────────┐ ┌─────────────────────┐                   │ │
│  │  │  abdallah            │ │  sarah               │                   │ │
│  │  │  32 sessions  ·  94h │ │  10 sessions  ·  28h │                   │ │
│  │  │                      │ │                      │                   │ │
│  │  │  build  ████████ 18  │ │  build  ████ 6       │                   │ │
│  │  │  debug  █████    10  │ │  debug  ██   3       │                   │ │
│  │  │  explore ██        4 │ │  explore █   1       │                   │ │
│  │  │                      │ │                      │                   │ │
│  │  │  Top: TypeScript     │ │  Top: TypeScript     │                   │ │
│  │  │  Last active: 2h ago │ │  Last active: 1d ago │                   │ │
│  │  │  [ View sessions ]   │ │  [ View sessions ]   │                   │ │
│  │  └──────────────────────┘ └──────────────────────┘                   │ │
│  │                                                                     │ │
│  │  ┌─────────────────────┐                                            │ │
│  │  │  carlos              │                                            │ │
│  │  │  5 sessions  ·  14h  │                                            │ │
│  │  │  build  ██ 3         │                                            │ │
│  │  │  debug  █  2         │                                            │ │
│  │  │  Last active: 3d ago │                                            │ │
│  │  │  [ View sessions ]   │                                            │ │
│  │  └──────────────────────┘                                            │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── LANGUAGES & TOOLS (side-by-side) ────────────────────────────────┐ │
│  │  TypeScript  ██████████ 78  │  write     ████████████ 45%          │ │
│  │  Python      ████       32  │  command   ███████████  40%          │ │
│  │  SQL         ██         14  │  read      ████         12%          │ │
│  │  YAML        █           8  │  agent     █             3%          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  RECENT SESSIONS                                           [All → ]      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ● Fix auth middleware          abdallah   debug  1.2h  $0.45      │ │
│  │  ● Add caching layer            sarah      build  2.4h  $0.89      │ │
│  │  ● Debug deploy failure         abdallah   debug  0.8h  $0.30      │ │
│  │  ● Refactor auth tests          carlos     build  1.1h  $0.42      │ │
│  │                                                                    │ │
│  │                                         [ Load more sessions ]     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Contributor cards are the hero.** Each card is clickable, drilling into that
contributor's session history for this repo.

### Admin View

Same layout, plus:
- `[ Settings ⚙ ]` button in header
- Each session row has `[⋯]` menu with "Hide from repo page"
- Hidden sessions section at the bottom (collapsed by default)

### No Access (private repo, non-member)

```
          ┌─────────────────────────────────────┐
          │                                     │
          │    Repository not found              │
          │                                     │
          │    This repo doesn't exist or you    │
          │    don't have access to it.          │
          │                                     │
          │    [  Back to home  ]                │
          │                                     │
          └─────────────────────────────────────┘
```

### Mobile

```
┌─────────────────────────────┐
│  ← HowiCC          [ab]     │
├─────────────────────────────┤
│                             │
│  axetay/really-app          │
│  Your role: member          │
│                             │
│  47 sessions · 3 contrib    │
│  136.2h · $38.40            │
│                             │
│  TYPES                      │
│  build 24 · debug 14        │
│  explore 6 · invest 3       │
│                             │
│  CONTRIBUTORS               │
│  ┌─────────────────────────┐│
│  │ abdallah                ││
│  │ 32 sessions · 94h       ││
│  │ build 18 · debug 10     ││
│  │ Last: 2h ago            ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ sarah                   ││
│  │ 10 sessions · 28h       ││
│  │ build 6 · debug 3       ││
│  │ Last: 1d ago            ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ carlos                  ││
│  │ 5 sessions · 14h        ││
│  │ build 3 · debug 2       ││
│  │ Last: 3d ago            ││
│  └─────────────────────────┘│
│                             │
│  RECENT                     │
│  ┌─────────────────────────┐│
│  │ ● Fix auth middleware   ││
│  │   abdallah · debug · 1h ││
│  └─────────────────────────┘│
│  ...                        │
│                             │
│  [ Load more ]              │
└─────────────────────────────┘
```

**Data:** `GET /repos/:owner/:name` (GitHub-gated)

---

## Page 9: Repository Settings (`/r/:owner/:name/settings`) — + not built

**Auth:** Required. Admin/maintainer only (GitHub verified).
**Changes from v1:** Removed "Danger Zone" section (over-engineered for one button).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← axetay/really-app                                                     │
│                                                                          │
│  Repository Settings                                                     │
│                                                                          │
│  ┌── VISIBILITY ──────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Who can see this repository's page on HowiCC?                     │ │
│  │                                                                    │ │
│  │  ● Private                                                        │ │
│  │    Only you (and other admins) can see the page.                   │ │
│  │                                                                    │ │
│  │  ○ Members                                                        │ │
│  │    People with GitHub push access can see aggregate stats.         │ │
│  │                                                                    │ │
│  │  ○ Public                                                         │ │
│  │    Anyone can see aggregate stats and published conversations.     │ │
│  │                                                                    │ │
│  │  Individual conversation owners always control their own           │ │
│  │  conversation visibility. This setting is the ceiling — it         │ │
│  │  cannot force a private conversation to become public.             │ │
│  │                                                                    │ │
│  │                                               [  Save changes  ]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── HIDDEN CONVERSATIONS ────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Hidden from the repo page by admins.                              │ │
│  │  Owners can still share them via direct link.                      │ │
│  │                                                                    │ │
│  │  Debugging prod secrets      abdallah   2d ago         [ Unhide ] │ │
│  │                                                                    │ │
│  │  (empty state if none)                                             │ │
│  │  Nothing hidden.                                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Page 10: Settings (`/settings`) — + not built

**Auth:** Required
**Changes from v1:** Merged account and CLI tokens into one page with stacked sections (no sidebar — 2 sections don't need one).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Settings                                                                │
│                                                                          │
│  ┌── ACCOUNT ─────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Name:   Abdallah Othman                                           │ │
│  │  Email:  abdallah@example.com                                      │ │
│  │                                                                    │ │
│  │  Connected:  GitHub · abdallah · repo, user:email                  │ │
│  │                                                                    │ │
│  │  [ Delete account ]                                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── CLI TOKENS ──────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Most users don't need these. `howicc login` creates tokens       │ │
│  │  automatically via browser-based auth.                             │ │
│  │                                                                    │ │
│  │  hwi_a3f7...    Created Apr 2   Active     [ Revoke ]             │ │
│  │  hwi_8b2d...    Created Mar 15  Revoked                           │ │
│  │                                                                    │ │
│  │  [ Create new token ]                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Page 11: Public Profile (`/@:username`) — + not built

**Auth:** None (public, opt-in by owner)
**Context:** The viral, shareable version of your HowiCC identity
**JTBD:** J1 extended — **When** I want to show the world (or my network) how I work with AI,
**I want to** share a beautiful public page with my stats, personality, and best sessions,
**So that** people understand my workflow and discover HowiCC themselves.

### Why This Page Is Different

Every other page serves a specific workflow. This page exists to be **shared**.
That changes everything:

1. **It must survive screenshot.** The hero section is designed to be screenshotted
   and posted to Twitter/LinkedIn/Bluesky without context.
2. **It must have an OG image.** Auto-generated social card with key stats is
   non-negotiable — this is what appears when someone pastes the link.
3. **It must feel like a personality.** GitHub's contribution graph is popular
   because it feels like a fingerprint. We have richer data.
4. **It must convert viewers.** Every visitor who isn't signed in is a potential
   user. The CTA to create their own must be obvious without being obnoxious.
5. **The URL must be memorable.** `howi.cc/@abdallah` is tweetable.
   `howi.cc/users/abc-def-123` is not.

### Viral Mechanics (What Makes People Share)

```
  TRIGGER                          MECHANIC
  ───────                          ────────
  Identity signaling               "I use Opus 4" / "TypeScript builder"
  Achievement flex                 "42-day streak" / "Top 5% cost-efficient"
  Personality test vibes           Session type mix = "85% builder, 15% debugger"
  Number porn                      "12,847 tool runs" / "4.2M tokens"
  Aesthetic appeal                 Activity heatmap looks like art
  Conversation highlights          "My most popular shared session"
  Comparison hooks                 Percentiles, badges, peer metrics
  FOMO for viewers                 "Create yours in 30 seconds"
```

**Not every user opts in.** Public profile is explicit opt-in at `/settings`:
```
[ ] Make my profile public at howi.cc/@abdallah
    Shows: aggregate stats, public conversations, activity heatmap
    Hides: private sessions, cost details, repositories
```

### Desktop Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                               [Create yours →]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌── HERO (screenshot-ready) ─────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │   ┌─────┐                                                          │ │
│  │   │ AO  │   Abdallah Othman                                        │ │
│  │   │  ●  │   @abdallah                                              │ │
│  │   └─────┘   axetay.com  ·  github.com/abdallah                     │ │
│  │                                                                    │ │
│  │   119 sessions  ·  96 hours  ·  42-day streak                     │ │
│  │                                                                    │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │ │
│  │   │  BUILDER    │ │  NIGHT OWL  │ │  EXPLORER   │                 │ │
│  │   │  47% of     │ │  peak 23:00 │ │  top 10%    │                 │ │
│  │   │  sessions   │ │             │ │  in tools   │                 │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘                 │ │
│  │                                                                    │ │
│  │   [ Share profile ]   [ Follow on GitHub ]                         │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── ACTIVITY ────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │   Past year · click any day to see sessions                        │ │
│  │                                                                    │ │
│  │        Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep         │ │
│  │   Mon  ░░▒░  ▒▓░▒  ▓█▒░  ▒░░▓  ░▒▓░  ▓▒░░  ▒░░▓  ░▒▒░  ▓░░▒        │ │
│  │   Tue  ▒░▓▒  ░▓▒█  ▒▓█░  ▓▒░▒  ▒░▒▓  ░▓▒░  ▓░▓▒  ▒▓░░  ░▓▒░        │ │
│  │   Wed  ▓▒░▓  ▒█▓░  █▓▒▒  ░▓▓█  ▓▒▓░  ▒░▓▓  ░▓░█  ▓░▒▓  ▒░▓▒        │ │
│  │   Thu  █▓▒█  ▓█▒▓  ▒█▓█  █▒▓▓  █▓█▒  ▓█▒█  █▒▓█  ▒█▓░  ▓█▒█        │ │
│  │   Fri  ▓░▒▓  ░▓▒░  ▒▓█▒  ▓▒░▓  ▒▓▒░  ▓▒█░  ▒░▓▒  ▓░▒▓  ░▒▓░        │ │
│  │   Sat  ░░▒░  ░▒░░  ░▒░▒  ▒░░░  ░░▒░  ▒░░▒  ░░░▒  ░▒░░  ▒░░░        │ │
│  │   Sun  ░░░▒  ░░▒░  ░░░░  ▒░░░  ░░░▒  ░░▒░  ▒░░░  ░░░▒  ░░▒░        │ │
│  │                                                                    │ │
│  │   16 active days this month · current streak: 42 days              │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── WHO I AM ────────────┐ ┌── WHAT I BUILD WITH ─────────────────── │ │
│  │                         │                                          │ │
│  │  SESSION TYPES          │  LANGUAGES                                │ │
│  │  ┌───────────────────┐  │  TypeScript   ████████████████████ 68%  │ │
│  │  │ ██████ 47% build  │  │  Python       ██████              22%   │ │
│  │  │ ████   28% debug  │  │  SQL          ██                    5%  │ │
│  │  │ ██     14% expl   │  │  YAML         █                     3%  │ │
│  │  │ █       7% invest │  │  Other        ░                     2%  │ │
│  │  │ ░       4% mixed  │  │                                          │ │
│  │  └───────────────────┘  │  TOP TOOLS                                │ │
│  │                         │  Bash     ████████  12,847               │ │
│  │  🌙 Night owl           │  Edit     ███████   10,234                │ │
│  │  Peak: 23:00 — 02:00    │  Read     █████      8,127                │ │
│  │                         │  Write    ██         2,341                │ │
│  │  🏆 4-day best streak   │  Glob     █            912                │ │
│  │                         │                                          │ │
│  └─────────────────────────┘ ──────────────────────────────────────── │ │
│                                                                          │
│  ┌── PUBLIC SESSIONS (8) ─────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐         │ │
│  │  │ Fix auth middleware     │  │ Add caching layer       │         │ │
│  │  │ really-app · debugging  │  │ really-app · building   │         │ │
│  │  │                         │  │                         │         │ │
│  │  │ "The auth middleware    │  │ "Need to add Redis      │         │ │
│  │  │  is rejecting valid     │  │  caching to the user    │         │ │
│  │  │  session cookies..."    │  │  profile endpoints..."  │         │ │
│  │  │                         │  │                         │         │ │
│  │  │ 42 msgs · 67 tools      │  │ 89 msgs · 134 tools     │         │ │
│  │  │ 1.2h · 👀 248 views     │  │ 2.4h · 👀 56 views      │         │ │
│  │  └─────────────────────────┘  └─────────────────────────┘         │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐         │ │
│  │  │ Debug deploy failure    │  │ Refactor pipeline       │         │ │
│  │  │ really-app · debugging  │  │ really-data · building  │         │ │
│  │  │ ...                     │  │ ...                     │         │ │
│  │  └─────────────────────────┘  └─────────────────────────┘         │ │
│  │                                                                    │ │
│  │                                         [ See all 8 sessions → ]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── WORKS ON ────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Public repositories this user has synced sessions from            │ │
│  │                                                                    │ │
│  │  ● axetay/really-app           47 sessions                         │ │
│  │  ● personal/howicc             34 sessions                         │ │
│  │  ● axetay/really-data          18 sessions                         │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── CTA ─────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │     Create your own HowiCC profile in 30 seconds.                  │ │
│  │                                                                    │ │
│  │     [  Sign in with GitHub  →  ]                                   │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout

Mobile is critical here — most people clicking a shared profile link will be on a phone.

```
┌─────────────────────────────┐
│  HowiCC        [Create →]   │
├─────────────────────────────┤
│                             │
│       ┌──────┐              │
│       │  AO  │              │
│       │   ●  │              │
│       └──────┘              │
│                             │
│   Abdallah Othman           │
│   @abdallah                 │
│                             │
│   119 sessions              │
│   96 hours                  │
│   42-day streak             │
│                             │
│  ┌─────────────────────────┐│
│  │  BUILDER                ││
│  │  47% of sessions        ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  NIGHT OWL              ││
│  │  peak 23:00             ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  EXPLORER               ││
│  │  top 10% in tools       ││
│  └─────────────────────────┘│
│                             │
│  [ Share profile ]          │
│                             │
│  ─────────────────────────  │
│                             │
│  ACTIVITY (past year)       │
│  ┌─────────────────────────┐│
│  │ ░▒▓█▓▒░░▒▓█▓▒░░▒▓       ││
│  │ ░▒▓█▓▒░░▒▓█▓▒░░▒▓       ││ ← horizontal scroll
│  │ ░▒▓█▓▒░░▒▓█▓▒░░▒▓       ││
│  │ ▒▓█▓▒░▒▓█▓▒░▒▓█▓▒       ││
│  └─────────────────────────┘│
│  16 active days this month  │
│                             │
│  ─────────────────────────  │
│                             │
│  SESSION TYPES              │
│  ██████ 47% building        │
│  ████   28% debugging       │
│  ██     14% exploring       │
│  █       7% investigating   │
│  ░       4% mixed           │
│                             │
│  LANGUAGES                  │
│  TypeScript  ████████ 68%   │
│  Python      ████     22%   │
│  SQL         █         5%   │
│                             │
│  ─────────────────────────  │
│                             │
│  PUBLIC SESSIONS (8)        │
│  ┌─────────────────────────┐│
│  │ Fix auth middleware     ││
│  │ really-app · debugging  ││
│  │ 42 msgs · 1.2h          ││
│  │ 👀 248 views            ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ Add caching layer       ││
│  │ really-app · building   ││
│  │ 89 msgs · 2.4h          ││
│  │ 👀 56 views             ││
│  └─────────────────────────┘│
│  ...                        │
│                             │
│  [ See all 8 → ]            │
│                             │
│  ─────────────────────────  │
│                             │
│    Create your own profile  │
│    in 30 seconds            │
│                             │
│  [ Sign in with GitHub → ]  │
│                             │
└─────────────────────────────┘
```

### The OG Image (Social Card)

When the link is pasted anywhere that expands previews, render this 1200×630 image:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                                                                  │
│     ┌────┐    Abdallah Othman                                    │
│     │ AO │    @abdallah · howi.cc                                │
│     └────┘                                                       │
│                                                                  │
│                                                                  │
│     119 sessions  ·  96 hours  ·  42-day streak                 │
│                                                                  │
│                                                                  │
│     ████████ 47%  building                                       │
│     █████    28%  debugging                                      │
│     ██       14%  exploring                                      │
│                                                                  │
│                                                                  │
│     TypeScript · Python · SQL                                    │
│                                                                  │
│                                                                  │
│                                           HowiCC ─────           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Generated server-side via an OG image endpoint (`/og/profile/:username.png`).
Uses the same data as the live page but renders statically.

### Badges System (Identity Signals)

Badges are the viral fuel. They give people something to flex. Pick 3 to display
in the hero based on priority:

```
  BADGE              TRIGGER
  ─────              ───────
  🏗 BUILDER         > 40% building sessions
  🐛 DEBUGGER        > 40% debugging sessions
  🔍 EXPLORER        > 40% exploring sessions
  🌙 NIGHT OWL       peak activity 22:00-04:00
  🌅 EARLY BIRD      peak activity 05:00-09:00
  🔥 ON FIRE         current streak ≥ 7 days
  💎 OPUS USER       > 50% sessions use claude-opus
  🧠 DEEP THINKER    > 30% sessions use thinking mode
  ⚡ CACHE MASTER    > 90% cache hit rate average
  📚 POLYGLOT        ≥ 5 languages used
  🎯 PR AUTHOR       ≥ 10 sessions with PR links
  👥 TEAM PLAYER     contributes to ≥ 5 repos
  🏆 TOP 1%          top 1% by sessions in last 30 days
  💰 COST EFFICIENT  top 10% by tokens-per-dollar
  🔁 CONSISTENT      30+ day streak
```

### Privacy Guarantees

Every data point on this page must come from **public-safe aggregates only**.

```
  SHOWN                              HIDDEN
  ─────                              ──────
  Aggregate session count            Individual private sessions
  Aggregate duration                 Private session titles
  Activity heatmap (day-level)       Session content
  Session type distribution          Repositories (unless opted in)
  Language distribution              File paths
  Top tool names                     Tool inputs/outputs
  Public session cards               Private session cards
  Cost (opt-in)                      Exact cost (opt-in)
  Streaks                            When you slept
```

**Granular opt-in controls** in `/settings`:
```
  Profile is public                         [ on ]
  Show activity heatmap                     [ on ]
  Show cost estimate                        [ off ]
  Show repositories                         [ on, public only ]
  Show session type breakdown               [ on ]
  Show tool/language stats                  [ on ]
  Show badges                                [ on ]
```

### Empty State (Profile Exists But No Public Data)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│        ┌─────┐                                                   │
│        │ AO  │   Abdallah Othman                                 │
│        │  ●  │   @abdallah                                       │
│        └─────┘                                                   │
│                                                                  │
│        119 sessions · 96 hours · 42-day streak                   │
│                                                                  │
│        No public sessions yet.                                   │
│                                                                  │
│        This person hasn't shared any conversations publicly.     │
│                                                                  │
│                                                                  │
│        ────────────────────                                      │
│                                                                  │
│        Create your own HowiCC profile                            │
│        [ Sign in with GitHub → ]                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Interactions That Drive Sharing

1. **"Share profile" button** — one-click copy link, or open native share sheet
   on mobile. Pre-fills message: "Check out my HowiCC profile → howi.cc/@abdallah"

2. **"Download stats image"** — generates a PNG from the hero section for posting
   to Twitter/Instagram. People screenshot anyway — make it look good.

3. **"View your own"** — for signed-in viewers looking at someone else's profile,
   a subtle link "→ See your profile" creates a comparison loop.

4. **"Challenge a friend"** — planted CTA: "Know another dev who ships fast?
   Share HowiCC with them." Generates referral hooks.

5. **Click badges for context** — clicking "NIGHT OWL" opens a tooltip explaining
   the criteria. Makes badges feel earned, not assigned.

### Data Sources

```
GET /@:username (server-rendered, SSR for SEO + OG tags)
  → GET /profile/public/:username (new endpoint)
  → returns: UserPublicProfile {
      username, displayName, avatarUrl, links,
      stats: { sessionCount, totalHours, currentStreak, longestStreak },
      badges: Badge[],
      activity: { heatmap: DailyActivity[] },
      sessionTypes: Record<SessionType, number>,
      languages: Record<string, number>,
      topTools: Array<{ name, count }>,
      publicSessions: ConversationSummary[],
      publicRepos: Array<{ fullName, sessionCount }>,
    }

GET /og/profile/:username.png (OG image generation, edge-cached)
```

**All fields are filtered by `user_profiles.public_settings` before return.**

### URL Structure

- Canonical: `/@:username` (e.g., `/@abdallah`)
- Alternate: `/u/:username` redirects to `/@:username`
- Username comes from the GitHub `login` field — no custom usernames in v1
- Case-insensitive lookup, canonicalized to lowercase in URL

### Build Considerations

- **SSR is mandatory.** Social card crawlers (Twitter, Slack, Discord) don't execute
  JavaScript. The page must return HTML with correct OG meta tags on first request.
- **Edge caching.** The public profile endpoint and OG image should be cached at
  Cloudflare edge with stale-while-revalidate (5 min TTL is fine).
- **View counter.** Each public session shows `👀 248 views`. Tracked via a simple
  counter endpoint — bumps on shared page views (not owner views).
- **Username collision with existing routes.** Make sure `@home`, `@settings`, etc.
  aren't possible usernames. GitHub's reserved name list is a good starting point.

---

## Page Summary

> **Implementation status:** see [doc 21](21-implementation-status.md) for the
> live audit. The status column below is a snapshot — `✓` built, `◐` partial,
> `+` not built. Update doc 21 when a row changes; treat that doc as the
> source of truth.

| # | Route | Auth | Status | Primary context |
|---|-------|------|--------|-----------------|
| 1 | `/` | None | ◐ | Desktop + mobile — landing (current page is a stub) |
| 2 | `/login` | None | ✓ | Desktop + mobile — OAuth |
| 3 | `/cli/login` | Session | ✓ | Desktop (CLI bridge) |
| 4 | `/home` | Required | ◐ | Desktop primary, mobile supported. Shell built on shadcn (`@howicc/ui-web`) with welcome block, two-column layout, account card, stats placeholder, and wave-status cards. Feed awaits `GET /profile/activity`; stats await `GET /profile/stats`. `/dashboard` issues a 301 redirect to `/home`. |
| 5 | `/insights` | Required | + | Desktop primary |
| 6 | `/sessions` | Required | + | Desktop primary, mobile supported |
| 7 | `/s/:slug` | Conditional | ◐ | **Mobile-first for public**, desktop for owner. Route + owner/public views + visibility toggle (`VisibilityMenuIsland`) + block renderer shipped 2026-04-18. Remaining: phase spine, mobile-first polish for the public read, artifact drilldown. |
| 8 | `/r/:owner/:name` | GH-gated | + | Desktop primary, mobile supported. `GET /repo/:owner/:name` exists today but is public/un-gated; UI is not built. |
| 9 | `/r/.../settings` | Admin+GH | + | Desktop primary |
| 10 | `/settings` | Required | + | Desktop primary |
| 11 | `/@:username` | None (opt-in) | + | **Mobile-first viral profile** (shareable) |
| — | `/debug/auth` | Either | ✓ | Internal diagnostic page, not part of the user-facing surface. |

### Responsive Strategy By Page

```
PAGE             DESKTOP          TABLET           MOBILE
────             ───────          ──────           ──────
/                3-col hero       2-col hero       Stacked
/home            2-col feed+side  1-col feed       1-col feed
/insights        2-col grid       1-col stack      1-col stack
/sessions        Table            Cards            Cards
/s/:slug owner   3-col w/ spine   1-col + drawer   1-col + sticky phase
/s/:slug public  2-col            1-col            **Primary target**
/r/:owner/:name  Card grid        1-col            1-col
/r/.../settings  1-col            1-col            1-col
/settings        1-col stacked    1-col            1-col
/@:username      2-col hero       1-col            **Primary target (viral)**
```

### Build Order (Revised)

> **Status as of 2026-04-18:** waves below are not yet started. Phases 1–5 of
> the platform roadmap (schemas, parser, CLI, contracts, API + storage) are
> complete; this section is the next-up sequence for the web surface. See
> [doc 21](21-implementation-status.md) for the full status board and the
> wave-by-wave dependency graph.

```
PHASE 1 / WAVE A: The sharing loop (mobile-first public view)
  /s/:slug public  — with phase spine, full mobile adaptation
  /s/:slug owner   — visibility toggle to enable sharing
  /home            — replaces the current /dashboard stub; basic feed
                     so owners can find the session they want to share

PHASE 2 / WAVE B: Own your data
  /sessions        — find specific sessions
  /settings        — account + tokens (stacked, no sidebar)

PHASE 3 / WAVE C: Team features
  /r/:owner/:name  — contributor cards as hero
  /r/.../settings  — visibility + hide moderation
  (also: GitHub-gated variant of the existing /repo/:owner/:name endpoint)

PHASE 4 / WAVE D: Insights depth
  /insights        — analytics deep-dive
  /@:username      — public profile + OG image
  /                — polished landing with embedded example
```

---

## What Changed From v1 Of This Doc

Based on the critique:

1. **Conversation detail gets the phase spine** — left rail (desktop) / sticky bar
   (mobile) showing narrative phases (Investigating → Planning → Building → Validating → Summary).
   Activity groups default-collapsed.

2. **Dashboard split: feed + sidebar** — `/home` is 2/3 recent sessions feed, 1/3
   sidebar with key stats. Removed the 5-stat row and the 4-panel analytics grid.

3. **Analytics moved to `/insights`** — new dedicated page for heatmap, session
   types, tools, languages, models. Keeps the home page focused.

4. **Full mobile design for public conversation view** — phase bar as sticky chips,
   info in bottom sheet, 44px touch targets, no side panels. This is the most
   important mobile view.

5. **Repo page: contributor cards as hero** — elevated from one-of-four panel to
   the central feature. Each card is clickable for drill-down.

6. **Settings flattened** — no sidebar (2 sections don't justify it), stacked
   account + tokens on one page. Dropped "Danger Zone" section (one button doesn't
   need a section).

7. **Empty states explicit** — first-time user, filtered empty list, 404 conversation,
   no-access repo, no hidden conversations.

8. **Navigation simplified** — `/home`, `/sessions`, `/insights` as top-level nav.
   Avatar dropdown for settings.

9. **Visual direction: The Archive** — canonical visual system is doc 20
   (warm cream, serif titles, Inter UI, mono only for code, timeline as
   signature component, sentence-case labels, soft 8px corners). Doc 19
   (Developer Brutalism) is archived as an alternative.
