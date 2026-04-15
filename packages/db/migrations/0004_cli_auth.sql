CREATE TABLE IF NOT EXISTS cli_auth_grants (
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

CREATE UNIQUE INDEX IF NOT EXISTS cli_auth_grants_code_hash_idx
  ON cli_auth_grants(code_hash);
