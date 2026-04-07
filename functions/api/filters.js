// functions/api/filters.js

import { ApiResponse } from '../_shared/utils.js';
import { validateBody, SavedFilterSchema } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { DB } = context.env;
  
  const filters = await DB.prepare(
    'SELECT * FROM saved_filters ORDER BY sort_order ASC, created_at DESC'
  ).all();
  
  const parsedFilters = filters.results.map(f => ({
    ...f,
    filter_config: JSON.parse(f.filter_config)
  }));
  
  return ApiResponse.success(parsedFilters);
}

export async function onRequestPost(context) {
  const { DB } = context.env;
  
  const validation = await validateBody(context.request, SavedFilterSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { name, icon, filter_config } = validation.data;
  
  const result = await DB.prepare(
    'INSERT INTO saved_filters (name, icon, filter_config) VALUES (?, ?, ?)'
  ).bind(name, icon || '⭐', JSON.stringify(filter_config)).run();
  
  const newFilter = await DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  
  return ApiResponse.success({
    ...newFilter,
    filter_config: JSON.parse(newFilter.filter_config)
  });
}