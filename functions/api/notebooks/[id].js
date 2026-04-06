import { ApiResponse } from '../../_shared/utils.js';
import { NotebookSchema, validateBody } from '../../_shared/validation.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  // Prevent modifying default notebook
  if (id === 1) {
    return ApiResponse.error('Cannot modify default notebook', 403, 'FORBIDDEN');
  }

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    const result = await env.DB.prepare(`
      UPDATE notebooks SET name = ?, icon = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(name, icon, id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
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
  const { env, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  // Prevent deleting default notebook
  if (id === 1) {
    return ApiResponse.error('Cannot delete default notebook', 403, 'FORBIDDEN');
  }

  try {
    // Move all memos to default notebook
    await env.DB.prepare(`
      UPDATE memos SET notebook_id = 1 WHERE notebook_id = ?
    `).bind(id).run();

    // Delete the notebook
    const result = await env.DB.prepare(`
      DELETE FROM notebooks WHERE id = ?
    `).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ message: 'Notebook deleted', id });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}