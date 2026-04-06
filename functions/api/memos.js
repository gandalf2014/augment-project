import { generateTitleFromContent, ApiResponse } from '../_shared/utils.js';
import { MemoSchema, PaginationSchema, validateBody, validateQuery } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { env, request } = context;
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
    // Count query for pagination
    let countQuery = `SELECT COUNT(*) as total FROM memos WHERE 1=1`;
    const countParams = [];

    // Data query with pagination
    let dataQuery = `
      SELECT id, title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE 1=1
    `;
    const dataParams = [];

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
    dataQuery += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
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
  const url = new URL(request.url);

  // Validate input
  const validation = await validateBody(request, MemoSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { title, content, tags, is_favorite } = validation.data;
  const notebook_id = parseInt(url.searchParams.get('notebook_id')) || 1;

  try {
    // Generate title if not provided
    const finalTitle = title || generateTitleFromContent(content);

    // Insert the memo
    const insertResult = await env.DB.prepare(`
      INSERT INTO memos (title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).bind(finalTitle, content, tags, is_favorite, notebook_id).run();

    if (!insertResult.success) {
      throw new Error('Failed to insert memo');
    }

    // Get the inserted memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE id = ?
    `).bind(insertResult.meta.last_row_id).all();

    return ApiResponse.success(results[0], 201);
  } catch (error) {
    console.error('Error creating memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const url = new URL(request.url);

  // Get ID from params or URL
  let id = params?.id;
  if (!id) {
    const pathParts = url.pathname.split('/');
    id = pathParts[pathParts.length - 1];
  }

  // Validate ID
  if (!id || id === 'memos' || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  // Validate input
  const validation = await validateBody(request, MemoSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { title, content, tags, is_favorite } = validation.data;

  try {
    // Generate title if not provided
    const finalTitle = title || generateTitleFromContent(content);

    // Update the memo
    const updateResult = await env.DB.prepare(`
      UPDATE memos
      SET title = ?, content = ?, tags = ?, is_favorite = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(finalTitle, content, tags, is_favorite, id).run();

    if (!updateResult.success || updateResult.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    // Get the updated memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE id = ?
    `).bind(id).all();

    return ApiResponse.success(results[0]);
  } catch (error) {
    console.error('Error updating memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const url = new URL(request.url);

  // Get ID from params or URL
  let id = params?.id;
  if (!id) {
    const pathParts = url.pathname.split('/');
    id = pathParts[pathParts.length - 1];
  }

  // Validate ID
  if (!id || id === 'memos' || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await env.DB.prepare(`DELETE FROM memos WHERE id = ?`).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({
      message: 'Memo deleted successfully',
      deletedId: parseInt(id)
    });
  } catch (error) {
    console.error('Error deleting memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}