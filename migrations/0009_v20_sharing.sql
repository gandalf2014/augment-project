-- Migration 0009: Notebook sharing (V2.0)
-- Create notebook_shares table for read-only sharing

CREATE TABLE IF NOT EXISTS notebook_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notebook_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  password TEXT,
  expires_at DATETIME,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON notebook_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_notebook ON notebook_shares(notebook_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON notebook_shares(owner_id);

-- Migration 0010: Version history trigger (V2.0)
-- Ensure memo_versions table exists and add version limit trigger

-- Recreate memo_versions table if not exists (from 0005)
CREATE TABLE IF NOT EXISTS memo_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  tags TEXT,
  version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_versions_memo ON memo_versions(memo_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON memo_versions(created_at DESC);

-- Trigger to limit versions to 10 per memo
CREATE TRIGGER IF NOT EXISTS limit_versions_trigger
AFTER INSERT ON memo_versions
WHEN (SELECT COUNT(*) FROM memo_versions WHERE memo_id = NEW.memo_id) > 10
BEGIN
  DELETE FROM memo_versions
  WHERE memo_id = NEW.memo_id
  AND id IN (
    SELECT id FROM memo_versions
    WHERE memo_id = NEW.memo_id
    ORDER BY created_at ASC
    LIMIT (SELECT COUNT(*) - 10 FROM memo_versions WHERE memo_id = NEW.memo_id)
  );
END;