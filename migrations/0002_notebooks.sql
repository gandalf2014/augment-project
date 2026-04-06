-- Create notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add notebook_id and is_archived to memos
ALTER TABLE memos ADD COLUMN notebook_id INTEGER REFERENCES notebooks(id) DEFAULT 1;
ALTER TABLE memos ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_memos_notebook_id ON memos(notebook_id);
CREATE INDEX IF NOT EXISTS idx_memos_is_archived ON memos(is_archived);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON notebooks(updated_at DESC);

-- Insert default notebook
INSERT INTO notebooks (id, name, icon, sort_order) VALUES
    (1, '未分类', '📁', 0);

-- Update existing memos to belong to default notebook
UPDATE memos SET notebook_id = 1 WHERE notebook_id IS NULL;