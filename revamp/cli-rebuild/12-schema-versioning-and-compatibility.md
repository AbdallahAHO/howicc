# Schema Versioning And Compatibility

This document defines how we should version the data contracts in the new system.

If we do not make these rules explicit now, the revamp will become brittle as soon as the parser or UI evolves.

## Versioned Layers

We have at least four meaningful version layers.

1. source bundle schema version
2. canonical session schema version
3. render document schema version
4. parser version

These are not the same thing and should not be collapsed into one field.

## Recommended Version Fields

### Source Bundle

```ts
type SourceBundle = {
  kind: 'agent_source_bundle'
  version: 1
  provider: ProviderId
  ...
}
```

### Canonical Session

```ts
type CanonicalSession = {
  kind: 'canonical_session'
  schemaVersion: 1
  parserVersion: string
  ...
}
```

### Render Document

```ts
type RenderDocument = {
  kind: 'render_document'
  schemaVersion: 1
  ...
}
```

## What Each Version Means

### `source bundle version`

Describes the format of the imported source package.

Change this when:

- manifest format changes
- file-kind semantics change
- archive packaging changes in a breaking way

### `canonical session schemaVersion`

Describes the shape of the canonical model.

Change this when:

- event shapes change incompatibly
- asset or artifact structures change incompatibly
- fields are renamed or removed

### `render document schemaVersion`

Describes the public rendering contract.

Change this when:

- block types change incompatibly
- required render fields change
- context or block semantics break older renderers

### `parserVersion`

Describes the parser implementation revision.

Change this when:

- extraction logic changes
- heuristics improve
- bug fixes alter canonical output semantics

This is not necessarily a schema change.

## Compatibility Rules

## Rule 1: Schemas Change Rarely, Parsers Change Often

We should prefer parser updates over schema churn.

If we can improve extraction quality without changing the canonical or render contract, do that.

## Rule 2: Additive Changes First

When possible, evolve schemas additively.

Examples:

- add a new optional artifact field
- add a new block subtype that older renderers can ignore
- add a new provider-specific metadata field

Avoid destructive changes unless they unlock a clearly better long-term design.

## Rule 3: Keep Re-Renders Cheap

If the canonical session remains valid but the render contract changes, we should be able to regenerate render documents without re-importing the source bundle.

## Rule 4: Keep Re-Parses Possible

If the parser improves significantly, we should be able to rebuild canonical sessions from the preserved source bundle.

That is one of the main reasons to store the source bundle.

## Rule 5: Legacy Records Stay Marked As Legacy

Do not pretend old markdown-only uploads are equivalent to revisioned canonical imports.

They should remain explicitly marked as legacy.

## Version Compatibility Matrix

Recommended behavior:

### Source Bundle v1 -> Canonical v1

- supported

### Canonical v1 -> Render v1

- supported

### Canonical v1 -> Render v2

- possible through a new render builder, if v2 changes are additive or explicitly migrated

### Legacy markdown -> Canonical v1

- not assumed supported
- only migrate if a deliberate migration tool exists

## Backend Storage Guidance

Each stored revision should persist at least:

- source bundle version
- canonical session schema version
- render document schema version
- parser version

That makes debugging much easier.

## Reprocess Triggers

We should define when a stored revision needs reprocessing.

### Rebuild render only

When:

- `render schemaVersion` changes
- render builder behavior changes
- canonical session stays valid

### Rebuild canonical and render

When:

- parser bug fixes change event extraction
- artifact extraction improves materially
- canonical schema changes

## Suggested Policy For Breaking Changes

When a breaking schema change is truly needed:

1. define the new schema version
2. document the migration or regeneration path
3. keep older records readable where feasible
4. avoid mixing incompatible versions in one runtime path without an adapter

## Practical Recommendation

For the first implementation:

- keep `schemaVersion: 1` for source, canonical, and render until the initial package implementation settles
- use `parserVersion` for iteration speed
- prefer regenerating canonical/render artifacts from stored source bundles instead of trying to mutate old rows in place

That gives us the most flexibility with the least confusion.
