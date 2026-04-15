CREATE TABLE IF NOT EXISTS session_digests (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  digest_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_digests_conv_rev_idx
  ON session_digests(conversation_id, revision_id);

CREATE INDEX IF NOT EXISTS session_digests_owner_idx
  ON session_digests(owner_user_id);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  profile_json TEXT NOT NULL,
  digest_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
