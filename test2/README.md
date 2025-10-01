# 📝 Memo App

A beautiful and powerful memo application built with Cloudflare Pages and D1 database. Create, organize, and manage your notes with an elegant interface and powerful features.

## ✨ Features

- **Beautiful UI**: Modern, responsive design with dark theme by default and light theme option
- **Adaptive Layout**: Intelligent grid system that adapts to any screen size
- **Consistent Cards**: Uniform card widths across all screen sizes
- **Mobile Optimized**: Fully responsive layout with touch-friendly controls
- **Markdown Support**: Full Markdown syntax support with live preview
- **Rich Text Editor**: Toolbar with formatting buttons and keyboard shortcuts
- **Smart Titles**: Optional titles with auto-generation from content
- **Full Content Display**: View complete memo content in cards without truncation
- **Modal Editing**: Clean modal interface for editing memos
- **Tag System**: Organize memos with colorful tags
- **Search & Filter**: Powerful search and filtering capabilities
- **Favorites**: Mark important memos as favorites
- **Export**: Export all your memos as JSON
- **Keyboard Shortcuts**: Efficient navigation and formatting shortcuts
- **Offline Support**: Basic offline functionality with Service Worker
- **Cross-Platform**: Works perfectly on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or later)
- Cloudflare account
- Wrangler CLI installed globally

### Installation

1. **Clone and setup**:
   ```bash
   git clone <your-repo-url>
   cd memo-app
   npm install
   ```

2. **Create D1 database**:
   ```bash
   npx wrangler d1 create memo-db
   ```

3. **Update wrangler.toml**:
   - Copy the database ID from the previous command
   - Replace `your-database-id` in `wrangler.toml` with your actual database ID

4. **Run migrations**:
   ```bash
   npx wrangler d1 migrations apply memo-db --local
   npx wrangler d1 migrations apply memo-db
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Deploy to production**:
   ```bash
   npm run deploy
   ```

## 🎯 Usage

### Keyboard Shortcuts

**General:**
- `Ctrl/Cmd + N`: Create new memo
- `Ctrl/Cmd + F`: Focus search
- `Ctrl/Cmd + E`: Export memos
- `Escape`: Close modals

**Markdown Editing:**
- `Ctrl/Cmd + B`: Bold text
- `Ctrl/Cmd + I`: Italic text
- `Ctrl/Cmd + K`: Insert link
- `Tab`: Indent text

### Creating Memos

1. Click "New Memo" or use `Ctrl/Cmd + N`
2. Enter title (optional) and content (with Markdown support)
   - If no title is provided, one will be auto-generated from the content
   - Long titles are automatically truncated with ellipsis in card view
3. Use the toolbar buttons or keyboard shortcuts for formatting
4. Switch to "Preview" tab to see rendered Markdown
5. Add tags (comma-separated)
6. Mark as favorite if needed
7. Save

### Viewing and Editing Memos

- **Full Content Display**: Memo cards show the complete content with full Markdown rendering
- **Edit Button**: Click the ✏️ edit button to open the memo in a modal for editing
- **Favorite Toggle**: Click the ⭐/☆ button to mark/unmark as favorite
- **Delete**: Click the 🗑️ button to delete the memo
- **Mobile Friendly**: All buttons are optimized for touch interaction on mobile devices

### Markdown Support

The editor supports full Markdown syntax including:

- **Headers**: `# H1`, `## H2`, `### H3`
- **Emphasis**: `**bold**`, `*italic*`
- **Code**: `` `inline code` ``, ``` code blocks ```
- **Links**: `[text](url)`
- **Images**: `![alt](url)`
- **Lists**: `- item` or `1. item`
- **Quotes**: `> quote`
- **Horizontal rules**: `---`

Use the toolbar buttons or keyboard shortcuts for quick formatting!

### Managing Tags

1. Click "New Tag" in the sidebar
2. Choose a name and color
3. Use tags to organize your memos
4. Click on tags in the sidebar to filter

### Search and Filter

- Use the search bar to find memos by title or content
- Filter by specific tags using the dropdown
- Toggle favorites filter to see only starred memos

## 🏗️ Architecture

### Frontend
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern styling with CSS Grid, Flexbox, and custom properties
- **Vanilla JavaScript**: No framework dependencies for fast loading
- **Service Worker**: Basic offline support

### Backend
- **Cloudflare Pages Functions**: Serverless API endpoints
- **Cloudflare D1**: SQLite-compatible database
- **RESTful API**: Clean API design for memo and tag operations

### Database Schema

```sql
-- Memos table
CREATE TABLE memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 API Endpoints

### Memos
- `GET /api/memos` - Get all memos (with optional search, tag, favorite filters)
- `POST /api/memos` - Create new memo
- `PUT /api/memos/:id` - Update memo
- `DELETE /api/memos/:id` - Delete memo
- `GET /api/memos/:id` - Get specific memo

### Tags
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create new tag
- `DELETE /api/tags/:id` - Delete tag

## 🐛 Troubleshooting

### Delete Function Issues

If you encounter "Failed to delete memo" errors:

1. **Check Browser Console**: Open Developer Tools (F12) and look for error messages
2. **Use Debug Tool**: Open `debug-delete.html` in your browser to test the delete function
3. **Check Database**: Run the deployment check script:
   ```bash
   # Linux/Mac
   ./check-deployment.sh

   # Windows
   check-deployment.bat
   ```
4. **Verify Database Structure**: Ensure migrations have been applied:
   ```bash
   wrangler d1 migrations apply memo-db
   ```

### Common Issues

**Problem**: API endpoints return 404
**Solution**: Ensure you've deployed the latest version with `wrangler pages deploy public`

**Problem**: Database errors
**Solution**: Run migrations and check database structure:
```bash
wrangler d1 migrations apply memo-db
wrangler d1 execute memo-db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**Problem**: Functions not working
**Solution**: Check Cloudflare Pages Functions logs in the dashboard

## 🎨 Customization

### Themes
The app defaults to dark theme for better eye comfort, with an optional light theme. Theme preference is saved in localStorage.

- **Default**: Dark theme (night mode)
- **Alternative**: Light theme (day mode)
- **Toggle**: Click the theme button in the header (☀️/🌙)
- **Persistence**: Your theme choice is remembered across sessions

### Colors
Customize the color scheme by modifying CSS custom properties in `style.css`:

```css
:root {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  /* ... more colors */
}
```

### Adding Features
The modular architecture makes it easy to add new features:

1. Add new API endpoints in the `functions/api/` directory
2. Update the frontend JavaScript to use new endpoints
3. Add new UI components as needed

## 📱 Progressive Web App

The app includes basic PWA features:
- Service Worker for offline support
- Responsive design for mobile devices
- Fast loading with minimal dependencies

## 🔒 Security

- Input validation and sanitization
- SQL injection protection with prepared statements
- XSS prevention with proper HTML escaping
- CORS headers for API security

## 🚀 Performance

- Minimal JavaScript bundle size
- CSS Grid and Flexbox for efficient layouts
- Optimized database queries with indexes
- Cloudflare's global CDN for fast delivery

## 📐 Responsive Design

The application features a sophisticated responsive grid system:

### Desktop Breakpoints
- **Extra Large (≥1600px)**: 4-5 columns, 380px min card width
- **Large (1400-1599px)**: 3-4 columns, 350px min card width
- **Medium (1200-1399px)**: 3 columns, 320px min card width
- **Small Desktop (992-1199px)**: 2-3 columns, 300px min card width
- **Tablet (769-991px)**: 2 columns, 280px min card width

### Mobile Breakpoints
- **Tablet (≤768px)**: Single column layout
- **Mobile (≤480px)**: Optimized spacing and larger touch targets

### Key Features
- **Consistent Card Widths**: All cards maintain uniform width within each breakpoint
- **No Horizontal Overflow**: Content never exceeds screen boundaries
- **Adaptive Spacing**: Gaps and padding adjust based on screen size
- **Flexible Content**: Cards expand vertically to accommodate content

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Cloudflare Pages and D1
