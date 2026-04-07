import { generateTitleFromContent, ApiResponse } from '../../_shared/utils.js';
import { MemoSchema, validateBody } from '../../_shared/validation.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Dynamic route for individual memo operations
export async function onRequestGet(context) {
  const { env, params, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const id = params.id;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).all();

    if (results.length === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success(results[0]);
  } catch (error) {
    console.error('Error fetching memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const id = params.id;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  // Validate input
  const validation = await validateBody(request, MemoSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { title, content, tags, is_favorite } = validation.data;

  try {
    // Verify memo belongs to user
    const existingMemo = await env.DB.prepare(
      'SELECT id FROM memos WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
    
    if (!existingMemo) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    // Generate title if not provided
    const finalTitle = title || generateTitleFromContent(content);

    // Update the memo
    const updateResult = await env.DB.prepare(`
      UPDATE memos
      SET title = ?, content = ?, tags = ?, is_favorite = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(finalTitle, content, tags, is_favorite, id, userId).run();

    if (!updateResult.success) {
      return ApiResponse.error('Failed to update memo', 500, 'DATABASE_ERROR');
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
  const { env, params, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const id = params.id;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    // Only delete if memo belongs to this user
    const result = await env.DB.prepare(
      'DELETE FROM memos WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();

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