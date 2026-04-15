# Package Blueprints

This document defines the initial file-level blueprint for the key monorepo packages we should build first.

The goal is to make implementation obvious and modular before we write code.

## First Packages To Build

The three most important packages to define early are:

1. `packages/canonical`
2. `packages/render`
3. `packages/provider-claude-code`

These three packages anchor the entire ingest and rendering pipeline.

## 1. `packages/canonical`

Purpose:

- define the provider-neutral source-of-truth schema
- host event, asset, and artifact types
- validate canonical session objects

### Recommended File Tree

```text
packages/canonical/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── ids.ts
│   ├── provider.ts
│   ├── metadata.ts
│   ├── source.ts
│   ├── selection.ts
│   ├── stats.ts
│   ├── event.ts
│   ├── asset.ts
│   ├── artifact.ts
│   ├── agent-thread.ts
│   ├── session.ts
│   └── zod/
│       ├── event.schema.ts
│       ├── asset.schema.ts
│       ├── artifact.schema.ts
│       └── session.schema.ts
└── tests/
    ├── session.schema.test.ts
    └── artifact.schema.test.ts
```

### Responsibilities

- no provider-specific disk parsing
- no render-specific grouping logic
- no DB queries
- no Cloudflare assumptions

### Export Surface

`index.ts` should export:

- types
- zod schemas
- type guards
- schema versions

## 2. `packages/render`

Purpose:

- define the render document contract
- convert canonical sessions into frontend blocks
- host deterministic grouping and summarization helpers

### Recommended File Tree

```text
packages/render/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── document.ts
│   ├── context.ts
│   ├── block.ts
│   ├── builders/
│   │   ├── buildRenderDocument.ts
│   │   ├── buildContext.ts
│   │   ├── buildMessageBlocks.ts
│   │   ├── buildQuestionBlocks.ts
│   │   ├── buildActivityGroups.ts
│   │   ├── buildCallouts.ts
│   │   ├── buildSubagentThreads.ts
│   │   ├── buildTodoBlocks.ts
│   │   └── buildTaskTimelineBlocks.ts
│   ├── labels/
│   │   ├── toolLabels.ts
│   │   └── artifactLabels.ts
│   └── zod/
│       ├── block.schema.ts
│       └── document.schema.ts
└── tests/
    ├── buildRenderDocument.test.ts
    ├── buildQuestionBlocks.test.ts
    └── buildActivityGroups.test.ts
```

### Responsibilities

- no filesystem access
- no provider-specific path logic
- no upload or DB concerns

### Dependency Rule

`packages/render` can depend on `packages/canonical`.

`packages/canonical` must not depend on `packages/render`.

## 3. `packages/provider-claude-code`

Purpose:

- discover Claude Code sessions
- build Claude Code source bundles
- parse Claude Code transcripts and sidecars
- extract Claude Code-specific artifacts
- assemble canonical sessions

### Recommended File Tree

```text
packages/provider-claude-code/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── adapter.ts
│   ├── discover/
│   │   ├── findProjects.ts
│   │   ├── findSessions.ts
│   │   └── readLiteMetadata.ts
│   ├── bundle/
│   │   ├── buildSourceBundle.ts
│   │   ├── collectTranscript.ts
│   │   ├── collectToolResults.ts
│   │   ├── collectPlans.ts
│   │   ├── collectSubagents.ts
│   │   └── collectRemoteAgents.ts
│   ├── parse/
│   │   ├── parseJsonl.ts
│   │   ├── parseEntries.ts
│   │   ├── selectLeaf.ts
│   │   ├── buildConversationChain.ts
│   │   ├── recoverParallelToolResults.ts
│   │   ├── normalizeMessages.ts
│   │   ├── pairToolUses.ts
│   │   └── buildEvents.ts
│   ├── extractors/
│   │   ├── plans.ts
│   │   ├── questions.ts
│   │   ├── toolDecisions.ts
│   │   ├── toolOutputs.ts
│   │   ├── todos.ts
│   │   ├── taskStatus.ts
│   │   ├── mcpResources.ts
│   │   ├── structuredOutput.ts
│   │   ├── invokedSkills.ts
│   │   └── brief.ts
│   ├── assets/
│   │   ├── buildAssetRefs.ts
│   │   └── linkAssetRefs.ts
│   ├── canonical/
│   │   ├── buildCanonicalSession.ts
│   │   └── buildSearchText.ts
│   └── diagnostics/
│       ├── inspectBundle.ts
│       └── summarizeImport.ts
└── tests/
    ├── fixtures/
    ├── discover.test.ts
    ├── parse.test.ts
    ├── plans.test.ts
    ├── questions.test.ts
    └── toolOutputs.test.ts
```

### Responsibilities

- filesystem access for Claude Code imports
- Claude Code-specific recovery logic
- Claude Code-specific artifact extraction

### Dependency Rule

`packages/provider-claude-code` can depend on:

- `packages/canonical`
- `packages/parser-core`

It should not depend on:

- `packages/render`
- `packages/db`
- Cloudflare-specific packages

## Supporting Packages

## `tooling/typescript`

Purpose:

- shared TypeScript configuration for apps and packages

Recommended files:

```text
tooling/typescript/
├── package.json
├── README.md
├── base.json
├── library.json
├── node.json
├── worker.json
├── astro.json
└── react-library.json
```

## `tooling/vitest`

Purpose:

- shared Vitest configuration helpers

Recommended files:

```text
tooling/vitest/
├── package.json
├── README.md
├── tsconfig.json
└── src/
    └── base.ts
```

## `packages/parser-core`

Purpose:

- provider-neutral helpers for bundle handling, hashing, and parser orchestration

Recommended files:

```text
packages/parser-core/src/
├── bundle.ts
├── hashing.ts
├── artifact.ts
├── privacy.ts
├── timestamps.ts
└── errors.ts
```

## `packages/model-pricing`

Purpose:

- fetch public model pricing catalogs
- normalize pricing metadata
- match local model ids to public catalog entries
- estimate session cost from extracted usage timelines

This package should stay persistence-free. The API and platform packages can store fetched catalog snapshots while this package stays focused on fetch/normalize/match/estimate behavior.

Recommended files:

```text
packages/model-pricing/
├── package.json
├── README.md
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── openrouter.ts
    ├── claude.ts
    ├── estimate.ts
    └── __tests__/
        └── pricing.test.ts
```

## `packages/contracts`

Purpose:

- API request and response schemas shared by CLI, API, and web

Recommended files:

```text
packages/contracts/src/
├── api/
│   ├── uploads.ts
│   ├── conversations.ts
│   ├── artifacts.ts
│   └── auth.ts
├── shared/
│   ├── ids.ts
│   ├── pagination.ts
│   └── visibility.ts
└── index.ts
```

## `packages/db`

Purpose:

- Drizzle schema, generated record types, generated Zod schemas, and runtime adapters

Recommended files:

```text
packages/db/
├── package.json
├── README.md
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── zod.ts
│   ├── adapters/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── d1.ts
│   │   └── postgres.ts
│   └── schema/
│       ├── index.ts
│       ├── enums.ts
│       ├── users.ts
│       ├── apiTokens.ts
│       ├── conversations.ts
│       └── assets.ts
```

## `packages/storage`

Purpose:

- provider-neutral object storage interface
- key building for revision assets
- R2-first implementation with portability to other object stores later

Recommended files:

```text
packages/storage/
├── package.json
├── README.md
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── keys.ts
    └── adapters/
        ├── index.ts
        ├── r2.ts
        └── s3-compatible.ts
```

## Dependency Rules Across Packages

Recommended dependency direction:

```text
provider packages -> canonical
render -> canonical
apps/api -> contracts + db + canonical
apps/web -> contracts + render
cli -> contracts + canonical + provider packages
```

Avoid:

- `canonical` depending on `provider-*`
- `provider-*` depending on `render`
- `render` depending on `db`

## First Implementation Order

If we want to reduce risk, build packages in this order:

1. `packages/canonical`
2. `packages/render`
3. `packages/provider-claude-code`
4. `packages/contracts`
5. `packages/db`
6. `apps/api`
7. `apps/web`
8. integrate CLI against the new packages

That gives us the core model before we commit to the API and deployment details.
