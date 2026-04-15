PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS verifications;
DROP INDEX IF EXISTS users_email_idx;

ALTER TABLE users RENAME TO users_legacy;

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

INSERT INTO users (
  id,
  github_user_id,
  email,
  email_verified,
  name,
  image,
  created_at,
  updated_at
)
SELECT
  id,
  github_user_id,
  COALESCE(email, id || '@placeholder.local'),
  COALESCE(email_verified, 0),
  COALESCE(name, email, id),
  image,
  created_at,
  updated_at
FROM users_legacy;

DROP TABLE users_legacy;

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

PRAGMA foreign_keys = ON;
