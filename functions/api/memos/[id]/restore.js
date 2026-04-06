import { ApiResponse } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  let notebook_id = 1;
  try {
    const body = await request.json();
    if (body.notebook_id) {
      notebook_id = parseInt(body.notebook_id);
    }
  } catch {
    // Use default notebook
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE memos 
      SET is_archived = 0, notebook_id = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).bind(notebook_id, id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    // Update notebook's updated_at
    await env.DB.prepare(`
      UPDATE notebooks SET updated_at = datetime('now') WHERE id = ?
    `).bind(notebook_id).run();

    return ApiResponse.success({ id, is_archived: false, notebook_id });
  } catch (error) {
    console.error('Error restoring memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}