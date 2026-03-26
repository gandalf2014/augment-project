import { ApiResponse } from '../_shared/utils.js';
import { TagSchema, validateBody } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(`
      SELECT id, name, color, created_at FROM tags ORDER BY name ASC
    `).all();

    return ApiResponse.success(results);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  // Validate input
  const validation = await validateBody(request, TagSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, color } = validation.data;

  try {
    // Insert the tag
    const insertResult = await env.DB.prepare(`
      INSERT INTO tags (name, color, created_at)
      VALUES (?, ?, datetime('now'))
    `).bind(name, color).run();

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

    // Handle unique constraint violation
    if (error.message.includes('UNIQUE constraint failed')) {
      return ApiResponse.error('Tag already exists', 409, 'DUPLICATE_TAG');
    }

    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
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