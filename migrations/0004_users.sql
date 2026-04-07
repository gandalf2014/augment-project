-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password_hash TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast password hash lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash);

-- Add user_id to all existing tables
ALTER TABLE memos ADD COLUMN user_id INTEGER DEFAULT NULL;
ALTER TABLE tags ADD COLUMN user_id INTEGER DEFAULT NULL;
ALTER TABLE notebooks ADD COLUMN user_id INTEGER DEFAULT NULL;
ALTER TABLE saved_filters ADD COLUMN user_id INTEGER DEFAULT NULL;

-- Create indexes for user_id
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);

-- Update unique constraint on tags to be per-user
-- SQLite doesn't support altering constraints, so we handle this at application level
-- Tags uniqueness is now: (name, user_id) combination