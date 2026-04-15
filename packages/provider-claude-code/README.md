# @howicc/provider-claude-code

Claude Code adapter for HowiCC.

## What Belongs Here

- Claude Code session discovery
- source bundle building for `~/.claude/projects/...`
- transcript parsing and branch recovery
- Claude Code-specific artifact extractors

## What Stays Elsewhere

- provider-neutral canonical types
- render document builders
- API/storage logic

## Why This Package Exists

Claude Code is the first serious provider for HowiCC. It deserves its own package so its persistence quirks and recovery rules do not leak into the rest of the system.

## Current Status

This package now has the first real implementation slice:

- discovery of top-level Claude Code sessions
- source bundle generation with transcript, tool-results, plans, and subagents
- canonical parsing for core session events
- conversation-level metrics for models, tokens, duration, and mode changes
- first-wave artifact extraction for:
  - plans
  - AskUserQuestion interactions
  - tool decisions
  - tool outputs
  - TodoWrite snapshots

## Pricing Integration

This package does not hardcode pricing internally.

Instead, it emits model usage timelines and can optionally enrich metrics with cost estimates when an OpenRouter pricing catalog is supplied through `@howicc/model-pricing`.

This keeps pricing reusable for other providers and avoids baking OpenRouter assumptions into the parser core.

## Internal Layout

```text
src/
├── discover/
├── bundle/
├── parse/
├── extractors/
├── canonical/
└── test/
    └── fixtures/
        └── workbench/
```

Each layer stays narrow:

- `discover/`
  - locate real top-level sessions only
- `bundle/`
  - preserve the full source bundle for a session revision
- `parse/`
  - normalize raw transcript entries into canonical events and metrics
- `extractors/`
  - lift semantic artifacts out of canonical events
- `canonical/`
  - assemble the final `CanonicalSession`

## Test Strategy

This package uses two test styles:

1. Synthetic tests for deterministic behavior
   - discovery rules
   - sidecar collection
   - plan directory resolution

2. Local integration tests against the machine's actual `~/.claude` data
   - discovery against real sessions
   - source bundle generation with real sidecars
   - parsing of real AskUserQuestion, TodoWrite, plan, and persisted-output sessions

Fixture-backed workbench corpus snapshots and the generator script live under `src/test/fixtures/workbench/` so the full package test surface stays in one place.

The local integration tests are designed to read local Claude data when available without copying the actual transcript contents into the repository.
