CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_revision_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  finalized_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_session_assets (
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

CREATE UNIQUE INDEX IF NOT EXISTS upload_session_assets_upload_kind_idx
  ON upload_session_assets(upload_session_id, kind);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_owner_source_session_idx
  ON conversations(owner_user_id, source_app, source_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_revisions_conversation_revision_hash_idx
  ON conversation_revisions(conversation_id, source_revision_hash);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_assets_revision_kind_idx
  ON conversation_assets(revision_id, kind);
