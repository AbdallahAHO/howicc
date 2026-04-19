-- 0003: public profile + repo admin surfaces
--
-- App is not live yet; this migration wipes all rows before altering the
-- schema so we can add NOT NULL columns (username, etc.) without a backfill
-- script. On first sign-in after migration, Better Auth captures the GitHub
-- login and writes it to users.username — GitHub stays the source of truth.

-- ─── 1. Clear all existing rows in dependency order ────────────────────────
DELETE FROM session_digests;
DELETE FROM conversation_assets;
DELETE FROM conversation_revisions;
DELETE FROM conversations;
DELETE FROM user_profiles;
DELETE FROM upload_session_assets;
DELETE FROM upload_sessions;
DELETE FROM api_tokens;
DELETE FROM cli_auth_grants;
DELETE FROM verifications;
DELETE FROM sessions;
DELETE FROM accounts;
DELETE FROM users;

-- ─── 2. Extend users with public-profile fields ────────────────────────────
ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN website_url TEXT;
ALTER TABLE users ADD COLUMN public_profile_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN public_profile_settings TEXT;
ALTER TABLE users ADD COLUMN profile_view_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX users_username_idx ON users(username);

-- ─── 3. Repository admin tables ────────────────────────────────────────────
CREATE TABLE repos (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  updated_by_user_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX repos_owner_name_idx ON repos(owner, name);

CREATE TABLE repo_hidden_conversations (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  hidden_by_user_id TEXT NOT NULL,
  hidden_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX repo_hidden_owner_name_conv_idx
  ON repo_hidden_conversations(owner, name, conversation_id);
CREATE INDEX repo_hidden_conv_idx
  ON repo_hidden_conversations(conversation_id);

CREATE TABLE repo_admin_consents (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consented_at INTEGER NOT NULL,
  visibility_at_consent TEXT NOT NULL
);

CREATE UNIQUE INDEX repo_admin_consents_owner_name_user_idx
  ON repo_admin_consents(owner, name, user_id);

CREATE TABLE repo_permissions (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX repo_permissions_owner_name_user_idx
  ON repo_permissions(owner, name, user_id);

-- ─── 4. View-tracking tables ───────────────────────────────────────────────
CREATE TABLE conversation_views (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  day TEXT NOT NULL
);

CREATE INDEX conversation_views_conversation_idx
  ON conversation_views(conversation_id);
CREATE INDEX conversation_views_conv_key_day_idx
  ON conversation_views(conversation_id, viewer_key, day);

CREATE TABLE profile_views (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  day TEXT NOT NULL
);

CREATE INDEX profile_views_user_idx ON profile_views(user_id);
CREATE INDEX profile_views_user_key_day_idx
  ON profile_views(user_id, viewer_key, day);
