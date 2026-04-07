import { ApiResponse } from '../../_shared/utils.js';
import { NotebookSchema, validateBody } from '../../_shared/validation.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    // Verify notebook belongs to user
    const existing = await env.DB.prepare(
      'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
    
    if (!existing) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    const result = await env.DB.prepare(`
      UPDATE notebooks SET name = ?, icon = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?
    `).bind(name, icon, id, userId).run();

    if (!result.success) {
      return ApiResponse.error('Failed to update notebook', 500, 'DATABASE_ERROR');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, name, icon, created_at, updated_at FROM notebooks WHERE id = ?
    `).bind(id).all();

    return ApiResponse.success(results[0]);
  } catch (error) {
    console.error('Error updating notebook:', error);
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
  
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  try {
    // Verify notebook belongs to user
    const existing = await env.DB.prepare(
      'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
    
    if (!existing) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    // Get user's first notebook (default) to move memos
    const defaultNotebook = await env.DB.prepare(
      'SELECT id FROM notebooks WHERE user_id = ? ORDER BY id ASC LIMIT 1'
    ).bind(userId).first();
    
    // If deleting the default notebook, don't allow if there are other notebooks
    if (defaultNotebook?.id === id) {
      const otherNotebooks = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM notebooks WHERE user_id = ? AND id != ?'
      ).bind(userId, id).first();
      
      if (otherNotebooks.count === 0) {
        // This is the only notebook - don't delete it
        return ApiResponse.error('无法删除唯一的笔记本', 400, 'CANNOT_DELETE_LAST_NOTEBOOK');
      }
    }
    
    // Move all memos to default notebook
    if (defaultNotebook && defaultNotebook.id !== id) {
      await env.DB.prepare(`
        UPDATE memos SET notebook_id = ? WHERE notebook_id = ? AND user_id = ?
      `).bind(defaultNotebook.id, id, userId).run();
    }

    // Delete the notebook
    const result = await env.DB.prepare(`
      DELETE FROM notebooks WHERE id = ? AND user_id = ?
    `).bind(id, userId).run();

    if (!result.success) {
      return ApiResponse.error('Failed to delete notebook', 500, 'DATABASE_ERROR');
    }

    return ApiResponse.success({ message: 'Notebook deleted', id });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}