-- migrations/0003_saved_filters.sql

CREATE TABLE IF NOT EXISTS saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  filter_config TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_sort_order ON saved_filters(sort_order);