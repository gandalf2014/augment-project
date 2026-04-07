import { ApiResponse } from '../../../_shared/utils.js';
import { getUserIdFromRequest } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  const { env, params, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    // Only archive if memo belongs to this user
    const result = await env.DB.prepare(`
      UPDATE memos SET is_archived = 1, updated_at = datetime('now') 
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ id, is_archived: true });
  } catch (error) {
    console.error('Error archiving memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}