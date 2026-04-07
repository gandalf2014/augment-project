import { ApiResponse } from '../_shared/utils.js';
import { NotebookSchema, validateBody } from '../_shared/validation.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }

  try {
    // Get notebooks with memo counts for this user only
    const { results } = await env.DB.prepare(`
      SELECT 
        n.id, 
        n.name, 
        n.icon, 
        n.created_at, 
        n.updated_at,
        COUNT(CASE WHEN m.is_archived = 0 THEN 1 END) as memo_count
      FROM notebooks n
      LEFT JOIN memos m ON n.id = m.notebook_id AND m.user_id = ?
      WHERE n.user_id = ?
      GROUP BY n.id
      ORDER BY n.id ASC, n.updated_at DESC
    `).bind(userId, userId).all();

    // Mark first notebook as default
    const notebooks = results.map((n, index) => ({
      ...n,
      is_default: index === 0,
      memo_count: n.memo_count || 0
    }));

    return ApiResponse.success(notebooks);
  } catch (error) {
    console.error('Error fetching notebooks:', error);
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

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    const result = await env.DB.prepare(`
      INSERT INTO notebooks (name, icon, user_id, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind(name, icon, userId).run();

    if (!result.success) {
      throw new Error('Failed to create notebook');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, name, icon, created_at, updated_at FROM notebooks WHERE id = ?
    `).bind(result.meta.last_row_id).all();

    return ApiResponse.success({ ...results[0], memo_count: 0, is_default: false }, 201);
  } catch (error) {
    console.error('Error creating notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}