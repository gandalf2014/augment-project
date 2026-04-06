# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A memo/notes application built with Cloudflare Pages and D1 database. Features Markdown support, tags, favorites, search/filter, theme switching, pagination, and auto-save drafts.

## Commands

```bash
# Start local development server
npm run dev

# Deploy to Cloudflare Pages
npm run deploy

# Apply database migrations
npm run db:migrate

# Create new D1 database
npm run db:create
```

## Architecture

### Frontend (public/)
- `index.html` - Single-page app structure with modals for memo/tag editing
- `script.js` - Client-side logic: Markdown parsing, API calls, state management, pagination, auto-save
- `style.css` - Styling with dark/light theme support
- `sw.js` - Service worker for offline capability

### Backend (functions/)
- `api/memos.js` - GET (paginated list), POST (create), PUT (update), DELETE operations
- `api/memos/[id].js` - Individual memo operations by ID
- `api/tags.js` - Tag CRUD operations
- `_shared/utils.js` - Shared utilities: `generateTitleFromContent()`, `ApiResponse` class
- `_shared/validation.js` - Zod schemas for input validation: `MemoSchema`, `TagSchema`, `PaginationSchema`

### Database (migrations/)
D1 (SQLite) schema with two tables:
- `memos` - id, title, content, tags, is_favorite, created_at, updated_at
- `tags` - id, name (unique), color, created_at

## Key Patterns

**API Response Format**: Standardized JSON responses using `ApiResponse` class:
```javascript
// Success: { success: true, data: {...} }
// Error: { success: false, error: { code: "...", message: "..." } }
```

**Input Validation**: All API endpoints use Zod schemas via `validateBody()` and `validateQuery()`:
```javascript
const validation = await validateBody(request, MemoSchema);
if (!validation.success) {
  return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
}
```

**Pagination**: API supports `page` and `limit` query params; client uses infinite scroll.

**Auto-save**: Client saves drafts to localStorage with 1s debounce; restores on modal open.

**Dynamic Routes**: Cloudflare Pages Functions use file-based routing. `[id].js` captures URL parameters via `context.params.id`.

## Configuration

- `wrangler.toml` - Cloudflare configuration with D1 database binding
- Database binding name: `DB`
- Database name: `memo-db`

## Development Notes

- The app defaults to dark theme; toggle stored in localStorage
- Auto-generates memo titles from content if left empty
- Tags are comma-separated strings stored in memos.tags column
- Drafts expire after 24 hours in localStorage
- Default pagination: 20 items per page, max 100