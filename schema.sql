-- Bảng tin đã thu thập
CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT    NOT NULL UNIQUE,      -- đã chuẩn hoá, dùng để khử trùng lặp
  source_id     TEXT    NOT NULL,
  source_name   TEXT    NOT NULL,
  category      TEXT    NOT NULL,             -- dev-ai | trading | pkm
  title         TEXT    NOT NULL,
  snippet       TEXT,
  extra         TEXT,                         -- JSON: points, comments, discussion_url...
  published_at  INTEGER NOT NULL,             -- epoch ms
  fetched_at    INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'new', -- new | scored
  llm_attempts  INTEGER NOT NULL DEFAULT 0,
  score         INTEGER,                      -- 0..10
  tags          TEXT,                         -- JSON array
  summary       TEXT,                         -- tóm tắt tiếng Việt
  llm_provider  TEXT,
  user_action   TEXT,                         -- NULL | saved | dismissed
  acted_at      INTEGER,
  digested      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_pending ON items(status, llm_attempts, fetched_at);
CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_items_cat     ON items(category, fetched_at);
CREATE INDEX IF NOT EXISTS idx_items_action  ON items(user_action, acted_at);

-- Trạng thái từng nguồn
CREATE TABLE IF NOT EXISTS source_state (
  source_id       TEXT PRIMARY KEY,
  last_fetched_at INTEGER NOT NULL DEFAULT 0,
  last_status     TEXT,
  last_error      TEXT,
  last_added      INTEGER NOT NULL DEFAULT 0
);
