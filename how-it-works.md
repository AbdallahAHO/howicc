# How HowiCC Works

HowiCC reads your local AI coding sessions, parses them into a canonical format, aggregates insights, and optionally syncs them to howi.cc for sharing.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  LOCAL (your machine)                                                │
│                                                                      │
│  ~/.claude/projects/          CLI (howicc)                           │
│  ├── project-A/               ├── profile    → dashboard from all   │
│  │   ├── session-1.jsonl      ├── list       → browse sessions      │
│  │   ├── session-2.jsonl      ├── inspect    → deep-dive one        │
│  │   └── session-2/           ├── sync       → upload to howi.cc    │
│  │       ├── tool-results/    └── login      → authenticate         │
│  │       └── subagents/                                              │
│  └── project-B/                                                      │
│      └── ...                                                         │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  CLOUD (howi.cc)                                                     │
│                                                                      │
│  Cloudflare Workers API        D1 (metadata)    R2 (blobs)          │
│  ├── POST /uploads/sessions    conversations    source-bundle.tar.gz │
│  ├── PUT  /uploads/:id/assets  revisions        canonical.json.gz   │
│  ├── POST /uploads/finalize    assets            render.json.gz     │
│  ├── GET  /conversations       session_digests                      │
│  ├── GET  /profile             user_profiles                        │
│  └── GET  /pricing/models                                           │
│                                                                      │
│  Astro Web App                                                       │
│  ├── /login         → GitHub OAuth                                  │
│  └── /profile       → user dashboard (future)                       │
└──────────────────────────────────────────────────────────────────────┘
```

## The Parse Pipeline

Every session goes through 6 stages:

### 1. Discovery

Scans `~/.claude/projects/*/` for `.jsonl` transcript files. Reads the first and last 64KB of each file to extract lite metadata (session ID, branch, slug, first prompt preview) without parsing the full transcript.

### 2. Bundle

Collects the transcript file plus all sidecars into a `SourceBundle`:
- **Transcript** — the main `.jsonl` file (user/assistant/system entries)
- **Tool results** — large outputs stored in `session-id/tool-results/`
- **Subagent transcripts** — nested agent conversations in `session-id/subagents/`
- **Plan files** — from `~/.claude/plans/slug.md`

### 3. Canonical Session

Parses the raw JSONL into a structured `CanonicalSession`:

- **Thread selection** — builds a UUID parent→child graph, finds the latest leaf, traces back to root. Dead branches (user-edited prompts) are excluded.
- **Event building** — converts entries into typed events: `user_message`, `assistant_message`, `tool_call`, `tool_result`, `hook`, `system_notice`, `subagent_ref`, `compact_boundary`
- **Thinking blocks** — redacted blocks (empty text + signature hash) are dropped. Content-bearing blocks become `isMeta: true` assistant messages.
- **Image blocks** — inline base64 images produce `[N images attached]` placeholder text.
- **Tool labels** — derived from input fields: Read→file_path, Bash→command, Grep→pattern, Agent→description, Skill→`/name`, TaskUpdate→`#id → status`
- **Token deduplication** — CC stores the same API response usage on every content block entry. Groups consecutive entries by (input_tokens, cache_write, cache_read) and takes only the last per group.
- **Artifact extraction** — plans, question interactions, tool decisions, todo snapshots, tool outputs
- **Digest hints** — MCP servers from `mcp_instructions_delta` attachment entries, PR links from `pr-link` entries, cache hit rate, idle-gap-adjusted active duration, repository from PR URLs or git remote text

### 4. Cost Estimation

Fetches the OpenRouter pricing catalog (351 models with input/output/cache pricing). The `@howicc/model-pricing` package matches local model IDs (e.g., `claude-opus-4-6`) against catalog entries and computes per-session cost estimates.

### 5. Session Digest

A lightweight (~8KB) summary per session extracted from the canonical data:

- **Identity** — session ID, provider, project, branch, title, repository
- **Counters** — turns, messages, tool runs, errors, rejections, interruptions, compactions, subagents
- **Tool categories** — `read`, `write`, `search`, `command`, `agent`, `mcp`, `plan`, `question`, `task`, `web`, `other`
- **Productivity** — files changed/read, languages detected, git commits/pushes, PR links, file iteration depth, time to first edit
- **Classification** — session type: `building` (write>40%), `debugging` (command>50%), `exploring` (read>50%), `investigating` (search>30%), `mixed`
- **Models** — per-model input/output token totals
- **Integrations** — MCP servers (configured vs used), skills triggered
- **Repository** — owner/name/fullName with source attribution (pr_link > git_remote > cwd_derived)

### 6. User Profile

Aggregates all session digests into one `UserProfile`:

- **Activity** — total sessions, duration, active days, streaks, hourly/weekday distribution, daily activity calendar
- **Projects** — per-project breakdown with languages, branches, repository links
- **Productivity** — files changed, git commits, PRs, languages, top edited files, session type distribution, avg iteration depth, avg time to first edit
- **Toolcraft** — tool category breakdown, error/rejection/interruption/compaction rates, plan/agent/thinking usage rates
- **Models** — per-model session count, token totals, cost
- **Cost** — total, per-session average, by-month breakdown
- **Integrations** — MCP servers (configured count vs used count vs total calls), skills
- **Providers** — session count per provider (Claude Code, future: Codex, Cursor)

## Sync Flow

```
CLI                         API                      D1              R2
───                         ───                      ──              ──
parse session locally
extract canonical + render
gzip all 3 assets
                    ──→ POST /uploads/sessions
                    ←── { uploadId, targets }
                    ──→ PUT  assets/source_bundle
                                              ──→ store draft blob
                    ──→ PUT  assets/canonical_json
                                              ──→ store draft blob
                    ──→ PUT  assets/render_json
                                              ──→ store draft blob
                    ──→ POST /uploads/finalize
                            validate drafts
                            parse canonical from R2
                                              ──→ upsert conversation
                                              ──→ insert revision
                                              ──→ promote draft → final keys
                                              ──→ insert assets
                            extract digest
                                              ──→ upsert session_digest
                    ←── { conversationId, revisionId }
store sync state locally

GET /profile triggers lazy recompute if digest count changed
```

## Repository Grouping

Sessions are grouped by git repository, not by working directory. Multiple CWDs can map to the same repo (main checkout, worktrees, monorepo subdirs):

```
~/.superset/worktrees/really-app/feat/wave0     ─┐
~/.superset/worktrees/really-app/feat/rel-217   ─┤── axetay/really-app
~/Developer/work/axetay/really-app              ─┘
```

Three-tier detection: PR link URL → git remote in Bash output → CWD path derivation.

## Tool Category Mapping

Provider-neutral categorization that works across Claude Code, Codex, and future providers:

| Category  | Claude Code tools                              | Codex equivalent    |
|-----------|-------------------------------------------------|---------------------|
| read      | Read, NotebookRead, LS, LSP                    | file_read           |
| write     | Edit, Write, MultiEdit, NotebookEdit            | file_write          |
| search    | Grep, Glob                                      | search              |
| command   | Bash, PowerShell, REPL                          | shell               |
| agent     | Agent, SendMessage, Brief, TeamCreate            | —                   |
| plan      | EnterPlanMode, ExitPlanMode, TodoWrite           | —                   |
| question  | AskUserQuestion                                 | —                   |
| task      | TaskCreate, TaskUpdate, CronCreate               | —                   |
| web       | WebSearch, WebFetch, WebBrowser                  | —                   |
| mcp       | mcp__*__*                                        | —                   |
| other     | Skill, ToolSearch, Config, Sleep                 | —                   |

## MCP Server Tracking

Two distinct signals:

- **Configured** — from `mcp_instructions_delta` attachment entries at session start. Tells you which MCP servers connected and loaded their instructions.
- **Used** — from `mcp__<server>__<tool>` tool call events. Tells you which servers had tools actually invoked.

Server names are normalized (dots/spaces → underscores) so configured names match tool-call-derived names.

## Key Files

| File | Purpose |
|------|---------|
| `packages/canonical/src/digest.ts` | SessionDigest type definition |
| `packages/canonical/src/profile.ts` | UserProfile type definition |
| `packages/canonical/src/tool-category.ts` | ToolCategory enum + categorizer |
| `packages/profile/src/digest.ts` | extractSessionDigest() |
| `packages/profile/src/aggregate.ts` | buildUserProfile() |
| `packages/provider-claude-code/src/parse/metrics.ts` | Token dedup + usage timeline |
| `packages/provider-claude-code/src/parse/buildEvents.ts` | JSONL → canonical events |
| `packages/provider-claude-code/src/parse/digestHints.ts` | MCP config, PRs, cache rate, repo |
| `packages/provider-claude-code/src/canonical/buildCanonicalSession.ts` | Pipeline orchestrator |
| `apps/cli/src/commands/profile.ts` | TUI profile dashboard |
| `apps/cli/src/commands/inspect.ts` | TUI session deep-dive |
| `apps/api/src/modules/uploads/service.ts` | Upload finalize + digest extraction |
| `apps/api/src/modules/profile/service.ts` | Profile CRUD + lazy recompute |
