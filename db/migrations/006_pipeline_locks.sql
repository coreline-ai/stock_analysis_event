CREATE TABLE IF NOT EXISTS pipeline_locks (
  lock_key TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_locks_expires_at ON pipeline_locks (expires_at);
