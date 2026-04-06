import { ApiResponse } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE memos SET is_archived = 1, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ id, is_archived: true });
  } catch (error) {
    console.error('Error archiving memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}