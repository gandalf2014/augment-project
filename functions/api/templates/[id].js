// functions/api/templates/[id].js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Get single template
export async function onRequestGet(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const template = await env.DB.prepare(
    'SELECT * FROM memo_templates WHERE id = ? AND user_id = ?'
  ).bind(parseInt(id), userId).first();
  
  if (!template) {
    return ApiResponse.error('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
  }
  
  return ApiResponse.success(template);
}

// Update template
export async function onRequestPut(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const body = await context.request.json();
  
  const existing = await env.DB.prepare(
    'SELECT * FROM memo_templates WHERE id = ? AND user_id = ?'
  ).bind(parseInt(id), userId).first();
  
  if (!existing) {
    return ApiResponse.error('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
  }
  
  // If setting as default, remove default from others
  if (body.is_default) {
    await env.DB.prepare(
      'UPDATE memo_templates SET is_default = 0 WHERE user_id = ?'
    ).bind(userId).run();
  }
  
  await env.DB.prepare(`
    UPDATE memo_templates 
    SET name = ?, content = ?, tags = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(
    body.name || existing.name,
    body.content ?? existing.content,
    body.tags ?? existing.tags,
    body.is_default ? 1 : 0,
    parseInt(id),
    userId
  ).run();
  
  const updated = await env.DB.prepare(
    'SELECT * FROM memo_templates WHERE id = ?'
  ).bind(parseInt(id)).first();
  
  return ApiResponse.success(updated);
}

// Delete template
export async function onRequestDelete(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const result = await env.DB.prepare(
    'DELETE FROM memo_templates WHERE id = ? AND user_id = ?'
  ).bind(parseInt(id), userId).run();
  
  if (result.meta.changes === 0) {
    return ApiResponse.error('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
  }
  
  return ApiResponse.success({ deleted: true });
}