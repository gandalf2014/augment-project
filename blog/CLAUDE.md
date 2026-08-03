# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog system built on Cloudflare Workers + D1 database. Serverless architecture with server-side rendered frontend using Tailwind CSS.

## Commands

```bash
npm run dev          # Start local dev server (http://localhost:8787)
npm run deploy       # Deploy to Cloudflare Workers
npm run test         # Run tests with Vitest
npm run db:init      # Initialize D1 database (creates DB, runs migrations, seeds data)
npm run db:migrate   # Run schema migrations only
npm run db:seed      # Seed initial data only
npm run db:reset     # Reset database (migrate + seed)
```

Database queries (local):
```bash
npx wrangler d1 execute blog-db --local --command "SELECT * FROM posts"
npx wrangler d1 execute blog-db --local --file=some-file.sql
```

## Architecture

### Layer Structure
- **Routes** (`src/routes/`): HTTP handlers organized by domain (posts, categories, tags, comments, auth, admin, pages)
- **Services** (`src/services/`): Business logic and database operations, one service per domain
- **Middleware** (`src/middleware/`): CORS, logging, error handling, auth, body parsing
- **Utils** (`src/utils/`): Router, auth utilities, database helpers, HTML templates

### Custom Router
Uses a custom `Router` class (`src/utils/router.ts`) that supports:
- Express-like route registration (`.get()`, `.post()`, etc.)
- Parameter extraction (`:id` patterns)
- Middleware chains via `.use()` and per-route middleware
- Pattern: `router.get('/posts/:id', handler)` extracts `params.id`

### Request Body Access
Middleware parses JSON/form bodies and stores in `ctx.requestBody`. Access via `getRequestBody(ctx)` from middleware module.

### Authentication
- JWT-based auth using PBKDF2 password hashing
- `authMiddleware` validates token and adds `request.user` with payload
- `optionalAuthMiddleware` allows unauthenticated access
- Tokens are ONLY accepted via `Authorization: Bearer <token>` header; URL `?token=` is disabled (leaks via logs/history/Referer)
- Login is rate-limited per IP (5/min, KV-backed); comment submission 20/min
- `JWT_SECRET` is a secret binding (`{JWT_SECRET}` placeholder in wrangler.jsonc); local dev uses `.dev.vars`, tests inject a fixed value in vitest.config.mts
- CORS is same-origin only unless `ALLOWED_ORIGINS` whitelist is set

### Database (D1)
- Tables: users, categories, tags, posts, post_tags, comments, settings, pages
- SQLite triggers auto-update `updated_at`, `usage_count`, and `comment_count`
- All services receive `D1Database` in constructor

### Type System
- Entity types in `src/types/database.ts` (User, Post, Category, Tag, Comment, etc.)
- Extended types: `PostWithDetails` includes category, author, tags
- `Env` interface defines `DB: D1Database` and `JWT_SECRET: string`

## Route Registration Order

Page routes (`registerPageRoutes`) and admin routes (`registerAdminRoutes`) must be registered before API routes to avoid being overridden by API patterns.

## Frontend

Server-side rendered HTML using template functions in `src/utils/templates.ts`. Admin panel at `/admin` with default credentials: admin@example.com / password.