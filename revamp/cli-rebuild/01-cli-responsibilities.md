# CLI Responsibilities

This document defines the boundaries of the CLI in the new HowiCC architecture.

## The CLI Is Responsible For

### 1. Local Session Discovery

- find real top-level sessions for supported providers
- avoid importing nested helper files as top-level conversations
- identify source provider and adapter

### 2. Source Bundle Preservation

- collect the transcript file
- collect sidecar artifacts
- collect subagent and related metadata files
- compute a stable revision hash from the imported bundle

### 3. Canonical Parsing

- parse provider-specific disk data into canonical session objects
- preserve unknown events instead of discarding them
- normalize branch and tool semantics deterministically

### 4. Render Document Derivation

- convert canonical session data into UI-friendly blocks
- keep render logic deterministic and reproducible

### 5. Privacy Preflight

- detect secrets, tokens, personal information, and local paths
- optionally redact or mask before upload
- allow the user to preview risky artifacts

### 6. Sync

- request upload session from backend
- upload artifacts
- finalize the revision
- store local sync state by revision hash

### 7. Local Inspection And Debugging

- inspect raw bundle
- inspect canonical session
- inspect render document
- preview what the public page will render

## The CLI Is Not Responsible For

The CLI should not own:

- final public page rendering rules beyond the render document
- user authentication UI
- global search and discovery features
- long-running reprocessing jobs after upload
- publish state management for the website

## Recommended Commands

Keep:

- `howicc list`
- `howicc sync`
- `howicc config`

Add:

- `howicc inspect <session>`
- `howicc preview <session>`
- `howicc export <session> --format bundle|canonical|render`
- `howicc doctor`

## Adapter Boundary

The CLI should be organized around provider adapters.

Example direction:

```text
ClaudeCodeAdapter
CodexAdapter
GenericJsonlAgentAdapter
```

Each adapter should implement the same high-level interface:

```ts
type ProviderAdapter = {
  provider: string
  discoverSessions(): Promise<DiscoveredSession[]>
  buildSourceBundle(session: DiscoveredSession): Promise<SourceBundle>
  parseCanonicalSession(bundle: SourceBundle): Promise<CanonicalSession>
}
```

That gives us a clean path to support more than Claude Code later without polluting the core model.
