ALTER TABLE signals_scored
  ADD COLUMN IF NOT EXISTS run_ref TEXT;

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS run_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_signals_scored_run_ref ON signals_scored (run_ref);
CREATE INDEX IF NOT EXISTS idx_decisions_run_ref ON decisions (run_ref);
