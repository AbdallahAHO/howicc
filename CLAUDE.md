# HowiCC

Share and analyze your AI coding sessions.

## Quick Start

```bash
pnpm install
pnpm gate                    # type-check + test + build (run before committing)
pnpm dev:local               # reset local DB + start API + web
```

## Gate Command

`pnpm gate` is the quality gate. It runs type-check across all packages, all tests, and builds the CLI. 32 turbo tasks, ~7 seconds. Run it before every commit.

## Monorepo Structure

```
apps/
  api/         Hono API on Cloudflare Workers (D1 + R2)
  web/         Astro web app (SSR on Cloudflare)
  cli/         CLI tool (`howicc` command)

packages/
  canonical/   Core types: sessions, events, artifacts, digests, profiles
  profile/     Session digest extraction + user profile aggregation
  provider-claude-code/   Claude Code parser (JSONL → canonical)
  parser-core/            Provider-neutral adapter interface
  model-pricing/          OpenRouter pricing catalog + cost estimation
  render/                 Canonical → RenderDocument for UI
  db/                     Drizzle schema (D1/Postgres), migrations
  storage/                R2/S3 object storage adapter
  auth/                   Better Auth with GitHub OAuth
  contracts/              Hono OpenAPI route contracts
  api-client/             Typed API client for CLI/web
```

## Key Commands

```bash
pnpm gate                           # full validation (type-check + test + build)
pnpm test                           # all tests via turbo
pnpm type-check                     # all packages via turbo
pnpm dev:local                      # DB reset + API + web dev servers
pnpm dev:api                        # API only (port 8787)
pnpm dev:web                        # web only (port 4321)

# CLI
pnpm --filter @howicc/cli build     # build CLI
node apps/cli/dist/index.cjs profile    # AI coding dashboard
node apps/cli/dist/index.cjs list       # browse local sessions
node apps/cli/dist/index.cjs inspect <id>  # deep-dive session
node apps/cli/dist/index.cjs sync       # upload to howi.cc

# Database
pnpm --filter @howicc/api db:prepare:local   # reset + migrate local D1
pnpm --filter @howicc/api db:migrate:local   # run migrations only

# Individual packages
pnpm --filter @howicc/provider-claude-code test
pnpm --filter @howicc/profile type-check
```

## Local Development Setup

1. Copy `apps/api/.dev.vars.example` → `apps/api/.dev.vars` and fill in:
   - `BETTER_AUTH_SECRET` — any random string for local dev
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from GitHub OAuth app
   - Storage vars can use defaults for local R2

2. Run `pnpm dev:local` — resets local D1, starts API on :8787 and web on :4321

3. Important: stop the dev server before running `db:prepare:local` or migrations will silently fail (Wrangler and the CLI share the same D1 file on disk).

## Data Pipeline

```
~/.claude/projects/         Claude Code session files (JSONL)
        ↓
discoverClaudeSessions()    Scans, reads lite metadata
        ↓
buildSourceBundle()         Collects transcript + sidecars + plans
        ↓
buildCanonicalSession()     Parses events, artifacts, metrics, digestHints
        ↓
extractSessionDigest()      Lightweight summary (~8KB per session)
        ↓
buildUserProfile()          Folds all digests into one UserProfile
```

## Coding Conventions

- TypeScript everywhere, 2-space indent
- Feature-based folders, not type-based (`/tools` not `/utils`)
- Follow existing patterns in the package you're modifying
- Use `Edit` over full file writes
- Check `pnpm gate` passes before committing

## Testing

- Unit tests: `packages/*/src/__tests__/` (synthetic fixtures)
- Integration tests: `provider-claude-code/src/__tests__/local.integration.test.ts` (real `~/.claude/` data)
- The integration tests run against session `f40fecf9` and all discovered sessions
- Tests must be resilient to the target session growing (it's a living conversation)
- Use relative assertions (`toBeGreaterThan`) not absolute values for living session data

## Key Design Decisions

- **SessionDigest** is the aggregation primitive — extracted once per session, stored in D1, profile computed by folding all digests
- **ToolCategory** normalizes tool names across providers (CC `Read` = Codex `file_read` = `read`)
- **Token deduplication** — CC splits one API response into multiple JSONL entries; metrics groups consecutive entries by (input, cache_write, cache_read) and takes the last
- **Thinking blocks** — redacted (empty text + signature) are dropped; content-bearing ones emit as `isMeta: true` assistant messages
- **MCP server names** are normalized (dots/spaces → underscores) so configured names match tool-call-derived names
- **Repository detection** — three tiers: pr-link > git remote in tool output > cwd path
- **Profile recomputes lazily** — on next `GET /profile` when digest count mismatches

## Workbench

`packages/provider-claude-code/workbench/` contains versioned snapshots of the full pipeline output. Run:

```bash
cd packages/provider-claude-code
./node_modules/.bin/tsx workbench/snapshot.ts <sessionId> workbench/v<N>
```

Diff between versions to verify improvements.
