# Data and API Reference Per Page

A companion reference to [17-web-app-pages-and-screens.md](17-web-app-pages-and-screens.md).

For each page we plan to build, this document shows:
- Which API endpoints the page calls
- The shape of each response
- How each field maps to a UI element
- The nature of the data (live vs cached, aggregate vs single, auth-gated vs public)

> **Design direction:** The canonical visual system for the web app is
> **[The Archive](20-design-md-the-archive.md)** — warm cream, serif titles,
> Inter for UI, JetBrains Mono only for code/commands, timeline as the
> signature component. Response field names in this doc are logical
> contracts; how they render visually (card, pill, timeline node, text)
> is specified in doc 20.

Written in the spirit of Claude Code's own web documentation style — clean tables,
structured type blocks, workflow arrows, and a clear hierarchy from overview down
to specifics.

---

## How To Read This Document

```
Each page section follows this format:

  PAGE                 Short description and JTBD
  ────                 ───────────────────────────
  Route                /path/to/page
  Auth                 None | Required | GitHub-gated
  Primary goal         What the user is trying to do here

  API CALLS            Ordered list of endpoints this page hits
  ─────────            ────────────────────────────────────────

    GET /endpoint      Nature of the response
    Used for           Which UI elements consume this
    Response shape     JSON type block
    Notes              Caching, freshness, edge cases
```

Each response type has a **nature**:

| Nature | Meaning |
|--------|---------|
| **live** | Must be fresh on each view (permissions, real-time) |
| **cached** | Short TTL (30s-5min), stale-while-revalidate |
| **aggregate** | Computed from many source rows, can be eventually consistent |
| **static** | Derived once from source data (render document from canonical) |
| **single** | One row lookup, cheap |
| **paged** | Paginated list with cursor or offset |

---

## The Four Core Shapes

These are the backbone types the entire system is built on. Every page either
shows one of these, a subset of one, or an aggregation of them.

### 1. CanonicalSession

The provider-neutral, structured truth of a session. Stored in R2 as gzipped
JSON, never sent directly to the web app.

```
CanonicalSession {
  kind:             "canonical_session"
  schemaVersion:    number
  parserVersion:    string
  provider:         "claude_code" | ...

  source: {
    sessionId:          string
    projectKey:         string
    sourceRevisionHash: string
    transcriptSha256:   string
    importedAt:         ISO 8601
  }

  metadata: {
    title:         string
    customTitle?:  string
    summary?:      string
    tag?:          string
    cwd:           string
    gitBranch?:    string
    createdAt:     ISO 8601
    updatedAt:     ISO 8601
  }

  selection: {
    strategy:          "leaf" | "explicit"
    selectedLeafUuid?: string
    branchCount:       number
  }

  stats: {
    visibleMessageCount: number
    toolRunCount:        number
    artifactCount:       number
    subagentCount:       number
  }

  events:     CanonicalEvent[]   // raw timeline
  agents:     AgentThread[]      // subagent threads
  assets:     AssetRef[]         // file/blob references
  artifacts:  SessionArtifact[]  // plans, questions, decisions, etc.
  searchText: string

  providerData: {
    claudeCode?: { metrics, cache hit rate, model timeline, ... }
  }
}
```

**Never fetched directly by the web.** The web only gets derivations
(RenderDocument for display, SessionDigest for metrics).

---

### 2. RenderDocument

UI-ready blocks. Derived from CanonicalSession during CLI parse, stored in R2,
served to the web app on demand.

```
RenderDocument {
  kind:          "render_document"
  schemaVersion: 1

  session: {
    sessionId:  string
    title:      string
    provider:   string
    createdAt:  ISO 8601
    updatedAt:  ISO 8601
    gitBranch?: string
    tag?:       string
    stats: {
      messageCount:       number
      toolRunCount:       number
      activityGroupCount: number
    }
  }

  context?: {
    currentPlan?: {
      title:       string
      body:        string
      source:      "file" | "transcript_recovered"
      filePath?:   string
      artifactId?: string
    }
  }

  blocks: RenderBlock[]
}
```

**Block types (11 variants):**

```
RenderBlock =
  | MessageBlock          role: user | assistant, text
  | QuestionBlock         structured Q&A with outcome
  | ActivityGroupBlock    "Ran 4 commands" with collapsible items
  | CalloutBlock          info/warning/error notice
  | TodoBlock             todo snapshot
  | TaskTimelineBlock     task status changes
  | ResourceBlock         MCP resource
  | StructuredDataBlock   arbitrary JSON viewer
  | BriefDeliveryBlock    user-facing message with attachments
  | SubagentThreadBlock   nested subagent with its own blocks[]
  | CompactBoundaryBlock  transcript compaction marker
```

**Nature: static.** Once computed, never changes for a given revision.
Cacheable forever with revision hash in the URL.

---

### 3. SessionDigest

Per-session aggregate metrics. Extracted from CanonicalSession during upload
finalize. Stored in D1 as a row with `digest_json` column.

```
SessionDigest {
  sessionId:     string
  provider:      "claude_code" | ...
  agentVersion?: string
  projectKey:    string
  projectPath?:  string
  gitBranch?:    string
  title?:        string
  createdAt:     ISO 8601
  updatedAt:     ISO 8601
  durationMs?:   number
  dayOfWeek:     0-6
  hourOfDay:     0-23

  turnCount:       number
  messageCount:    number
  toolRunCount:    number
  toolCategories:  Record<ToolCategory, number>
                   // read | write | command | search | agent | plan | web | mcp

  errorCount:        number
  apiErrorCount:     number
  apiErrorTypes:     Record<string, number>
  rejectionCount:    number
  interruptionCount: number
  compactionCount:   number
  subagentCount:     number
  hasPlan:           boolean
  hasThinking:       boolean

  models: Array<{
    model:        string
    inputTokens:  number
    outputTokens: number
  }>
  estimatedCostUsd?: number

  sessionType:        "building" | "debugging" | "exploring"
                      | "investigating" | "mixed"

  filesChanged:        string[]
  filesRead:           string[]
  languages:           Record<string, number>
  fileIterationDepth:  number
  timeToFirstEditMs?:  number
  gitCommits:          number
  gitPushes:           number

  repository?: {
    owner:    string
    name:     string
    fullName: string
    source:   "git_remote" | "pr_link" | "cwd_derived"
  }
  prLinks: Array<{ url, number, repository }>

  mcpServersConfigured: string[]
  mcpServersUsed:       Array<{ server, toolCallCount }>
  skillsTriggered:      Array<{ name, invocationCount }>

  providerDigest?: Record<string, unknown>
}
```

**Nature: single.** One row per revision. Cheap to query by conversation_id.

---

### 4. UserProfile

Aggregated across all digests for a user. Materialized in D1, lazily recomputed
when digest count changes.

```
UserProfile {
  userId:      string
  generatedAt: ISO 8601
  digestCount: number

  activity: {
    totalSessions:             number
    totalDurationMs:           number
    activeDays:                number
    currentStreak:             number
    longestStreak:             number
    averageSessionDurationMs:  number
    averageTurnsPerSession:    number
    hourlyDistribution:        number[]  // 24 entries
    weekdayDistribution:       number[]  // 7 entries
    dailyActivity:             Array<{ date, sessionCount, totalDurationMs }>
    firstSessionAt?:           ISO 8601
    lastSessionAt?:            ISO 8601
  }

  projects: Array<{
    projectKey:       string
    projectPath?:     string
    displayName:      string
    repository?:      { fullName, source }
    sessionCount:     number
    totalDurationMs:  number
    estimatedCostUsd: number
    lastActiveAt:     ISO 8601
    languages:        Record<string, number>
    branches:         string[]
  }>

  productivity: {
    totalFilesChanged:            number
    totalFilesRead:               number
    uniqueFilesChanged:           number
    uniqueFilesRead:              number
    totalGitCommits:              number
    totalGitPushes:               number
    totalPrLinks:                 number
    prRepositories:               Array<{ repository, prCount }>
    languages:                    Record<string, number>
    topLanguages:                 Array<{ language, fileCount }>
    topEditedFiles:               Array<{ file, sessionCount }>
    averageFilesChangedPerSession:     number
    averageFileIterationDepth:         number
    averageTimeToFirstEditMs?:         number
    sessionTypeDistribution:      Record<SessionType, number>
  }

  toolcraft: {
    totalToolRuns:       number
    categoryBreakdown:   Record<ToolCategory, number>
    errorRate:           number
    apiErrorCount:       number
    apiErrorTypes:       Record<string, number>
    rejectionRate:       number
    interruptionRate:    number
    compactionRate:      number
    planUsageRate:       number
    agentUsageRate:      number
    thinkingVisibleRate: number
  }

  models: Array<{
    model:            string
    sessionCount:     number
    inputTokens:      number
    outputTokens:     number
    estimatedCostUsd: number
  }>

  cost: {
    totalUsd:             number
    averagePerSessionUsd: number
    byMonth:              Array<{ month, totalUsd, sessionCount }>
  }

  integrations: {
    mcpServers: Array<{ server, configuredCount, usedCount, totalToolCalls }>
    skills:     Array<{ name, sessionCount, totalInvocations }>
  }

  providers: Array<{
    provider:         "claude_code" | ...
    sessionCount:     number
    totalDurationMs:  number
    estimatedCostUsd: number
    versions:         Array<{ version, sessionCount }>
  }>

  providerProfiles?: {
    claudeCode?: {
      cacheHitRate?:       number
      thinkingVisibleRate: number
      avgTurnsPerSession:  number
    }
  }
}
```

**Nature: aggregate.** Materialized in `user_profiles` table. Staleness is bounded
by digest count — if count matches, return cached; if not, recompute.

---

## Per-Page API Reference

### Page 1 — Landing (`/`)

| | |
|---|---|
| **Route** | `/` |
| **Auth** | None |
| **Primary goal** | Explain the product and drive sign-up |
| **Rendering** | SSR (for OG tags and SEO) |

**API calls**

```
GET /shared/:showcase-slug                             nature: static, cached
────────────────────────────────────────────           ───────────────────────
Used for:      The embedded "example session" in the hero.
               Shows a real public conversation, not a mockup.

Response:      RenderDocument (same shape as /s/:slug public)

Notes:         The showcase slug is configured server-side (env var or DB).
               Cache aggressively — this content rarely changes.
               Falls back to a static snapshot if fetch fails.
```

---

### Page 2 — Login (`/login`)

| | |
|---|---|
| **Route** | `/login` |
| **Auth** | None (initiates OAuth) |
| **Primary goal** | GitHub OAuth entry |
| **Rendering** | Client-side button, redirects to OAuth |

**API calls**

```
(none — redirects to Better Auth OAuth flow directly)

On successful OAuth callback:
  Better Auth sets session cookie
  Redirects to /home
```

---

### Page 3 — CLI Auth Bridge (`/cli/login`)

| | |
|---|---|
| **Route** | `/cli/login?code_challenge=...&state=...` |
| **Auth** | Active web session required |
| **Primary goal** | Authorize CLI via PKCE |
| **Rendering** | SSR with verification code |

**API calls**

```
POST /cli-auth/authorize                               nature: single, live
────────────────────────                               ─────────────────────
Request:       { callbackUrl, codeChallenge, state }
Response:      { success: true, redirectUrl, expiresAt }
Used for:      Displays the verification code on the page.

POST /cli-auth/exchange                                nature: single, live
───────────────────────                                ─────────────────────
Called by:     The CLI itself, not the web page.
Request:       { code, codeVerifier }
Response:      { success: true, token, user }
Used for:      CLI stores returned token locally.
```

---

### Page 4 — Home (`/home`)

| | |
|---|---|
| **Route** | `/home` |
| **Auth** | Required |
| **Primary goal** | Show recent sessions + key stats |
| **Rendering** | SSR with React islands for interactivity |

**API calls**

```
GET /profile/stats                                     nature: aggregate, cached
──────────────────                                     ────────────────────────
Used for:      Sidebar snapshot card (total sessions, hours, cost, streak)

Response:      {
                 sessionCount:  number
                 totalHours:    number
                 totalCostUsd:  number
                 currentStreak: number
                 longestStreak: number
                 topRepos: Array<{
                   fullName:     string
                   sessionCount: number
                 }>    // top 3
               }

Notes:         Lightweight subset of UserProfile. Avoids sending entire
               profile JSON (which can be hundreds of KB) when only the
               header numbers are needed.
               TTL: 30 seconds.


GET /profile/activity?limit=20                         nature: paged, cached
───────────────────────────────                        ──────────────────────
Used for:      The recent sessions feed (main content)

Response:      {
                 sessions: Array<{
                   conversationId:  string
                   slug:            string
                   title:           string
                   repository?:     { fullName, source }
                   gitBranch?:      string
                   sessionType:     "building" | ...
                   visibility:      "private" | "unlisted" | "public"
                   durationMs:      number
                   messageCount:    number
                   toolRunCount:    number
                   estimatedCostUsd: number
                   updatedAt:       ISO 8601
                 }>
                 nextCursor?:  string
               }

Notes:         Each entry is a slim projection of SessionDigest + conversation
               metadata. Enough to render a card, not enough to show the session.
               Sorted by updated_at DESC.
               TTL: 60 seconds.
```

**Empty state** (`digestCount === 0`): show CLI install instructions instead of calling `/profile/activity`.

---

### Page 5 — Insights (`/insights`)

| | |
|---|---|
| **Route** | `/insights` |
| **Auth** | Required |
| **Primary goal** | Analytics deep-dive (heatmap, tools, languages, models) |
| **Rendering** | SSR + client charts |

**API calls**

```
GET /profile                                           nature: aggregate, cached
────────────                                           ────────────────────────
Used for:      Every panel on this page (heatmap, session types, tools,
               languages, models).

Response:      UserProfile (the full shape defined above)

Notes:         This is the heavy fetch. Full profile can be 100-500 KB
               depending on digest count.
               Recomputed lazily on the server when digest count changes.
               TTL: 5 minutes at the edge, revalidated on recompute.


POST /profile/recompute                                nature: live
───────────────────────                                ─────────────
Used for:      "Recompute" button for users who just synced and want
               fresh numbers immediately.

Request:       (empty body)
Response:      { profile: UserProfile, recomputed: true }

Notes:         Manual trigger. Normal recomputation happens automatically
               on next /profile fetch after new digest.
```

---

### Page 6 — Sessions (`/sessions`)

| | |
|---|---|
| **Route** | `/sessions?repo=&type=&visibility=&from=&to=&sort=&page=` |
| **Auth** | Required |
| **Primary goal** | Find a specific session with filters |
| **Rendering** | SSR for first page, client-side for pagination |

**API calls**

```
GET /profile/activity?filters...                       nature: paged, cached
────────────────────────────────                       ──────────────────────
Query params:  repo, type, visibility, from, to, sort, page, q

Used for:      The filterable session table/cards.

Response:      {
                 sessions: Array<SessionActivityEntry>  // same as /home feed
                 total:       number        // total matching count
                 totalDuration: number      // for the filter summary bar
                 totalCost:   number
                 page:        number
                 pageSize:    number
                 hasMore:     boolean
               }

Notes:         Same endpoint as /home but with filter support.
               Full-text search (q) hits the `searchText` field stored
               on each revision row.
               TTL: 30 seconds per filter combination.
```

---

### Page 7 — Conversation Detail (`/s/:slug`)

**The most complex page. Two modes: owner and public.**

| | |
|---|---|
| **Route** | `/s/:slug` |
| **Auth** | Conditional (owner view if authenticated + owner, public view otherwise) |
| **Primary goal** | Read the full conversation |
| **Rendering** | SSR for initial block list, client-side for expansions |

**Owner View — API calls**

```
GET /conversations/:id                                 nature: single, live
──────────────────────                                 ─────────────────────
Used for:      Page header (title, branch, visibility, slug, timestamps)

Response:      {
                 id:                 string
                 slug:                string
                 title:               string
                 visibility:          "private" | "unlisted" | "public"
                 status:              "ready" | "draft" | "archived"
                 sourceApp:           string
                 sourceSessionId:     string
                 sourceProjectKey:    string
                 currentRevisionId:   string
                 createdAt:           ISO 8601
                 updatedAt:           ISO 8601
                 repository?:         {
                   fullName, owner, name, provider, providerUrl
                 }
                 currentRevision: {
                   id, sourceRevisionHash, parserVersion,
                   canonicalSchemaVersion, renderSchemaVersion,
                   createdAt
                 }
               }

Notes:         Cheap single-row lookup. Verifies ownership for the
               visibility toggle.


GET /conversations/:id/render                          nature: static, cached
─────────────────────────────                          ──────────────────────
Used for:      The entire block list (the conversation body)

Response:      RenderDocument

Notes:         Fetched from R2, gzipped. Typically 50-500 KB.
               Cacheable indefinitely with revisionId in the key —
               same revision always produces the same render doc.


GET /conversations/:id/digest                          nature: single, cached
─────────────────────────────                          ──────────────────────
Used for:      Header stats (msgs, tools, duration, cost),
               sidebar panels (files, artifacts, subagents, tools).

Response:      SessionDigest

Notes:         One row lookup. Populates everything in the right sidebar.
               TTL: indefinite (same revision, same digest).


PATCH /conversations/:id/visibility                    nature: live
───────────────────────────────────                    ─────────────
Request:       { visibility: "private" | "unlisted" | "public" }
Response:      { success: true, visibility }
Used for:      Visibility dropdown interaction.
```

**Public View — API calls**

```
GET /shared/:slug                                      nature: static, cached
─────────────────                                      ──────────────────────
Used for:      Everything on the public conversation page.

Response:      {
                 conversation: {
                   id, slug, title,
                   visibility,           // must be "unlisted" or "public"
                   ownerDisplayName,     // author byline
                   repository?:          { fullName }
                   gitBranch?:           string
                   createdAt, updatedAt
                 }
                 render:  RenderDocument
                 digest?: {            // minimal subset, not full digest
                   sessionType:    string
                   durationMs:     number
                   messageCount:   number
                   toolRunCount:   number
                   languages:      Record<string, number>
                 }
               }

Notes:         No auth header required.
               API returns 404 if visibility === "private".
               Returns 404 (not 403) to avoid confirming the conversation
               exists to unauthorized viewers.
               Edge-cached with 5 min TTL, revalidated on visibility change.
```

**Block types consumed from RenderDocument:**

| Block | Rendered as |
|-------|-------------|
| `MessageBlock` | User or assistant bubble, markdown-rendered text |
| `ActivityGroupBlock` | Collapsible card: "Ran X commands" → list on expand |
| `QuestionBlock` | Question card with options highlighted, selected answer shown |
| `CalloutBlock` | Colored banner (info/warning/error) |
| `TodoBlock` | Checklist with status icons |
| `TaskTimelineBlock` | Vertical timeline of task status changes |
| `ResourceBlock` | MCP resource card with expand link |
| `StructuredDataBlock` | Collapsible JSON viewer |
| `BriefDeliveryBlock` | User-facing message card with file attachments |
| `SubagentThreadBlock` | Nested conversation with its own blocks[] (recursive) |
| `CompactBoundaryBlock` | Horizontal divider marking transcript compaction |

---

### Page 8 — Repository Page (`/r/:owner/:name`)

| | |
|---|---|
| **Route** | `/r/:owner/:name` |
| **Auth** | Required + GitHub permission check |
| **Primary goal** | Team AI usage view for a specific repo |
| **Rendering** | SSR with live GitHub permission check |

**API calls**

```
GET /repos/:owner/:name                                nature: live (GitHub API)
────────────────────────                               ─────────────────────────
Used for:      All repo page content.
               Triggers live GitHub permission check.

Server-side flow:
  1. Resolve user from HowiCC session cookie or Bearer token
  2. Look up user's GitHub OAuth token (accounts table)
  3. Call GitHub API: GET https://api.github.com/repos/:owner/:name
     using the user's GitHub token
  4. If 404 or 403 → return 403 "No access"
  5. Extract permissions.admin, .maintain, .push
  6. Map to HowiCC role (admin | contributor | reader)
  7. Query D1 for aggregate stats, filtered by visibility rules
  8. Apply admin override (hidden conversations)
  9. Return combined response

Response:      {
                 repository: {
                   id:           string
                   fullName:     string
                   owner:        string
                   name:         string
                   provider:     "github"
                   providerUrl:  string
                   visibility:   "private" | "members" | "public"
                 }
                 viewerRole:  "admin" | "contributor" | "reader"
                 stats: {
                   sessionCount:     number
                   contributorCount: number
                   totalDurationMs:  number
                   totalCostUsd:     number
                   totalToolRuns:    number
                   sessionTypes:     Record<SessionType, number>
                   languages:        Record<string, number>
                   topTools:         Array<{ name, count }>
                 }
                 contributors: Array<{
                   userId:           string
                   username:         string
                   displayName:      string
                   avatarUrl?:       string
                   sessionCount:     number
                   totalDurationMs:  number
                   sessionTypes:     Record<SessionType, number>
                   topLanguage:      string
                   lastActiveAt:     ISO 8601
                 }>
                 conversations: Array<SessionActivityEntry>
                                // same shape as /profile/activity entries
                                // but filtered by visibility rules
                 hiddenConversations?: Array<SessionActivityEntry>
                                // only present for admins
               }

Notes:         The GitHub API call is the expensive part.
               Short TTL cache (5 min) per user+repo pair to avoid
               hammering GitHub. Still "fresh enough" from UX perspective.
               GitHub rate limit: 5000 req/hour per OAuth token.


PATCH /repos/:owner/:name/conversations/:id/repo-visibility
Request:       { hidden: boolean }
Response:      { success: true, hidden }
Used for:      Admin [⋯] menu → "Hide from repo page"

Server-side:   Re-verifies admin/maintain via GitHub API.
```

---

### Page 9 — Repository Settings (`/r/:owner/:name/settings`)

| | |
|---|---|
| **Route** | `/r/:owner/:name/settings` |
| **Auth** | Required + GitHub admin/maintain |
| **Primary goal** | Repo visibility and moderation |
| **Rendering** | SSR with admin verification |

**API calls**

```
GET /repos/:owner/:name                                nature: live (GitHub API)
────────────────────────                               ─────────────────────────
Same endpoint as page 8. Returns 403 if viewerRole !== "admin".
Used for:      Current visibility setting + list of hidden conversations.


PATCH /repos/:owner/:name/visibility                   nature: live
────────────────────────────────────                   ─────────────
Request:       { visibility: "private" | "members" | "public" }
Response:      { success: true, visibility }
Used for:      Visibility radio button save.

Server-side:   Re-verifies admin/maintain via GitHub API.


PATCH /repos/:owner/:name/conversations/:id/repo-visibility
Request:       { hidden: false }    // unhide
Used for:      "Unhide" button in the hidden conversations table.
```

---

### Page 10 — Settings (`/settings`)

| | |
|---|---|
| **Route** | `/settings` |
| **Auth** | Required |
| **Primary goal** | Account info + CLI tokens + profile visibility |
| **Rendering** | SSR |

**API calls**

```
GET /auth/session                                      nature: single, live
─────────────────                                      ─────────────────────
Better Auth session endpoint. Returns user info + connected accounts.


GET /profile                                           nature: aggregate, cached
────────────                                           ────────────────────────
Used for:      Showing total sessions / digest count
               ("Profile will show X sessions when public")


GET /api-tokens                                        nature: single, live
────────────────                                       ─────────────────────
Used for:      CLI token list.

Response:      {
                 tokens: Array<{
                   id:          string
                   tokenPrefix: string     // "hwi_a3f7..."
                   createdAt:   ISO 8601
                   lastUsedAt?: ISO 8601
                   revokedAt?:  ISO 8601
                 }>
               }

Notes:         Token hashes are never returned. Only prefix for display.


POST /api-tokens                                       nature: live
─────────────────                                      ─────────────
Request:       { name?: string }
Response:      { token: string, id, tokenPrefix }
Used for:      "Create new token" button.

Notes:         Raw token returned ONCE. Stored as hash in DB.
               UI must warn user to copy it immediately.


DELETE /api-tokens/:id                                 nature: live
──────────────────────                                 ─────────────
Used for:      "Revoke" button.


PATCH /profile/settings                                nature: live
───────────────────────                                ─────────────
Request:       {
                 publicProfile?:        boolean
                 showActivityHeatmap?:  boolean
                 showCost?:             boolean
                 showRepositories?:     boolean
                 showSessionTypes?:     boolean
                 showToolsLanguages?:   boolean
                 showBadges?:           boolean
               }
Response:      { success: true, settings }
Used for:      Public profile opt-in toggles.
```

---

### Page 11 — Public Profile (`/@:username`)

**The viral page. Must be SSR for social card crawlers.**

| | |
|---|---|
| **Route** | `/@:username` |
| **Auth** | None (opt-in by owner) |
| **Primary goal** | Viral shareable profile page |
| **Rendering** | SSR (mandatory for OG tags) |

**API calls**

```
GET /profile/public/:username                          nature: aggregate, cached
─────────────────────────────                          ────────────────────────
Used for:      Entire page.
               Filtered aggregate of UserProfile + visible sessions.

Response:      {
                 user: {
                   username:    string
                   displayName: string
                   avatarUrl?:  string
                   githubUrl:   string
                   websiteUrl?: string
                 }
                 publicSettings: {
                   showActivityHeatmap:  boolean
                   showCost:             boolean
                   showRepositories:     boolean
                   showSessionTypes:     boolean
                   showToolsLanguages:   boolean
                   showBadges:           boolean
                 }
                 stats: {
                   sessionCount:    number
                   totalHours:      number
                   currentStreak:   number
                   longestStreak:   number
                   firstSessionAt?: ISO 8601
                   lastSessionAt?:  ISO 8601
                 }
                 badges: Array<{
                   id:           string    // "builder" | "night_owl" | ...
                   label:        string
                   description:  string
                   earnedAt?:    ISO 8601
                 }>
                 activity?: {       // only if showActivityHeatmap === true
                   dailyActivity: Array<{
                     date:          string    // YYYY-MM-DD
                     sessionCount:  number
                   }>
                   hourlyDistribution: number[]    // 24 entries
                   weekdayDistribution: number[]   // 7 entries
                 }
                 sessionTypes?: Record<SessionType, number>
                                // only if showSessionTypes === true
                 languages?: Record<string, number>
                                // only if showToolsLanguages === true
                 topTools?: Array<{ name: string, count: number }>
                                // only if showToolsLanguages === true
                 publicSessions: Array<{
                   conversationId:    string
                   slug:              string
                   title:             string
                   repository?:       { fullName }
                   sessionType:       string
                   messageCount:      number
                   durationMs:        number
                   firstMessageExcerpt?: string   // first 120 chars of user msg
                   viewCount:         number
                   createdAt:         ISO 8601
                 }>
                 publicRepos?: Array<{
                   fullName:     string
                   sessionCount: number
                 }>              // only if showRepositories === true
                 cost?: {
                   totalUsd: number     // only if showCost === true
                 }
               }

Notes:         Every field respects the opt-in flags.
               Fields for disabled sections are omitted entirely
               (not just empty) to keep the payload small.
               Edge-cached with 5 min TTL.
               Returns 404 if publicProfile === false or user doesn't exist.


GET /og/profile/:username.png                          nature: cached image
─────────────────────────────                          ─────────────────────
Used for:      Social card meta tags.
               <meta property="og:image" content="...">

Response:      1200x630 PNG

Notes:         Generated at the edge (Cloudflare Workers image generation
               or Vercel OG Image). Reads the same data as /profile/public
               but renders a static PNG.
               Cached with 1 hour TTL.
               Renders on-demand; first call generates and caches.


POST /sessions/:id/view                                nature: fire-and-forget
─────────────────────────                              ────────────────────────
Called by:     The public conversation page when a non-owner views it.
Used for:      Incrementing the viewCount shown on the profile card.

Notes:         Debounced per session+IP to prevent inflation.
```

---

## Summary Table: Endpoints By Page

| Page | Endpoints |
|------|-----------|
| `/` | `GET /shared/:showcase-slug` |
| `/login` | Better Auth OAuth redirect |
| `/cli/login` | `POST /cli-auth/authorize`, `POST /cli-auth/exchange` (CLI side) |
| `/home` | `GET /profile/stats`, `GET /profile/activity?limit=20` |
| `/insights` | `GET /profile`, `POST /profile/recompute` |
| `/sessions` | `GET /profile/activity?filters...` |
| `/s/:slug` (owner) | `GET /conversations/:id`, `GET /conversations/:id/render`, `GET /conversations/:id/digest`, `PATCH /conversations/:id/visibility` |
| `/s/:slug` (public) | `GET /shared/:slug`, `POST /sessions/:id/view` |
| `/r/:owner/:name` | `GET /repos/:owner/:name`, `PATCH /repos/:owner/:name/conversations/:id/repo-visibility` |
| `/r/.../settings` | `GET /repos/:owner/:name`, `PATCH /repos/:owner/:name/visibility`, `PATCH .../repo-visibility` |
| `/settings` | `GET /auth/session`, `GET /profile`, `GET /api-tokens`, `POST /api-tokens`, `DELETE /api-tokens/:id`, `PATCH /profile/settings` |
| `/@:username` | `GET /profile/public/:username`, `GET /og/profile/:username.png`, `POST /sessions/:id/view` |

---

## Endpoint Status (Existing vs New)

```
LEGEND
──────
  ✓  exists today
  ◐  exists but needs changes
  +  new endpoint
```

### Conversation endpoints

```
  ✓   POST /uploads/sessions
  ✓   PUT  /uploads/:id/assets/:kind
  ✓   POST /uploads/finalize
  ◐   GET  /conversations                  add filters, add visibility
  ✓   GET  /conversations/:id/render
  ✓   GET  /conversations/:id/artifacts/:artifactId
  +   GET  /conversations/:id              full metadata + revision info
  +   GET  /conversations/:id/digest       per-session digest
  +   PATCH /conversations/:id/visibility  set private/unlisted/public
  +   GET  /shared/:slug                   unauthenticated public view
```

### Profile endpoints

```
  ✓   GET  /profile                        full UserProfile
  ✓   POST /profile/recompute              force recompute
  +   GET  /profile/stats                  lightweight header stats
  +   GET  /profile/activity               paginated digest feed
  +   GET  /profile/public/:username       filtered public profile
  +   PATCH /profile/settings              opt-in toggles
```

### Repository endpoints

```
  ✓   GET  /repo/:owner/:name              public aggregate (rename to /repos/)
  +   GET  /repos                          list user's repos
  +   GET  /repos/:owner/:name             GitHub-gated, with viewer role
  +   PATCH /repos/:owner/:name/visibility
  +   PATCH /repos/:owner/:name/conversations/:id/repo-visibility
```

### Auth + tokens

```
  ✓   POST /cli-auth/authorize
  ✓   POST /cli-auth/exchange
  ✓   GET  /cli-auth/whoami
  +   GET  /api-tokens                     list user's CLI tokens
  +   POST /api-tokens                     create new token
  +   DELETE /api-tokens/:id               revoke token
```

### Misc

```
  ✓   GET  /pricing/models                 OpenRouter proxy
  +   GET  /og/profile/:username.png       OG image generation
  +   POST /sessions/:id/view              view counter
```

**Count:** 13 existing, 18 new. The new ones are roughly evenly split between
"add missing reads" and "add visibility/admin writes."

---

## Data Flow: One Sync, Many Surfaces

The key insight is that a single sync creates data that lights up many pages:

```
  CLI sync
     │
     ├─ parse session locally → CanonicalSession
     ├─ derive RenderDocument
     ├─ build SourceBundle (tarball)
     │
     ▼
  POST /uploads/sessions → PUT bytes → POST /uploads/finalize
     │
     ▼
  API finalize writes:
  ┌─────────────────────────────┐
  │  R2                         │
  │  ├─ canonical.json.gz       │ ──→ nothing directly reads this yet
  │  ├─ render.json.gz          │ ──→ /s/:slug → RenderDocument
  │  └─ source-bundle.tar.gz    │ ──→ future reparse only
  │                             │
  │  D1                         │
  │  ├─ conversations           │ ──→ /home, /sessions, /s/:slug header
  │  ├─ conversation_revisions  │ ──→ /s/:slug revision metadata
  │  ├─ conversation_assets     │ ──→ /s/:slug R2 key lookup
  │  ├─ session_digests         │ ──→ /home feed, /insights, /r/:owner/:name
  │  │                          │      /s/:slug sidebar, /@username
  │  └─ user_profiles           │ ──→ /home stats, /insights, /@username
  │     (marked stale)          │      (recomputed on next read)
  └─────────────────────────────┘
```

**Every page below reads at least one of these writes:**

```
  /home         ← conversations + session_digests (via /profile/activity)
                  user_profiles (via /profile/stats)
  /insights     ← user_profiles (via /profile)
  /sessions     ← conversations + session_digests (via /profile/activity)
  /s/:slug      ← conversations (metadata)
                + conversation_assets → R2 render.json.gz (via /render)
                + session_digests (via /digest)
  /r/:owner/..  ← session_digests + conversations (via /repos/:owner/:name)
  /@:username   ← conversations + session_digests + user_profiles
                  (via /profile/public)
  /settings     ← api_tokens + users + user_profiles
```

This is why the digest extraction step in finalize is load-bearing. Every web
page that isn't the literal conversation viewer reads from `session_digests`.

---

## Design Inspiration: Claude Code Web's Own Style

The document style we're aiming for is what Claude Code itself produces in its
web interface — clean, structured, reference-grade documents. Specifically:

### Visual characteristics

```
  ┌──────────────────────────────────────────────────────────────┐
  │  Tables for quick scanning                                   │
  │  ├── Headers in bold                                         │
  │  ├── Monospace field names                                   │
  │  └── Clear type annotations                                  │
  │                                                              │
  │  Code blocks with language hints                             │
  │  ├── JSON for response shapes                                │
  │  ├── Text for workflow diagrams                              │
  │  └── Bash for commands                                       │
  │                                                              │
  │  Workflow arrows (→) instead of prose                        │
  │  Tree structures (├── └──) for hierarchies                   │
  │  Horizontal rules (───) for section breaks                   │
  │  Inline status markers (✓ ◐ +)                               │
  └──────────────────────────────────────────────────────────────┘
```

### What we're intentionally avoiding

- Dense paragraphs. Every data point is in a table, list, or block.
- Vague prose. Every endpoint has a concrete request/response shape.
- Visual decoration. The emoji section markers are structural, not ornamental.
- Inconsistent formatting. Every page section follows the same template.

### How this helps the UX designer

When the designer is working on any page in doc 17, they can:

1. Look up the page in this doc (numbered 1-11, same as doc 17)
2. See exactly which endpoints fire and in what order
3. Know the exact shape of every response field
4. Understand which fields are required vs optional
5. Know the nature of each response (cached? live? aggregate?) to design
   appropriate loading states
6. Spot opportunities to combine or simplify data needs

### How this helps the API engineer

1. Clear endpoint contracts before implementation
2. Explicit status on what exists vs what's new
3. Concrete field names and types for Zod schema generation
4. Caching strategy included in each endpoint note
5. Cross-referenced with existing doc 14/16/17 decisions

---

## Related Documents

- [14-repositories-and-project-grouping.md](14-repositories-and-project-grouping.md) — repo data model
- [15-jtbd-ux-flows-and-user-journey.md](15-jtbd-ux-flows-and-user-journey.md) — user journey
- [16-team-access-and-github-integration.md](16-team-access-and-github-integration.md) — GitHub auth
- [17-web-app-pages-and-screens.md](17-web-app-pages-and-screens.md) — page wireframes (the companion to this doc)
- [19-developer-brutalism-prd.md](19-developer-brutalism-prd.md) — alternate (archived) design direction
- [20-design-md-the-archive.md](20-design-md-the-archive.md) — **canonical visual design system**
- [03-data-model-d1-r2.md](03-data-model-d1-r2.md) — D1 schema
- [04-api-contracts-hono-openapi.md](04-api-contracts-hono-openapi.md) — contract approach
