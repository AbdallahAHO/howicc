CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  github_user_id TEXT,
  email TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0 NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX users_email_idx ON users(email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX sessions_token_idx ON sessions(token);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX accounts_provider_account_idx
  ON accounts(provider_id, account_id);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX verifications_identifier_value_idx
  ON verifications(identifier, value);

CREATE TABLE cli_auth_grants (
  id TEXT PRIMARY KEY NOT NULL,
  code_hash TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  state TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX cli_auth_grants_code_hash_idx
  ON cli_auth_grants(code_hash);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX api_tokens_token_hash_idx ON api_tokens(token_hash);

CREATE TABLE conversations (
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

CREATE UNIQUE INDEX conversations_owner_source_session_idx
  ON conversations(owner_user_id, source_app, source_session_id);

CREATE TABLE conversation_revisions (
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

CREATE UNIQUE INDEX conversation_revisions_conversation_revision_hash_idx
  ON conversation_revisions(conversation_id, source_revision_hash);

CREATE TABLE conversation_assets (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  meta_json TEXT
);

CREATE UNIQUE INDEX conversation_assets_revision_kind_idx
  ON conversation_assets(revision_id, kind);

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_revision_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  finalized_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE upload_session_assets (
  id TEXT PRIMARY KEY NOT NULL,
  upload_session_id TEXT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  content_type TEXT,
  uploaded_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX upload_session_assets_upload_kind_idx
  ON upload_session_assets(upload_session_id, kind);

CREATE TABLE session_digests (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  repository TEXT,
  digest_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX session_digests_conv_rev_idx
  ON session_digests(conversation_id, revision_id);

CREATE INDEX session_digests_owner_idx ON session_digests(owner_user_id);

CREATE INDEX session_digests_repo_idx ON session_digests(repository);

CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  profile_json TEXT NOT NULL,
  digest_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
