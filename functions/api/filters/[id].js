// functions/api/filters/[id].js

import { ApiResponse } from '../../_shared/utils.js';
import { validateBody, SavedFilterUpdateSchema } from '../../_shared/validation.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env } = context;
  const { id } = context.params;
  
  // Get user ID
  const userId = getUserIdFromRequest(context.request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const filter = await env.DB.prepare('SELECT * FROM saved_filters WHERE id = ? AND user_id = ?')
    .bind(parseInt(id), userId).first();
  
  if (!filter) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  return ApiResponse.success({
    ...filter,
    filter_config: JSON.parse(filter.filter_config)
  });
}

export async function onRequestPut(context) {
  const { env } = context;
  const { id } = context.params;
  
  // Get user ID
  const userId = getUserIdFromRequest(context.request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const validation = await validateBody(context.request, SavedFilterUpdateSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const existing = await env.DB.prepare('SELECT * FROM saved_filters WHERE id = ? AND user_id = ?')
    .bind(parseInt(id), userId).first();
  
  if (!existing) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  const { name, icon, filter_config } = validation.data;
  const configStr = filter_config ? JSON.stringify(filter_config) : existing.filter_config;
  
  await env.DB.prepare(
    'UPDATE saved_filters SET name = ?, icon = ?, filter_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
  ).bind(
    name || existing.name,
    icon || existing.icon,
    configStr,
    parseInt(id),
    userId
  ).run();
  
  const updated = await env.DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(parseInt(id)).first();
  
  return ApiResponse.success({
    ...updated,
    filter_config: JSON.parse(updated.filter_config)
  });
}

export async function onRequestDelete(context) {
  const { env } = context;
  const { id } = context.params;
  
  // Get user ID
  const userId = getUserIdFromRequest(context.request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const result = await env.DB.prepare('DELETE FROM saved_filters WHERE id = ? AND user_id = ?')
    .bind(parseInt(id), userId).run();
  
  if (result.meta.changes === 0) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  return ApiResponse.success({ deleted: true });
}