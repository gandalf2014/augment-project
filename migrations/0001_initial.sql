-- Create memos table
CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_favorite ON memos(is_favorite);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Insert some default tags
INSERT OR IGNORE INTO tags (name, color) VALUES
    ('Work', '#ef4444'),
    ('Personal', '#10b981'),
    ('Ideas', '#f59e0b'),
    ('Important', '#8b5cf6'),
    ('Todo', '#06b6d4'),
    ('Markdown', '#6366f1');

-- Insert sample memos
INSERT OR IGNORE INTO memos (title, content, tags, is_favorite) VALUES
    ('Welcome to Markdown Support! 🎉',
     '# Welcome to Your Memo App!

This memo demonstrates the **Markdown support** that has been added to your memo application.

## Features

- **Bold text** with `**bold**`
- *Italic text* with `*italic*`
- `Inline code` with backticks
- [Links](https://example.com) with `[text](url)`

### Lists

You can create:
1. Numbered lists
2. With multiple items
3. Like this one

Or bullet lists:
- First item
- Second item
- Third item

### Code Blocks

```javascript
function parseMarkdown(text) {
  // Your markdown parsing logic here
  return html;
}
```

### Quotes

> This is a blockquote. Perfect for highlighting important information or quotes from other sources.

---

## Keyboard Shortcuts

- **Ctrl+B**: Make text bold
- **Ctrl+I**: Make text italic
- **Ctrl+K**: Insert link
- **Tab**: Indent text

Try editing this memo to see the live preview feature!',
     'Markdown, Welcome, Tutorial',
     true),
    ('This is an example of a very long title that might overflow the card layout and cause display issues',
     'This memo demonstrates how long titles are handled in the card layout. The title should be truncated with ellipsis (...) when it becomes too long to fit in the available space.

You can hover over the title to see the full text in a tooltip.',
     'UI, Testing, Long Title',
     false),
    ('',
     'This memo has no title, so the system will automatically generate one from the content. This is useful for quick notes where you don''t want to think of a title.

The auto-generated title will be based on the first meaningful sentence or line of the content, with markdown formatting removed.',
     'Auto-generated, No Title',
     false);
