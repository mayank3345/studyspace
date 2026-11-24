-- Apply this to an existing database created from the earlier starter schema.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
