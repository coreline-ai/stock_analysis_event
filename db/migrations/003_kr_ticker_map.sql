CREATE TABLE IF NOT EXISTS kr_ticker_map (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'KRX',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kr_ticker_map_name ON kr_ticker_map (name);
