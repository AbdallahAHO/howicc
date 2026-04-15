# Architectural Principles And Invariants

This document captures the rules that should remain true even as the implementation evolves.

If we keep these invariants intact, the system can grow without falling back into the same problems as the early HowiCC implementation.

## Why This Document Exists

It is easy for a system like this to slowly regress into:

- lossy ingest
- too much provider-specific logic leaking everywhere
- a renderer that secretly depends on parser internals
- a backend that starts storing convenience blobs instead of durable source-of-truth data

These principles exist to prevent that drift.

## Core Principles

## 1. Preserve Before Interpreting

The CLI must preserve the imported source bundle before parsing, redaction, or rendering.

Why:

- reproducibility
- future reparsing
- easier debugging
- safer parser iteration

Rule:

```text
no canonical session without a preserved source bundle
```

## 2. Canonical Before Render

The UI must never depend directly on provider source files.

Rule:

```text
provider source -> canonical session -> render document -> UI
```

Never:

```text
provider source -> UI
```

## 3. Events, Assets, And Artifacts Are Different Things

These layers must stay distinct.

- events = normalized timeline facts
- assets = file/blob payload references
- artifacts = semantic extracted units

If these blur together, the schema becomes hard to reason about and hard to evolve.

## 4. Markdown Is An Export, Not A Storage Model

Markdown can exist as:

- export
- share helper
- copyable user format
- legacy fallback

It must not become the canonical ingest representation again.

## 5. Provenance Is Mandatory

Every meaningful extracted artifact should preserve enough provenance to answer:

- which event(s) created it
- which tool use it came from
- which asset(s) it references
- which agent thread it belongs to

If we cannot trace an artifact back to its source, we cannot trust it.

## 6. Provider Adapters Own Provider Weirdness

Provider-specific logic belongs inside provider packages.

Examples:

- Claude Code path sanitization
- Claude Code branch recovery
- Claude Code plan file lookup
- Codex-specific file layout in the future

The rest of the system should depend on provider-neutral shapes.

## 7. Artifact Extractors Are A Separate Layer

The raw parser should aim for fidelity.

Artifact extractors should aim for usability.

This prevents:

- giant parser files
- parser/UI coupling
- hard-to-test behavior

## 8. Revision Identity Must Be Source-Based

A revision is not just a `sessionId`.

It is a stable hash of the imported source bundle plus manifest decisions.

Rule:

```text
same source bundle = same revision hash
different source bundle = different revision hash
```

## 9. Rejections And Redirects Are First-Class Outcomes

Not every failed-looking tool result is a normal error.

The system must preserve distinctions such as:

- tool rejected by user
- tool redirected
- tool aborted
- hook prevented continuation
- genuine tool execution failure

This is critical for explaining conversation flow.

## 10. Render Builders Must Prefer Explicit Artifacts Over Heuristics

If we already extracted a `QuestionArtifact`, `PlanArtifact`, or `TodoSnapshotArtifact`, the renderer should use it.

It should not try to infer the same structure again from raw events.

## 11. Privacy Review Must Happen Before Public Exposure

Privacy is not an optional post-processing enhancement.

The system should:

- inspect locally in the CLI before upload when possible
- preserve review flags in the backend
- block public exposure when necessary

## 12. Unknown Data Must Be Preserved, Not Silently Dropped

If the provider emits a new event type or attachment we do not understand yet, the parser should preserve it as unknown structured data.

Dropping unknown data creates silent corruption and makes parser upgrades harder.

## Design Invariants

These invariants should remain true in code reviews and implementation decisions.

### Invariant A

Every `RenderDocument` must be derivable from a `CanonicalSession` without consulting provider disk files.

### Invariant B

Every `SessionArtifact` must be backed by provenance into `events`, `assets`, or both.

### Invariant C

The renderer must not need provider-specific imports.

### Invariant D

The backend must not store large transcript payloads in D1 rows.

### Invariant E

The CLI must be able to export and inspect:

- source bundle
- canonical session
- render document

### Invariant F

A parser upgrade should not require a new frontend deploy to remain correct, as long as the render contract is respected.

## Review Checklist

When making implementation decisions later, ask:

1. Are we preserving raw source before interpretation?
2. Are we keeping provider-specific logic inside the provider adapter?
3. Are we creating an artifact that should instead be an asset, or vice versa?
4. Are we adding a heuristic where a typed artifact should exist?
5. Are we losing provenance?
6. Are we storing something in D1 that belongs in R2?

If the answer to any of those is yes, the implementation is drifting from the intended architecture.
