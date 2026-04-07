// functions/api/admin/logs.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Check if user is admin
async function isAdmin(env, userId) {
  const user = await env.DB.prepare(
    'SELECT is_admin FROM users WHERE id = ?'
  ).bind(userId).first();
  return user?.is_admin === 1;
}

// Get admin logs (admin only)
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  const url = new URL(context.request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || 100), 200);
  const offset = parseInt(url.searchParams.get('offset') || 0);
  
  const logs = await env.DB.prepare(`
    SELECT 
      l.*,
      a.username as admin_name,
      t.username as target_name
    FROM admin_logs l
    LEFT JOIN users a ON l.admin_id = a.id
    LEFT JOIN users t ON l.target_user_id = t.id
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  
  return ApiResponse.success(logs.results);
}