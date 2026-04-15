CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_token_hash_idx
  ON api_tokens(token_hash);
