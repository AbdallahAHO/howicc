# JTBD, UX Flows, and User Journey: CLI to Shared Session

> **Visual direction:** The wireframes below show structure and information
> flow. Visual styling (colors, typography, voice, components) is specified
> in **[The Archive](20-design-md-the-archive.md)** — warm cream backgrounds,
> serif page titles, sentence-case UI, timeline components. ASCII elements
> like `[ button ]` and `ERR:` are wireframe notation; actual UI uses the
> warmer conventions from doc 20.

## Core Job To Be Done

**When** I finish an AI-assisted coding session that solved something interesting,
**I want to** share it as a structured, readable artifact — not a raw chat log,
**So that** others can see how the problem was approached, what tools were used,
what decisions were made, and learn from the collaboration.

---

## Supporting Jobs

### J1: Understand My Own Work Patterns
**When** I use Claude Code across many sessions and projects,
**I want to** see how I work — tools, languages, costs, habits,
**So that** I can optimize my workflow, justify spend, and track progress.

### J2: Show My Team How AI Is Used On Our Repo
**When** our team works on the same codebase with AI assistance,
**I want to** see aggregated AI usage across contributors,
**So that** we understand collective patterns and share effective approaches.

### J3: Inspect Before Sharing
**When** I'm about to share a session publicly,
**I want to** preview exactly what others will see,
**So that** I don't accidentally expose secrets, private paths, or messy drafts.

### J4: Keep My Sessions Durable
**When** Claude Code purges old sessions from disk,
**I want to** know my important sessions are backed up with full context,
**So that** I can revisit them months later with all tool outputs preserved.

### J5: Gate Repo Access By Real Permissions
**When** someone views a repo page on HowiCC,
**I want** their access verified against GitHub in real-time,
**So that** only people who actually have access to the repo see the team view.

### J6: Moderate The Repo Page
**When** a team member's public session contains something inappropriate on
the repo page,
**I want** to hide it as a repo admin,
**So that** the repo's public presence stays useful and appropriate.

### J7: See My Team's AI Usage In One Place
**When** our team uses Claude Code on the same repo,
**I want** to see everyone's aggregate AI usage (tools, languages, costs, patterns),
**So that** I can understand how we collectively use AI on this codebase.

### J8: Protect Private Repo Data
**When** our repo is private on GitHub,
**I want** HowiCC to treat it as private too,
**So that** our internal work patterns aren't exposed to non-members.

> **Team JTBD details:** See [16-team-access-and-github-integration.md](16-team-access-and-github-integration.md)
> for full GitHub permission verification, role mapping, visibility ceiling/floor
> model, and admin moderation flows.

---

## Actors

```
  Developer  ── uses CLI locally, owns sessions
  Viewer     ── arrives via shared link, reads the session
  Repo Admin ── GitHub admin/maintainer, moderates repo page
  Contributor── GitHub push access, sees team aggregate stats
```

---

## The Five Scenes

```
 SCENE 1        SCENE 2        SCENE 3          SCENE 4          SCENE 5
 --------       --------       --------         --------         --------
 Local          Decide &       Upload &         Browse &         Share &
 Work           Inspect        Sync             Explore          View

 Claude Code    howicc list    howicc sync      Dashboard        Public page
 session        howicc         CLI uploads      Conversations    Shared link
 happens        inspect        3 assets         Profile          Repo page
                howicc                          Projects
                preview
```

---

## Scene 1: Local Work (No HowiCC Involved)

The developer uses Claude Code normally. Sessions accumulate at:
```
~/.claude/projects/<project-key>/<session-id>.jsonl
                                 /tool-results/
                                 /subagents/<agent-id>.jsonl
                                 /subagents/<agent-id>.meta.json
```

No action from the user. HowiCC is passive.

---

## Scene 2: Decide & Inspect

### Flow: Discovery

```
┌─────────────────────────────────────────────────────────────────────┐
│ $ howicc list                                                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SESSION                TITLE              BRANCH     AGE    │   │
│  │  ────────               ─────              ──────     ───    │   │
│  │  squishy-mapping-fog    Add user profile   main       2h    │   │
│  │  amber-crystal-wave     Fix auth bug       fix/auth   1d    │   │
│  │  quiet-river-stone      Explore metrics    feat/dash  3d    │   │
│  │  ...                                                         │   │
│  │                                                               │   │
│  │  Showing 20 most recent. Use --all for full list.            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Discovery: scans ~/.claude/projects/ for top-level .jsonl files.  │
│  Only top-level sessions — never surfaces subagents as entries.     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow: Inspect (Deep-Dive)

```
┌─────────────────────────────────────────────────────────────────────┐
│ $ howicc inspect squishy-mapping-fog                                │
│                                                                     │
│  Session: squishy-mapping-fog                                       │
│  Title:   Add user profile system with digest extraction            │
│  Branch:  chore/howicc-revamp-foundation                            │
│  Project: /Users/abdallah/Developer/personal/howicc                 │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ STATS                                                      │     │
│  │ Messages:  268    Tool Runs:  435    Subagents: 9          │     │
│  │ Duration:  7.6h   Turns:      38     Branches:  79         │     │
│  │ Artifacts: 432    Models:     claude-sonnet-4-20250514     │     │
│  │ Cost est:  ~$2.14 Cache hit:  96.7%                        │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ FILES IN BUNDLE                                            │     │
│  │ Transcript:         1 file    (2.4 MB)                     │     │
│  │ Tool results:       2 files   (42 KB)                      │     │
│  │ Subagent sessions:  9 files   (1.1 MB)                     │     │
│  │ Plans:              1 file    (7.6 KB)                      │     │
│  │ Total bundle size:  3.6 MB                                 │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ TOOL USAGE                                                 │     │
│  │ Bash       ████████████████████████████████████████  145   │     │
│  │ Edit       ████████████████████████████████████      129   │     │
│  │ Read       ██████████████████████                    84    │     │
│  │ Write      █████                                     20    │     │
│  │ Glob       ████                                      13    │     │
│  │ Grep       ███                                       10    │     │
│  │ Agent      ███                                       9     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ LANGUAGES                                                  │     │
│  │ TypeScript ████████████████████████████████████████  142   │     │
│  │ JSON       ██                                        4     │     │
│  │ SQL        █                                         2     │     │
│  │ Markdown   █                                         1     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ GIT ACTIVITY                                               │     │
│  │ Commits: 8    Pushes: 2    PRs linked: 0                  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ SUBAGENTS                                                  │     │
│  │ 1. [Explore] Explore provider-claude-code        106 evts  │     │
│  │ 2. [Explore] Read workbench snapshot data         83 evts  │     │
│  │ 3. [Plan]    Design profile architecture         188 evts  │     │
│  │ 4. [Explore] Explore digest extraction           121 evts  │     │
│  │ ...5 more                                                  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  Revision hash: a3f7c2e... (unchanged since last sync)             │
│  Use 'howicc sync squishy-mapping-fog' to upload.                  │
└─────────────────────────────────────────────────────────────────────┘
```

**JTBD addressed:** J3 (inspect before sharing), J4 (understand what's in the session)

---

## Scene 3: Upload & Sync

### Flow: First-Time Auth

```
┌─────────────────────────────────────────────────────────────────┐
│ $ howicc login                                                   │
│                                                                  │
│  Opening browser for GitHub authentication...                    │
│                                                                  │
│  ┌─────────────── Browser ──────────────────┐                   │
│  │                                           │                   │
│  │  ┌─────────────────────────────────────┐  │                   │
│  │  │         HowiCC                      │  │                   │
│  │  │                                     │  │                   │
│  │  │  Authorize CLI Access               │  │                   │
│  │  │                                     │  │                   │
│  │  │  The HowiCC CLI is requesting       │  │                   │
│  │  │  permission to sync sessions        │  │                   │
│  │  │  on your behalf.                    │  │                   │
│  │  │                                     │  │                   │
│  │  │  [  Authorize with GitHub  ]        │  │                   │
│  │  │                                     │  │                   │
│  │  │  Code: ABCD-1234                    │  │                   │
│  │  │  Verify this matches your           │  │                   │
│  │  │  terminal before authorizing.       │  │                   │
│  │  └─────────────────────────────────────┘  │                   │
│  └───────────────────────────────────────────┘                   │
│                                                                  │
│  Waiting for authorization... Code: ABCD-1234                    │
│                                                                  │
│  ✓ Authenticated as abdallah (abdallah@example.com)              │
│  Token stored in ~/.config/howicc/config.json                    │
└─────────────────────────────────────────────────────────────────┘
```

### Flow: Sync

```
┌─────────────────────────────────────────────────────────────────────┐
│ $ howicc sync                                                       │
│                                                                     │
│  Syncing as abdallah@example.com                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SESSION                     STATUS                          │   │
│  │  ────────                    ──────                          │   │
│  │  squishy-mapping-fog         Uploading...                    │   │
│  │    ├── source_bundle         ████████████████████ 3.6 MB ✓   │   │
│  │    ├── canonical_json        ████████████████████  842 KB ✓  │   │
│  │    └── render_json           ████████████████████  156 KB ✓  │   │
│  │    └── Finalized → conv_a3f7c2e (rev_8b2d1f4)               │   │
│  │                                                               │   │
│  │  amber-crystal-wave          Skipped (unchanged)             │   │
│  │  quiet-river-stone           Skipped (unchanged)             │   │
│  │  wild-cedar-bloom            Uploading...                    │   │
│  │    ├── source_bundle         ████████████████████ 1.2 MB ✓   │   │
│  │    ├── canonical_json        ████████████████████  340 KB ✓  │   │
│  │    └── render_json           ████████████████████   89 KB ✓  │   │
│  │    └── Finalized → conv_e91b4c7 (rev_3a7f2e1)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Finished: 2 synced, 2 skipped, 0 failed.                          │
│                                                                     │
│  View at: https://howi.cc/home                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sync Protocol (What Happens Under The Hood)

```
  CLI                              API                         R2         D1
   │                                │                          │          │
   │  POST /uploads/sessions        │                          │          │
   │  {revisionHash, assets[3]}     │                          │          │
   │──────────────────────────────> │                          │          │
   │                                │  INSERT upload_sessions  │          │
   │                                │─────────────────────────────────── >│
   │                                │  INSERT upload_session_assets      >│
   │  <── {uploadId, assetTargets}  │                          │          │
   │                                │                          │          │
   │  PUT /uploads/:id/assets/source_bundle                    │          │
   │  [3.6 MB gzipped bytes]        │                          │          │
   │──────────────────────────────> │  PUT draft key           │          │
   │                                │────────────────────────> │          │
   │  <── {sha256 verified}         │                          │          │
   │                                │                          │          │
   │  PUT /uploads/:id/assets/canonical_json                   │          │
   │  [842 KB gzipped bytes]        │                          │          │
   │──────────────────────────────> │  PUT draft key           │          │
   │                                │────────────────────────> │          │
   │  <── {sha256 verified}         │                          │          │
   │                                │                          │          │
   │  PUT /uploads/:id/assets/render_json                      │          │
   │  [156 KB gzipped bytes]        │                          │          │
   │──────────────────────────────> │  PUT draft key           │          │
   │                                │────────────────────────> │          │
   │  <── {sha256 verified}         │                          │          │
   │                                │                          │          │
   │  POST /uploads/finalize        │                          │          │
   │  {uploadId, hash, meta}        │                          │          │
   │──────────────────────────────> │                          │          │
   │                                │  Decompress canonical    │          │
   │                                │  Validate source match   │          │
   │                                │  Copy draft → final keys │          │
   │                                │────────────────────────> │          │
   │                                │  UPSERT conversation     │          │
   │                                │  INSERT revision         │          │
   │                                │  INSERT assets           │          │
   │                                │  SET status = ready      │          │
   │                                │─────────────────────────────────── >│
   │                                │  Delete draft keys       │          │
   │                                │────────────────────────> │          │
   │                                │  Extract digest          │          │
   │                                │  UPSERT session_digest   │          │
   │                                │─────────────────────────────────── >│
   │  <── {conversationId, revId}   │                          │          │
   │                                │                          │          │
   │  Store sync state locally      │                          │          │
   │  (hash, convId, revId, date)   │                          │          │
```

**Key invariants:**
- CLI never writes sync state until finalize succeeds
- Same revision hash → idempotent finalize (no duplicates)
- `--force` re-uploads even if hash matches locally
- Draft R2 objects only deleted after all DB writes succeed

---

## Scene 4: Browse & Explore (Web Dashboard)

### Page: Dashboard Home

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                              abdallah  [logout] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   119    │  │  96.2h   │  │    16    │  │  $47.80  │  │  2-day   │ │
│  │ sessions │  │ duration │  │  active  │  │ est cost │  │  streak  │ │
│  │          │  │          │  │   days   │  │          │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                                          │
│  RECENT SESSIONS                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  ● Add user profile system          howicc     7.6h   $2.14  2h  │  │
│  │    chore/howicc-revamp  ·  building  ·  268 msgs  ·  435 tools    │  │
│  │                                                                    │  │
│  │  ● Fix auth middleware               really-app  1.2h   $0.45  5h │  │
│  │    fix/auth-session  ·  debugging  ·  42 msgs  ·  67 tools        │  │
│  │                                                                    │  │
│  │  ● Explore caching strategy          really-app  0.4h   $0.12  1d │  │
│  │    feat/cache  ·  exploring  ·  18 msgs  ·  23 tools              │  │
│  │                                                                    │  │
│  │  ● Refactor data pipeline            really-data 3.1h   $1.20  2d │  │
│  │    main  ·  building  ·  156 msgs  ·  289 tools                   │  │
│  │                                                                    │  │
│  │  ● Debug deploy failure              really-app  0.8h   $0.30  3d │  │
│  │    main  ·  debugging  ·  31 msgs  ·  52 tools                    │  │
│  │                                                                    │  │
│  │                                              [Load more sessions]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── ACTIVITY ────────────────────────┐ ┌─── PROJECTS ──────────────┐  │
│  │                                      │ │                           │  │
│  │  M  T  W  T  F  S  S                │ │  really-app     47 sess   │  │
│  │  ░  ░  ░  ▓  ▓  ░  ░   ← last wk   │ │  ████████████████████     │  │
│  │  ░  ▓  ▓  █  ░  ░  ░   ← this wk   │ │                           │  │
│  │                                      │ │  howicc         34 sess   │  │
│  │  Peak hours: 23:00 - 02:00          │ │  ██████████████           │  │
│  │  Busiest day: Thursday (26 sess)    │ │                           │  │
│  │                                      │ │  really-data    18 sess   │  │
│  └──────────────────────────────────────┘ │  ████████                │  │
│                                           │                           │  │
│  ┌─── TOOLS ──────────────────────────┐  │  really-branding  8 sess  │  │
│  │                                     │  │  ████                     │  │
│  │  write   ████████████████████  149  │  │                           │  │
│  │  command  ████████████████████  145  │  │  +4 more projects        │  │
│  │  read    ████████████████      84   │  └───────────────────────────┘  │
│  │  agent   ██                    9    │                                  │
│  │  plan    █                     3    │                                  │
│  └─────────────────────────────────────┘                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Stats bar → `GET /profile/stats` (new endpoint, lightweight)
- Recent sessions → `GET /profile/activity` (new endpoint, paginated digests)
- Activity grid → `UserProfile.activity.weekdayDistribution` + `dailyActivity`
- Projects → `UserProfile.projects[]`
- Tools → `UserProfile.toolcraft.categoryBreakdown`

### Page: Conversation Detail (Owner View)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                              abdallah  [logout] │
├──────────────────────────────────────────────────────────────────────────┤
│  ← Back to dashboard                                                    │
│                                                                          │
│  Add user profile system with digest extraction                          │
│  chore/howicc-revamp-foundation  ·  howicc                              │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐│
│  │  268     │ │  435     │ │  7.6h    │ │  ~$2.14  │ │ Visibility:    ││
│  │ messages │ │ tools    │ │ duration │ │ est cost │ │ [private ▼]    ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ ○ private      ││
│                                                       │ ○ unlisted     ││
│  Session type: building                               │ ○ public       ││
│  9 subagents  ·  8 git commits  ·  2 pushes           └────────────────┘│
│  Languages: TypeScript (142), JSON (4), SQL (2)                          │
│                                                                          │
│  ┌─── PLAN CONTEXT ─────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  ## User Profile Aggregation System                               │   │
│  │                                                                   │   │
│  │  Build a profile aggregation pipeline that:                       │   │
│  │  1. Extracts session digests from canonical sessions              │   │
│  │  2. Stores digests in D1 during upload finalize                   │   │
│  │  3. Aggregates digests into materialized user profiles            │   │
│  │  4. Serves profiles via GET /profile with lazy recomputation      │   │
│  │                                                                   │   │
│  │  Key packages: @howicc/profile (digest + aggregate)              │   │
│  │  ...                                               [Show full ▼]  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─── CONVERSATION ─────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  ┌─ USER ───────────────────────────────────────────────────────┐ │   │
│  │  │ I've reviewed the revamp docs and the current code. The      │ │   │
│  │  │ next slice should be a focused "real ingestion backend"      │ │   │
│  │  │ milestone that turns the current stubbed upload/finalize     │ │   │
│  │  │ flow into a real D1 + R2 + viewer path.                     │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ ASSISTANT ──────────────────────────────────────────────────┐ │   │
│  │  │ Let me read the current state of the codebase and the       │ │   │
│  │  │ referenced docs to validate the plan against reality.       │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ ACTIVITY ─── Explored codebase (12 tool runs) ──── [+] ────┐ │   │
│  │  │  Read apps/api/src/routes/uploads.ts                         │ │   │
│  │  │  Read apps/api/src/routes/conversations.ts                   │ │   │
│  │  │  Read apps/jobs/src/index.ts                                 │ │   │
│  │  │  Glob packages/db/src/**/*.ts                                │ │   │
│  │  │  Read packages/db/src/schema/conversations.ts                │ │   │
│  │  │  ...7 more                                                   │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ ASSISTANT ──────────────────────────────────────────────────┐ │   │
│  │  │ The plan is approved. A few tactical observations before     │ │   │
│  │  │ you start...                                                 │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ QUESTION ───────────────────────────────────────────────────┐ │   │
│  │  │  Claude asked: "Should I start with Phase 1?"                │ │   │
│  │  │                                                               │ │   │
│  │  │  ○ Start Phase 1 (contracts + DB)                            │ │   │
│  │  │  ● Start Phase 1 and 2 together  ← selected                 │ │   │
│  │  │  ○ Show me the full plan first                               │ │   │
│  │  │                                                               │ │   │
│  │  │  Outcome: answered                                           │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ ACTIVITY ─── Built upload service (47 tool runs) ── [+] ───┐ │   │
│  │  │  Write apps/api/src/modules/uploads/service.ts               │ │   │
│  │  │  Edit packages/db/src/schema/conversations.ts                │ │   │
│  │  │  Edit packages/db/src/schema/assets.ts                       │ │   │
│  │  │  Bash: pnpm tsc --noEmit                                     │ │   │
│  │  │  Bash: pnpm vitest run                                       │ │   │
│  │  │  ...42 more                                                  │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ CALLOUT ── warning ─────────────────────────────────────────┐ │   │
│  │  │  Hook blocked: pre-commit lint failed (3 violations)         │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ SUBAGENT THREAD ─── Explore provider-claude-code ── [+] ───┐ │   │
│  │  │  106 events  ·  52 tool calls  ·  type: Explore              │ │   │
│  │  │  Explored package structure, read adapter, discovered...      │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │                                               [continued below]   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─── SIDEBAR ──────────────────┐                                       │
│  │                               │                                       │
│  │  FILES CHANGED (33)           │                                       │
│  │  ├── uploads/service.ts       │                                       │
│  │  ├── conversations/service.ts │                                       │
│  │  ├── schema/conversations.ts  │                                       │
│  │  ├── schema/assets.ts         │                                       │
│  │  └── ...29 more               │                                       │
│  │                               │                                       │
│  │  ARTIFACTS (432)              │                                       │
│  │  ├── 1 plan                   │                                       │
│  │  ├── 18 tool decisions        │                                       │
│  │  ├── 3 questions              │                                       │
│  │  ├── 5 todo snapshots         │                                       │
│  │  └── 405 tool outputs         │                                       │
│  │                               │                                       │
│  │  SUBAGENTS (9)                │                                       │
│  │  ├── 3 Explore agents         │                                       │
│  │  ├── 1 Plan agent             │                                       │
│  │  └── 5 general agents         │                                       │
│  └───────────────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Header stats → `GET /conversations/:id` (new) + `GET /conversations/:id/digest` (new)
- Visibility toggle → `PATCH /conversations/:id/visibility` (new)
- Plan context → `RenderDocument.context.currentPlan`
- Conversation blocks → `GET /conversations/:id/render` (existing)
- Sidebar → digest fields (`filesChanged`, artifacts from canonical)

### Page: Conversation Detail (Public View — Shared Link)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                                     [Sign in]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Add user profile system with digest extraction                          │
│  by abdallah  ·  chore/howicc-revamp-foundation  ·  howicc              │
│                                                                          │
│  268 messages  ·  435 tools  ·  7.6h  ·  building                       │
│                                                                          │
│  ┌─── PLAN CONTEXT ───────────────────────────────────────────────┐     │
│  │  (same as owner view but read-only, no visibility controls)    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌─── CONVERSATION ───────────────────────────────────────────────┐     │
│  │  (same block rendering as owner view)                          │     │
│  │  (no edit controls, no sidebar with files)                     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Shared via HowiCC · Import your own sessions: howi.cc/cli               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Data source:** `GET /shared/:slug` (new — unauthenticated, checks visibility)

### Page: Repository Analytics

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HowiCC                                                     [Sign in]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  axetay/really-app                                                       │
│  47 public sessions  ·  3 contributors                                   │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  136.2h  │  │  $38.40  │  │    47    │  │  12,847  │               │
│  │ duration │  │ est cost │  │ sessions │  │ tool runs│               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                          │
│  ┌─── SESSION TYPES ──────────┐  ┌─── CONTRIBUTORS ──────────────────┐ │
│  │                             │  │                                    │ │
│  │  building     ██████████ 24 │  │  abdallah      32 sessions        │ │
│  │  debugging    ██████     14 │  │  ████████████████████████████      │ │
│  │  exploring    ███         6 │  │                                    │ │
│  │  investigating █          3 │  │  teammate-a    10 sessions         │ │
│  │                             │  │  ████████████                      │ │
│  └─────────────────────────────┘  │                                    │ │
│                                   │  teammate-b     5 sessions         │ │
│  ┌─── LANGUAGES ──────────────┐  │  ██████                            │ │
│  │                             │  └────────────────────────────────────┘ │
│  │  TypeScript  █████████  78  │                                        │
│  │  Python      ████       32  │                                        │
│  │  SQL         ██         14  │                                        │
│  │  YAML        █           8  │                                        │
│  └─────────────────────────────┘                                        │
│                                                                          │
│  PUBLIC SESSIONS                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ● Fix auth middleware          abdallah    debugging  1.2h  $0.45│  │
│  │  ● Add caching layer            teammate-a  building   2.4h  $0.89│  │
│  │  ● Debug deploy failure          abdallah    debugging  0.8h  $0.30│  │
│  │  ...                                                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Data source:** `GET /repo/:owner/:name` (existing endpoint, no auth needed)

---

## Scene 5: Share

### Flow: Making a Session Public

```
  Owner on conversation detail page
       │
       ▼
  Clicks visibility dropdown → selects "unlisted"
       │
       ▼
  PATCH /conversations/:id/visibility {visibility: "unlisted"}
       │
       ▼
  URL appears: https://howi.cc/s/squishy-mapping-fog
       │
       ▼
  Owner copies link, sends to colleague / posts on social
       │
       ▼
  Viewer clicks link
       │
       ▼
  GET /shared/squishy-mapping-fog (no auth required)
       │
       ▼
  API checks: visibility === "unlisted" || "public"
       │
       ▼
  Returns render document → Astro renders full conversation page
```

### Visibility State Machine

```
                    ┌──────────┐
        upload      │          │
  CLI ────────────> │  private │ <── default on creation
                    │          │
                    └────┬─────┘
                         │
               owner sets│unlisted
                         │
                    ┌────▼─────┐
                    │          │
                    │ unlisted │ ── accessible via direct link
                    │          │    not listed on repo page
                    └────┬─────┘
                         │
               owner sets│public
                         │
                    ┌────▼─────┐
                    │          │
                    │  public  │ ── accessible via link
                    │          │    listed on repo page
                    └────┬─────┘    appears in search (future)
                         │
               owner sets│archived
                         │
                    ┌────▼─────┐
                    │          │
                    │ archived │ ── still accessible via link
                    │          │    hidden from lists
                    └──────────┘

  Transitions: any state → any state (owner only)
  Default: private (never public without explicit action)
```

---

## Complete User Journey: End to End

```
                         THE HOWICC JOURNEY
                         ──────────────────

  ┌─────────┐                                           ┌─────────────┐
  │ Claude   │                                           │ Viewer sees │
  │ Code     │                                           │ shared      │
  │ session  │                                           │ session     │
  └────┬─────┘                                           └──────▲──────┘
       │                                                        │
       │ session files on disk                                  │ shared link
       │                                                        │
  ┌────▼────────────────────┐                                   │
  │                          │                                   │
  │  $ howicc list           │                                   │
  │  $ howicc inspect <id>   │ ◄── "do I want to share this?"   │
  │  $ howicc preview <id>   │                                   │
  │                          │                                   │
  └────┬─────────────────────┘                                   │
       │                                                        │
       │ yes, sync it                                           │
       │                                                        │
  ┌────▼────────────────────┐     ┌──────────────────────┐     │
  │                          │     │                      │     │
  │  $ howicc login          │────>│  Browser: authorize  │     │
  │  (first time only)       │     │  GitHub OAuth        │     │
  │                          │     │  PKCE token exchange  │     │
  └────┬─────────────────────┘     └──────────────────────┘     │
       │                                                        │
       │ token stored locally                                   │
       │                                                        │
  ┌────▼────────────────────┐     ┌──────────────────────┐     │
  │                          │     │                      │     │
  │  $ howicc sync           │────>│  API: upload 3       │     │
  │  - parse canonical       │     │  assets, finalize    │     │
  │  - build render doc      │     │  revision, extract   │     │
  │  - upload bytes          │     │  digest              │     │
  │  - finalize              │     │                      │     │
  └────┬─────────────────────┘     └──────────────────────┘     │
       │                                                        │
       │ synced                                                 │
       │                                                        │
  ┌────▼──────────────────────────────────────────────────┐     │
  │                                                        │     │
  │  Web Dashboard                                         │     │
  │                                                        │     │
  │  ┌─────────────────────┐   ┌────────────────────────┐ │     │
  │  │                     │   │                        │ │     │
  │  │  Profile Overview   │   │  Conversation List     │ │     │
  │  │  - stats, streaks   │   │  - all synced sessions │ │     │
  │  │  - tool breakdown   │   │  - filter & search     │ │     │
  │  │  - project list     │   │  - click to detail     │ │     │
  │  │  - activity grid    │   │                        │ │     │
  │  │                     │   │                        │ │     │
  │  └─────────────────────┘   └──────────┬─────────────┘ │     │
  │                                       │               │     │
  │                            click a    │               │     │
  │                            session    │               │     │
  │                                       │               │     │
  │  ┌────────────────────────────────────▼─────────────┐ │     │
  │  │                                                  │ │     │
  │  │  Conversation Detail                             │ │     │
  │  │  - plan context panel                            │ │     │
  │  │  - message/tool/activity blocks                  │ │     │
  │  │  - question interaction cards                    │ │     │
  │  │  - subagent threads (expandable)                 │ │     │
  │  │  - sidebar: files, artifacts, agents             │ │     │
  │  │                                                  │ │     │
  │  │  [Visibility: private ▼]  →  set to "unlisted"  │ │     │
  │  │                                                  │ │     │
  │  └────────────────────────────┬─────────────────────┘ │     │
  │                               │                       │     │
  └───────────────────────────────┼───────────────────────┘     │
                                  │                             │
                       copy link  │                             │
                                  │                             │
                                  └─────────────────────────────┘
                                      howi.cc/s/<slug>
```

---

## API Endpoints Required (Audit)

### Already implemented
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /uploads/sessions` | Create draft upload | Done |
| `PUT /uploads/:id/assets/:kind` | Upload bytes | Done |
| `POST /uploads/finalize` | Finalize revision | Done |
| `GET /conversations` | List user conversations | Done |
| `GET /conversations/:id/render` | Render document | Done |
| `GET /conversations/:id/artifacts/:id` | Artifact content | Done |
| `GET /pricing/models` | OpenRouter proxy | Done |
| `GET /profile` | User profile | Done |
| `POST /profile/recompute` | Force recompute | Done |
| `GET /repo/:owner/:name` | Repo analytics | Done |
| `POST /cli-auth/authorize` | PKCE start | Done |
| `POST /cli-auth/exchange` | PKCE exchange | Done |
| `GET /cli-auth/whoami` | Token verify | Done |

### Must add for the web experience
| Endpoint | Purpose | Unlocks |
|----------|---------|---------|
| `GET /conversations/:id` | Full conversation metadata + revision info + digest | Detail page header |
| `PATCH /conversations/:id/visibility` | Set private/unlisted/public | Sharing flow |
| `GET /shared/:slug` | Public render doc (no auth) | Shared links |
| `GET /profile/activity` | Paginated recent digests | Dashboard feed |

### Nice to have
| Endpoint | Purpose | Unlocks |
|----------|---------|---------|
| `GET /profile/stats` | Lightweight stats summary | Fast dashboard header |
| `GET /profile/projects` | Project list with stats | Project navigation |
| `GET /conversations/:id/digest` | Per-session digest | Detail page sidebar |

---

## What The Data Tells Us (From Workbench v6)

Real numbers from a single session show what's worth displaying:

| Metric | Value | Display as |
|--------|-------|-----------|
| Messages | 268 | Big stat number |
| Tool runs | 435 | Big stat number |
| Duration | 7.6 hours | Duration badge |
| Estimated cost | ~$2.14 | Cost badge |
| Cache hit rate | 96.7% | Efficiency metric |
| Branches | 79 | Complexity indicator |
| Subagents | 9 | Team breakdown |
| Git commits | 8 | Productivity signal |
| Files changed | 33 | Scope indicator |
| Files read | 66 | Research breadth |
| Languages | TS (142), JSON (4), SQL (2) | Language bar |
| Session type | building | Classification badge |
| Top tools | Bash (145), Edit (129), Read (84) | Tool usage chart |
| Artifacts | 432 (405 tool outputs, 18 decisions, 1 plan) | Sidebar counts |

And from the user profile (119 sessions aggregated):

| Metric | Value | Display as |
|--------|-------|-----------|
| Total sessions | 119 | Profile stat |
| Total duration | 96.2 hours | Profile stat |
| Active days | 16 | Profile stat |
| Current streak | 2 days | Streak badge |
| Longest streak | 4 days | Streak badge |
| Peak hour | 23:00 | Activity insight |
| Busiest day | Thursday (26 sessions) | Activity insight |
| Top project | really-app (47 sessions) | Project bar |
| Top language | TypeScript | Language stat |
