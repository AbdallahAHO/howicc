CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  github_user_id TEXT,
  email TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  source_app TEXT NOT NULL,
  source_session_id TEXT NOT NULL,
  source_project_key TEXT NOT NULL,
  current_revision_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  source_revision_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  canonical_schema_version INTEGER NOT NULL,
  render_schema_version INTEGER NOT NULL,
  selected_leaf_uuid TEXT,
  summary TEXT,
  safety_flags_json TEXT,
  stats_json TEXT,
  search_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_assets (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  meta_json TEXT
);

CREATE TABLE IF NOT EXISTS model_catalog_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  model_count INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  raw_catalog_storage_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS model_catalog_snapshots_source_hash_idx
  ON model_catalog_snapshots(source_hash);

CREATE TABLE IF NOT EXISTS model_catalog_entries (
  id TEXT PRIMARY KEY NOT NULL,
  snapshot_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  canonical_slug TEXT,
  display_name TEXT NOT NULL,
  context_length INTEGER,
  prompt_usd_per_token TEXT NOT NULL,
  completion_usd_per_token TEXT NOT NULL,
  input_cache_read_usd_per_token TEXT,
  input_cache_write_usd_per_token TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS model_catalog_entries_snapshot_model_id_idx
  ON model_catalog_entries(snapshot_id, model_id);
