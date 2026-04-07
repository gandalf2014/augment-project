-- Migration 0006: Admin system (fixed)
-- Create admin_logs table for audit trail
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_user_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);