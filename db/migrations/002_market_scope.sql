ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS market_scope TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS strategy_key TEXT NOT NULL DEFAULT 'us_default';

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS market_scope TEXT NOT NULL DEFAULT 'US';

ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS market_scope TEXT NOT NULL DEFAULT 'US';

ALTER TABLE daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_report_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_date_scope_unique
  ON daily_reports (report_date, market_scope);
