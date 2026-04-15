# HowiCC

Share local coding-agent conversations as readable, structured artifacts.

HowiCC is being rebuilt around a stronger import model:

```text
source bundle
-> canonical session
-> render document
-> UI
```

The active implementation now lives in the monorepo structure documented below.

## Workspace Overview

```text
apps/
  web/   Astro frontend
  api/   Hono API
  jobs/  background worker scaffold
  cli/   new command-line app

packages/
  canonical/
  render/
  parser-core/
  provider-claude-code/
  provider-shared-artifacts/
  contracts/
  api-client/
  db/
  storage/
  auth/

tooling/
  typescript/
  vitest/

revamp/
  architecture, parser, platform, and rollout documentation
```

## Legacy Paths

This still exists during the transition:

- `app/`

It remains a useful reference, but it no longer defines the target architecture.

## Current Direction

The new stack is built around:

- Astro SSR for the frontend
- React islands for authenticated UI interactions
- Hono for the API
- Drizzle for the relational schema layer
- D1-first metadata storage with a Postgres adapter seam later
- R2-first object storage with an S3-compatible adapter seam later
- contract-first API packages
- provider adapters for Claude Code now and more agents later

## Development Commands

### New Stack

```bash
pnpm install
pnpm type-check
pnpm build

pnpm dev:local
pnpm dev:web
pnpm dev:api
pnpm dev:jobs

### Cloudflare Deploy

```bash
pnpm --filter @howicc/api cf:deploy
pnpm --filter @howicc/jobs cf:deploy
pnpm --filter @howicc/web cf:deploy
```
```

### Legacy Stack

```bash
pnpm dev:legacy:web

pnpm build:legacy:web

pnpm type-check:legacy:web
```

## Environment Strategy

HowiCC now follows a package-owned environment contract pattern inspired by `really-app` and `starters/core`.

### Package-owned env contracts

Shared packages export env contracts through `keys.ts`:

- `@howicc/db/keys`
- `@howicc/storage/keys`
- `@howicc/auth/keys`

These packages define what they need without owning application runtime composition.

### App-owned env composition

Apps compose package presets in their own `env.ts` files:

- `apps/api/src/env.ts`
- `apps/jobs/src/env.ts`
- `apps/web/src/env.ts`

### Worker runtime split

Worker-style apps also separate string env vars from platform bindings:

- `env.ts` for string-based configuration
- `bindings.ts` for Cloudflare object bindings
- `runtime.ts` for composing both into runtime context

This keeps D1/R2/Queue bindings out of the plain env schema while still making the runtime contract explicit.

## Current Cloudflare Shape

The project is now aligned around this Cloudflare layout:

- `howicc-web`
  - Astro SSR worker target for the web app
- `howicc-api`
  - Worker mounted on `api.howi.cc`
- `howicc-jobs`
  - background Worker consuming the ingest queue
- `howicc-prod-db`
  - D1 metadata database
- `howicc-prod-assets`
  - R2 bucket for artifacts and raw snapshots
- `howicc-prod-ingest`
  - queue shared between API producer and jobs consumer

The API custom domain is live at `api.howi.cc`.

The current public site at `howi.cc` is live, and the codebase is now being moved toward SSR-capable Astro deployment for protected routes and server-side auth helpers.

## Auth Direction

Auth is now centered on Better Auth with:

- a Better Auth server factory in `@howicc/auth`
- a vanilla client entrypoint for future Astro usage
- D1-backed auth tables in `@howicc/db`
- Hono-mounted auth handler at `/auth/*` on the API worker

For local development, auth is also wired for a separate local GitHub OAuth app with callback:

- `http://localhost:8787/auth/callback/github`

For reliable local startup, `pnpm dev:local` now:

1. resets the local D1 state for the API app
2. applies tracked Wrangler migrations
3. starts the local Astro SSR web app and local Wrangler API together

To fully enable GitHub login in production, the remaining step is to set:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

as Worker secrets for the API app.

### Example env files

- root `.env.example`
- `apps/web/.env.example`
- `apps/api/.dev.vars.example`
- `apps/jobs/.dev.vars.example`

## Documentation

The architecture and rebuild plan live in `revamp/`.

Best starting points:

- `revamp/README.md`
- `revamp/claude-code-understanding/README.md`
- `revamp/cli-rebuild/README.md`
- `revamp/platform-rebuild/README.md`

## Current Status

The monorepo foundation, contract/client layer, env strategy, DB/storage adapter seams, and initial app/package scaffolding are in place.

The web app now also includes a first SSR auth/debug layer:

- Astro middleware session lookup
- protected dashboard route
- auth debug route
- protected React island demo

The next major implementation step is the real Claude Code adapter:

- session discovery
- source bundle generation
- canonical session parsing
- artifact extraction from real Claude Code data
