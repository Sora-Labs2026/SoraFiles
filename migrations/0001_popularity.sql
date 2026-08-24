CREATE TABLE IF NOT EXISTS tool_usage_daily (
  day TEXT NOT NULL,
  tool TEXT NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  PRIMARY KEY (day, tool)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS tool_usage_daily_day_idx ON tool_usage_daily(day);

CREATE TABLE IF NOT EXISTS popularity_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;
