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

  // Verify memo belongs to user
  const memoCheck = await env.DB.prepare(
    'SELECT id FROM memos WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();
  
  if (!memoCheck) {
    return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
  }

  // Get user's default notebook (first one)
  const defaultNotebook = await env.DB.prepare(
    'SELECT id FROM notebooks WHERE user_id = ? ORDER BY id ASC LIMIT 1'
  ).bind(userId).first();
  
  let notebook_id = defaultNotebook?.id || null;
  
  try {
    const body = await request.json();
    if (body.notebook_id) {
      const parsed = parseInt(body.notebook_id);
      if (!isNaN(parsed) && parsed > 0) {
        // Verify target notebook belongs to user
        const notebookCheck = await env.DB.prepare(
          'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
        ).bind(parsed, userId).first();
        
        if (notebookCheck) {
          notebook_id = parsed;
        }
      }
    }
  } catch {
    // Use default notebook
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE memos 
      SET is_archived = 0, notebook_id = ?, updated_at = datetime('now') 
      WHERE id = ? AND user_id = ?
    `).bind(notebook_id, id, userId).run();

    if (!result.success) {
      return ApiResponse.error('Failed to restore memo', 500, 'DATABASE_ERROR');
    }

    // Update notebook's updated_at if notebook exists
    if (notebook_id) {
      await env.DB.prepare(`
        UPDATE notebooks SET updated_at = datetime('now') WHERE id = ? AND user_id = ?
      `).bind(notebook_id, userId).run();
    }

    return ApiResponse.success({ id, is_archived: false, notebook_id });
  } catch (error) {
    console.error('Error restoring memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}