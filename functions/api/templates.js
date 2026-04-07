// functions/api/templates.js
import { ApiResponse } from '../_shared/utils.js';
import { validateBody, TemplateSchema } from '../_shared/validation.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

// Get all templates
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const templates = await env.DB.prepare(
    'SELECT * FROM memo_templates WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  
  return ApiResponse.success(templates.results);
}

// Create template
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const validation = await validateBody(context.request, TemplateSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { name, content, tags, is_default } = validation.data;
  
  // If setting as default, remove default from others
  if (is_default) {
    await env.DB.prepare(
      'UPDATE memo_templates SET is_default = 0 WHERE user_id = ?'
    ).bind(userId).run();
  }
  
  const result = await env.DB.prepare(
    'INSERT INTO memo_templates (name, content, tags, is_default, user_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, content || '', tags || '', is_default ? 1 : 0, userId).run();
  
  const template = await env.DB.prepare(
    'SELECT * FROM memo_templates WHERE id = ?'
  ).bind(result.meta.last_row_id).first();
  
  return ApiResponse.success(template);
}