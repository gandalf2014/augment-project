-- Migration 0006: Admin system
-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Add user metadata columns
ALTER TABLE users ADD COLUMN username TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;

-- Create admin_logs table for audit trail
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,           -- 'create_user', 'delete_user', 'update_user', 'set_admin'
    target_user_id INTEGER,         -- NULL for non-user actions
    details TEXT,                   -- JSON details of the action
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES users(id),
    FOREIGN KEY (target_user_id) REFERENCES users(id)
);