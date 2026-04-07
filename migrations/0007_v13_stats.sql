-- Migration 0007: V1.3 Statistics and enhancements
-- Add tag hierarchy, activity tracking, and statistics support

-- Add parent_id to tags for hierarchy support
ALTER TABLE tags ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES tags(id) ON DELETE SET NULL;

-- User activity tracking (daily stats)
CREATE TABLE IF NOT EXISTS user_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  activity_date DATE NOT NULL,
  memos_created INTEGER DEFAULT 0,
  memos_edited INTEGER DEFAULT 0,
  memos_deleted INTEGER DEFAULT 0,
  memos_viewed INTEGER DEFAULT 0,
  searches_performed INTEGER DEFAULT 0,
  session_duration_minutes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, activity_date)
);

-- Tag usage tracking
CREATE TABLE IF NOT EXISTS tag_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tag_id, user_id)
);

-- QR codes for sharing
CREATE TABLE IF NOT EXISTS share_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id INTEGER NOT NULL,
  qr_image TEXT,  -- Base64 encoded QR image
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_id) REFERENCES shared_memos(id) ON DELETE CASCADE
);

-- Social share tracking
CREATE TABLE IF NOT EXISTS social_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,  -- wechat, twitter, facebook, etc.
  shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for statistics
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON user_activity(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_tag_usage_user ON tag_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_tag_usage_count ON tag_usage(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_memo ON social_shares(memo_id);