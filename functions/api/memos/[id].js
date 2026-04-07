import { generateTitleFromContent, ApiResponse } from '../../_shared/utils.js';
import { MemoSchema, PartialMemoSchema } from '../../_shared/validation.js';
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
      SELECT id, title, content, tags, is_favorite, is_pinned, notebook_id, is_archived, created_at, updated_at
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

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, 'VALIDATION_ERROR');
  }
  
  // Check if this is a partial update (only pin/favorite/archive)
  const isPartialUpdate = body.is_pinned !== undefined || body.is_archived !== undefined || body.is_favorite !== undefined;
  
  // Validate with appropriate schema
  const schema = isPartialUpdate ? PartialMemoSchema : MemoSchema;
  const result = schema.safeParse(body);
  
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
    return ApiResponse.error(errors.join('; '), 400, 'VALIDATION_ERROR');
  }
  
  const validatedData = result.data;

  try {
    // Verify memo belongs to user
    const existingMemo = await env.DB.prepare(
      'SELECT id FROM memos WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();
    
    if (!existingMemo) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    let updateResult;
    
    if (isPartialUpdate) {
      // Partial update - only update specific fields
      const updates = [];
      const values = [];
      
      if (validatedData.is_pinned !== undefined) {
        updates.push('is_pinned = ?');
        values.push(validatedData.is_pinned ? 1 : 0);
      }
      
      if (validatedData.is_archived !== undefined) {
        updates.push('is_archived = ?');
        values.push(validatedData.is_archived ? 1 : 0);
      }
      
      if (validatedData.is_favorite !== undefined) {
        updates.push('is_favorite = ?');
        values.push(validatedData.is_favorite ? 1 : 0);
      }
      
      if (updates.length === 0) {
        return ApiResponse.error('No fields to update', 400, 'VALIDATION_ERROR');
      }
      
      updates.push('updated_at = datetime("now")');
      values.push(id, userId);
      
      updateResult = await env.DB.prepare(
        `UPDATE memos SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...values).run();
    } else {
      // Full update
      const { title, content, tags, is_favorite } = validatedData;
      const finalTitle = title || generateTitleFromContent(content);
      
      updateResult = await env.DB.prepare(`
        UPDATE memos
        SET title = ?, content = ?, tags = ?, is_favorite = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(finalTitle, content, tags, is_favorite || false, id, userId).run();
    }

    if (!updateResult.success) {
      return ApiResponse.error('Failed to update memo', 500, 'DATABASE_ERROR');
    }

    // Get the updated memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, is_pinned, notebook_id, is_archived, created_at, updated_at
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