import { ApiResponse } from '../_shared/utils.js';
import { NotebookSchema, validateBody } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get notebooks with memo counts (excluding archived)
    const { results } = await env.DB.prepare(`
      SELECT 
        n.id, 
        n.name, 
        n.icon, 
        n.created_at, 
        n.updated_at,
        COUNT(CASE WHEN m.is_archived = 0 THEN 1 END) as memo_count
      FROM notebooks n
      LEFT JOIN memos m ON n.id = m.notebook_id
      GROUP BY n.id
      ORDER BY n.id = 1 DESC, n.updated_at DESC
    `).all();

    // Mark default notebook
    const notebooks = results.map(n => ({
      ...n,
      is_default: n.id === 1,
      memo_count: n.memo_count || 0
    }));

    return ApiResponse.success(notebooks);
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    const result = await env.DB.prepare(`
      INSERT INTO notebooks (name, icon, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(name, icon).run();

    if (!result.success) {
      throw new Error('Failed to create notebook');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, name, icon, created_at, updated_at FROM notebooks WHERE id = ?
    `).bind(result.meta.last_row_id).all();

    return ApiResponse.success({ ...results[0], memo_count: 0, is_default: false }, 201);
  } catch (error) {
    console.error('Error creating notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}