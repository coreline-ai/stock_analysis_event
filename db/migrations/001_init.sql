CREATE TABLE IF NOT EXISTS signals_raw (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  symbol_candidates TEXT[] NOT NULL DEFAULT '{}',
  title TEXT,
  body TEXT,
  url TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL,
  engagement JSONB,
  raw_payload JSONB,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_raw_collected_at ON signals_raw (collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_raw_published_at ON signals_raw (published_at DESC);

CREATE TABLE IF NOT EXISTS signals_scored (
  id BIGSERIAL PRIMARY KEY,
  raw_id BIGINT NOT NULL REFERENCES signals_raw(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  sentiment_score DOUBLE PRECISION NOT NULL,
  freshness_score DOUBLE PRECISION NOT NULL,
  source_weight DOUBLE PRECISION NOT NULL,
  final_score DOUBLE PRECISION NOT NULL,
  reason_summary TEXT,
  scored_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_scored_symbol ON signals_scored (symbol);
CREATE INDEX IF NOT EXISTS idx_signals_scored_score ON signals_scored (final_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_scored_scored_at ON signals_scored (scored_at DESC);

CREATE TABLE IF NOT EXISTS decisions (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  verdict TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  time_horizon TEXT NOT NULL,
  thesis_summary TEXT NOT NULL,
  entry_trigger TEXT NOT NULL,
  invalidation TEXT NOT NULL,
  risk_notes TEXT[] NOT NULL,
  bull_case TEXT[] NOT NULL,
  bear_case TEXT[] NOT NULL,
  red_flags TEXT[] NOT NULL,
  catalysts TEXT[] NOT NULL,
  sources_used BIGINT[] NOT NULL,
  llm_model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_verdict ON decisions (verdict);
CREATE INDEX IF NOT EXISTS idx_decisions_symbol ON decisions (symbol);

CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  summary_markdown TEXT NOT NULL,
  top_buy_now BIGINT[] NOT NULL,
  top_watch BIGINT[] NOT NULL,
  themes TEXT[] NOT NULL,
  risks TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports (report_date DESC);

CREATE TABLE IF NOT EXISTS agent_runs (
  id BIGSERIAL PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  gathered_counts JSONB,
  scored_count INTEGER,
  decided_count INTEGER,
  llm_calls INTEGER,
  llm_tokens_estimated INTEGER,
  stage_timings JSONB,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs (status);
