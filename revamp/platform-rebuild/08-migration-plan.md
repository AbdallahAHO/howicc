# Migration Plan

This document describes how to move from the current PocketBase-based system to the new architecture.

## Recommendation

Treat the new system as a rebuild of ingest and persistence, not an incremental patch on the old markdown-first pipeline.

## Keep Versus Replace

### Keep

- overall product idea
- `cli/` package concept
- `app/` website concept
- shareable public URLs
- user-controlled visibility

### Replace

- markdown-first ingest pipeline
- PocketBase storage model
- flat `messages_json` assumption
- recursive `.jsonl` session discovery
- sync-by-session-id behavior

## Suggested Migration Phases

### Phase 1: Contracts And Schemas

- define canonical session schema
- define render document schema
- define API contracts package
- define D1 relational schema

### Phase 2: CLI Rebuild

- implement Claude Code discovery correctly
- implement source bundle builder
- implement canonical parser
- implement local preview and inspection

### Phase 3: New Backend

- introduce Hono API
- introduce D1 and R2
- introduce auth and CLI tokens
- implement revision finalize flow

### Phase 4: New Frontend Renderer

- render from `render_document`
- add expandable artifact views
- add admin/debug views for canonical sessions

### Phase 5: Legacy Handling

- keep old records readable as `legacy_markdown`
- do not pretend old records are equivalent to canonical imports
- optionally offer one-way migration where feasible

## Legacy Record Strategy

The current HowiCC records should be treated as legacy data.

They can still be shown publicly, but they should be marked internally as lacking canonical source fidelity.

Suggested distinction:

- `legacy_markdown`
- `canonical_revisioned`

## Final End State

The product should converge on this rule:

```text
all new shares are revisioned imports backed by:
source bundle + canonical session + render document
```

That gives us a strong foundation for:

- richer UI
- safer privacy workflows
- future providers
- durable platform evolution
