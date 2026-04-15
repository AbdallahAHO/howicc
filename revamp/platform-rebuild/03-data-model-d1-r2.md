# Data Model: D1 And R2

This document defines what should live in D1 and what should live in R2.

## Core Rule

Use D1 for metadata.

Use R2 for large or versioned files.

Use Drizzle as the schema, query, and migration layer for D1 so the relational model stays explicit and portable.

The DB package should keep the schema definitions portable so the runtime adapter can move from D1 to Postgres later without redefining the domain model.

## D1 Tables

Recommended core tables:

- `users`
- `accounts`
- `sessions`
- `api_tokens`
- `conversations`
- `conversation_revisions`
- `conversation_assets`
- `upload_sessions`
- `upload_session_assets`
- `model_catalog_snapshots`
- `model_catalog_entries`
- `tags`
- `conversation_tags`

## Conversation Model

### `conversations`

This is the stable share object.

Suggested fields:

- `id`
- `owner_user_id`
- `slug`
- `title`
- `visibility`
- `status`
- `source_app`
- `source_session_id`
- `source_project_key`
- `current_revision_id`
- `created_at`
- `updated_at`

Recommended uniqueness:

- unique on `owner_user_id + source_app + source_session_id`

### `conversation_revisions`

Each sync creates a new revision when the source revision hash changes.

Suggested fields:

- `id`
- `conversation_id`
- `source_revision_hash`
- `parser_version`
- `canonical_schema_version`
- `render_schema_version`
- `selected_leaf_uuid`
- `summary`
- `safety_flags_json`
- `stats_json`
- `search_text`
- `created_at`

Recommended uniqueness:

- unique on `conversation_id + source_revision_hash`

### `conversation_assets`

This table points from metadata rows to blob files in R2.

Suggested fields:

- `id`
- `revision_id`
- `kind`
- `r2_key`
- `sha256`
- `bytes`
- `meta_json`

Recommended uniqueness:

- unique on `revision_id + kind`

### `upload_sessions`

This tracks draft revision uploads before finalize succeeds.

Suggested fields:

- `id`
- `user_id`
- `source_revision_hash`
- `status`
- `expires_at`
- `finalized_at`
- `created_at`

### `upload_session_assets`

This tracks each expected draft asset before it is promoted into revision storage.

Suggested fields:

- `id`
- `upload_session_id`
- `kind`
- `storage_key`
- `sha256`
- `bytes`
- `content_type`
- `uploaded_at`
- `created_at`

Recommended uniqueness:

- unique on `upload_session_id + kind`

### `model_catalog_snapshots`

This stores fetch-level metadata for public pricing/model catalogs.

Suggested fields:

- `id`
- `provider`
- `source_url`
- `source_hash`
- `model_count`
- `fetched_at`
- `raw_catalog_storage_key`
- `created_at`

### `model_catalog_entries`

This stores normalized queryable model rows for one snapshot.

Suggested fields:

- `id`
- `snapshot_id`
- `provider`
- `model_id`
- `canonical_slug`
- `display_name`
- `context_length`
- `prompt_usd_per_token`
- `completion_usd_per_token`
- `input_cache_read_usd_per_token`
- `input_cache_write_usd_per_token`
- `created_at`

## Adapter Boundaries

The platform should keep its infrastructure seams explicit.

- `@howicc/db`
  - Drizzle schema definitions
  - generated TypeScript record types
  - generated Zod schemas derived from the same tables
  - runtime adapters such as D1 and Postgres
- `@howicc/storage`
  - provider-neutral object storage interface
  - R2 adapter now
  - S3-compatible adapter for future portability

That keeps API and jobs code dependent on stable package boundaries rather than vendor-specific primitives.

## R2 Objects

Implemented R2 object layout:

```text
conversations/<conversationId>/<revisionHash>/source-bundle.tar.gz
conversations/<conversationId>/<revisionHash>/canonical.json.gz
conversations/<conversationId>/<revisionHash>/render.json.gz
conversations/<conversationId>/<revisionHash>/artifacts/<artifactId>.txt
draft-uploads/<uploadId>/<kind>
```

Notes:

- the stable D1 `source_revision_hash` can be larger than is convenient for object storage paths
- use a stable storage-safe revision id derived from the full source revision hash for the R2 path segment when needed
- keep the full `source_revision_hash` in D1 as the canonical lineage identifier

## Why Revision Rows Matter

Claude Code sessions evolve over time.

One `sessionId` can continue receiving new transcript data. If we only store one flattened record, we lose lineage and make re-sync behavior unreliable.

Revision rows let us:

- track exact imported snapshots
- rebuild current public view from the latest revision
- inspect older imports if needed
- re-run parsing and rendering later

## Search Strategy

Start simple.

Store:

- `title`
- `summary`
- `search_text`
- tags

Later we can decide whether to add more sophisticated search indexing.

## D1 Limitation Strategy

D1 is a good starting point if we avoid forcing large blobs into relational tables.

If we later outgrow D1 for metadata queries, Drizzle helps us migrate to another SQL backend without changing the whole contract model.
