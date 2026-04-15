# Monorepo Structure

The repo already uses a minimal `pnpm` workspace. The revamp should formalize it into a stronger monorepo with shared packages.

## Recommended Structure

```text
howicc/
├── apps/
│   ├── web/
│   ├── api/
│   └── jobs/
├── packages/
│   ├── contracts/
│   ├── canonical/
│   ├── render/
│   ├── model-pricing/
│   ├── db/
│   ├── storage/
│   ├── auth/
│   ├── parser-core/
│   ├── provider-claude-code/
│   ├── provider-codex/
│   ├── provider-shared-artifacts/
│   └── ui/
├── tooling/
│   ├── typescript/
│   └── vitest/
├── cli/
├── revamp/
├── package.json
└── pnpm-workspace.yaml
```

## What Each Package Does

### `apps/web`

- Astro app
- public pages
- authenticated settings UI
- reads render documents from the API or R2-backed endpoints

### `apps/api`

- Hono API on Workers
- upload, finalize, publish, token, and artifact endpoints

### `apps/jobs`

- queue consumers
- background analysis and maintenance jobs

### `packages/contracts`

- Zod schemas for request and response contracts
- OpenAPI route definitions
- types shared across CLI, API, and web

### `packages/canonical`

- canonical session types
- helper validators
- provider-neutral event types

### `packages/render`

- render document types
- deterministic grouping rules
- shared render helpers

### `packages/model-pricing`

- public model catalog fetching
- reliable model-id matching
- cost estimation from usage timelines
- pricing logic shared across providers

### `packages/db`

- Drizzle schema
- generated TypeScript record types
- generated Zod schemas from table definitions
- adapter boundaries for D1 now and PostgreSQL later

### `packages/storage`

- provider-neutral object storage interface
- Cloudflare R2 adapter
- S3-compatible adapter for future portability
- centralized storage key builders

### `packages/auth`

- auth configuration
- session and token helpers

### `packages/parser-core`

- cross-provider parser utilities
- shared privacy inspection helpers

### `packages/provider-claude-code`

- Claude Code-specific discovery and parsing
- transcript repair rules
- plan extraction
- AskUserQuestion extraction
- tool rejection extraction
- todo, task-status, MCP resource, structured-output, skill, and brief extractors

### `packages/provider-codex`

- future Codex adapter implementation

### `packages/provider-shared-artifacts`

- structured artifact extractors that may be reused across providers
- plans, question flows, approvals, rejections, and similar higher-level interaction patterns

### `tooling/typescript`

- shared TypeScript configurations for apps and packages

### `tooling/vitest`

- shared Vitest configuration helpers for packages and apps

### `cli`

- local discovery
- provider adapters
- source bundling
- canonical parsing
- sync client

## Why This Layout Is Better

- schema contracts live in one place
- parser and renderer stay decoupled
- the web app does not need to own backend implementation details
- the CLI can share types with the API without copying them
- future providers slot into the parser boundary instead of leaking into the whole system

## Migration Note

We do not need to rename the repo all at once.

A gradual path is acceptable:

1. keep `cli/`
2. move current `app/` to `apps/web/`
3. add `apps/api/` and `packages/`
4. retire PocketBase code after the new stack is working
