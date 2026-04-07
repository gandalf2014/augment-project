// functions/api/filters.js

import { ApiResponse } from '../_shared/utils.js';
import { validateBody, SavedFilterSchema } from '../_shared/validation.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const filters = await env.DB.prepare(
    'SELECT * FROM saved_filters WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC'
  ).bind(userId).all();
  
  const parsedFilters = filters.results.map(f => ({
    ...f,
    filter_config: JSON.parse(f.filter_config)
  }));
  
  return ApiResponse.success(parsedFilters);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Get user ID
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const validation = await validateBody(request, SavedFilterSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { name, icon, filter_config } = validation.data;
  
  const result = await env.DB.prepare(
    'INSERT INTO saved_filters (name, icon, filter_config, user_id) VALUES (?, ?, ?, ?)'
  ).bind(name, icon || '⭐', JSON.stringify(filter_config), userId).run();
  
  const newFilter = await env.DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  
  return ApiResponse.success({
    ...newFilter,
    filter_config: JSON.parse(newFilter.filter_config)
  });
}