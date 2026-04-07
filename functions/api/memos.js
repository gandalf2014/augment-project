import { generateTitleFromContent, ApiResponse } from '../_shared/utils.js';
import { MemoSchema, PaginationSchema, validateBody, validateQuery } from '../_shared/validation.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const tag = url.searchParams.get('tag') || '';
  const favorite = url.searchParams.get('favorite') === 'true';
  const notebook = url.searchParams.get('notebook') || 'all';
  const archived = url.searchParams.get('archived') === 'true';

  // Validate pagination parameters
  const paginationResult = validateQuery(url.searchParams, PaginationSchema);
  if (!paginationResult.success) {
    return ApiResponse.error(paginationResult.error, 400, 'VALIDATION_ERROR');
  }
  const { page, limit } = paginationResult.data;
  const offset = (page - 1) * limit;

  try {
    // Count query for pagination - filter by user
    let countQuery = `SELECT COUNT(*) as total FROM memos WHERE user_id = ?`;
    const countParams = [userId];

    // Data query with pagination - filter by user
    let dataQuery = `
      SELECT id, title, content, tags, is_favorite, is_pinned, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE user_id = ?
    `;
    const dataParams = [userId];

    if (search) {
      countQuery += ` AND (title LIKE ? OR content LIKE ?)`;
      dataQuery += ` AND (title LIKE ? OR content LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
      dataParams.push(`%${search}%`, `%${search}%`);
    }

    if (tag) {
      countQuery += ` AND tags LIKE ?`;
      dataQuery += ` AND tags LIKE ?`;
      countParams.push(`%${tag}%`);
      dataParams.push(`%${tag}%`);
    }

    if (favorite) {
      countQuery += ` AND is_favorite = 1`;
      dataQuery += ` AND is_favorite = 1`;
    }

    // Notebook filter
    const notebookId = parseInt(notebook);
    if (notebook && notebook !== 'all' && !isNaN(notebookId)) {
      countQuery += ` AND notebook_id = ?`;
      dataQuery += ` AND notebook_id = ?`;
      countParams.push(notebookId);
      dataParams.push(notebookId);
    }

    // Archive filter (default: exclude archived)
    if (!archived) {
      countQuery += ` AND is_archived = 0`;
      dataQuery += ` AND is_archived = 0`;
    }

    // Get total count
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total || 0;

    // Get paginated data
    // Order: pinned first, then by updated_at DESC
    dataQuery += ` ORDER BY is_pinned DESC, updated_at DESC LIMIT ? OFFSET ?`;
    dataParams.push(limit, offset);

    const { results } = await env.DB.prepare(dataQuery).bind(...dataParams).all();

    return ApiResponse.success({
      memos: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + results.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching memos:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const url = new URL(request.url);

  // Validate input
  const validation = await validateBody(request, MemoSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { title, content, tags, is_favorite } = validation.data;
  const body = validation.data;
  const is_pinned = body.is_pinned ? 1 : 0;
  let notebook_id = parseInt(url.searchParams.get('notebook_id')) || null;

  try {
    // Generate title if not provided
    const finalTitle = title || generateTitleFromContent(content);

    // Verify notebook belongs to user
    if (notebook_id) {
      const notebook = await env.DB.prepare(
        'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
      ).bind(notebook_id, userId).first();
      
      if (!notebook) {
        // Use user's default notebook (first notebook) instead
        const defaultNotebook = await env.DB.prepare(
          'SELECT id FROM notebooks WHERE user_id = ? ORDER BY id ASC LIMIT 1'
        ).bind(userId).first();
        notebook_id = defaultNotebook?.id || null;
      }
    } else {
      // Get user's default notebook
      const defaultNotebook = await env.DB.prepare(
        'SELECT id FROM notebooks WHERE user_id = ? ORDER BY id ASC LIMIT 1'
      ).bind(userId).first();
      notebook_id = defaultNotebook?.id || null;
    }

    // Insert the memo with user_id
    const insertResult = await env.DB.prepare(`
      INSERT INTO memos (title, content, tags, is_favorite, is_pinned, notebook_id, is_archived, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
    `).bind(finalTitle, content, tags, is_favorite, is_pinned, notebook_id, userId).run();

    if (!insertResult.success) {
      throw new Error('Failed to insert memo');
    }

    // Get the inserted memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, is_pinned, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE id = ?
    `).bind(insertResult.meta.last_row_id).all();

    return ApiResponse.success(results[0], 201);
  } catch (error) {
    console.error('Error creating memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}