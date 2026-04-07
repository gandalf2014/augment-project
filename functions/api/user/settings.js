// functions/api/user/settings.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Get user settings
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const settings = await env.DB.prepare(
    'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?'
  ).bind(userId).all();
  
  // Convert to object
  const settingsObj = {};
  settings.results.forEach(s => {
    try {
      settingsObj[s.setting_key] = JSON.parse(s.setting_value);
    } catch {
      settingsObj[s.setting_key] = s.setting_value;
    }
  });
  
  // Default settings
  const defaults = {
    theme: 'dark',
    fontSize: 14,
    lineHeight: 1.6,
    defaultNotebook: null,
    autoSave: true,
    listView: false
  };
  
  return ApiResponse.success({ ...defaults, ...settingsObj });
}

// Update user settings
export async function onRequestPut(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const body = await context.request.json();
  
  for (const [key, value] of Object.entries(body)) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    await env.DB.prepare(`
      INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, setting_key) 
      DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
    `).bind(userId, key, valueStr).run();
  }
  
  return ApiResponse.success({ updated: true });
}