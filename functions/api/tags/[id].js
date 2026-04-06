import { ApiResponse } from '../../_shared/utils.js';

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { id } = params;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return ApiResponse.error('Invalid tag ID', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await env.DB.prepare(`DELETE FROM tags WHERE id = ?`).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Tag not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}