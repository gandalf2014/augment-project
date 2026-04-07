import { ApiResponse } from '../_shared/utils.js';
import { TagSchema, validateBody } from '../_shared/validation.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }

  try {
    // Get tags for this user only
    const { results } = await env.DB.prepare(`
      SELECT id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name ASC
    `).bind(userId).all();

    return ApiResponse.success(results);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }

  // Validate input
  const validation = await validateBody(request, TagSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, color } = validation.data;

  try {
    // Check if tag already exists for this user
    const existing = await env.DB.prepare(
      'SELECT id FROM tags WHERE name = ? AND user_id = ?'
    ).bind(name, userId).first();
    
    if (existing) {
      return ApiResponse.error('该标签已存在', 409, 'DUPLICATE_TAG');
    }

    // Insert the tag with user_id
    const insertResult = await env.DB.prepare(`
      INSERT INTO tags (name, color, user_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(name, color, userId).run();

    if (!insertResult.success) {
      throw new Error('Failed to insert tag');
    }

    // Get the inserted tag
    const { results } = await env.DB.prepare(`
      SELECT id, name, color, created_at FROM tags WHERE id = ?
    `).bind(insertResult.meta.last_row_id).all();

    return ApiResponse.success(results[0], 201);
  } catch (error) {
    console.error('Error creating tag:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const url = new URL(request.url);

  // Get ID from params or URL
  let id = params?.id;
  if (!id) {
    id = url.pathname.split('/').pop();
  }

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