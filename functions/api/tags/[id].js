import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const { id } = params;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid tag ID', 400, 'VALIDATION_ERROR');
  }

  try {
    // Only delete if tag belongs to this user
    const result = await env.DB.prepare(
      'DELETE FROM tags WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Tag not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}