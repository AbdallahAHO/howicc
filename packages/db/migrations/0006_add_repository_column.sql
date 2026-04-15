ALTER TABLE session_digests ADD COLUMN repository TEXT;

CREATE INDEX IF NOT EXISTS session_digests_repo_idx
  ON session_digests(repository);
