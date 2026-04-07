// functions/api/admin/users.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Check if user is admin
async function isAdmin(env, userId) {
  const user = await env.DB.prepare(
    'SELECT is_admin FROM users WHERE id = ?'
  ).bind(userId).first();
  return user?.is_admin === 1;
}

// List all users (admin only)
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  // Get all users with stats
  const users = await env.DB.prepare(`
    SELECT 
      u.id,
      u.password_hash,
      u.is_admin,
      u.username,
      u.created_at,
      u.last_login_at,
      u.login_count,
      (SELECT COUNT(*) FROM memos WHERE user_id = u.id) as memo_count,
      (SELECT COUNT(*) FROM tags WHERE user_id = u.id) as tag_count,
      (SELECT COUNT(*) FROM notebooks WHERE user_id = u.id) as notebook_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all();
  
  // Mask password hash, add derived password for display
  const results = users.results.map(u => ({
    ...u,
    password_hash: undefined,  // Don't expose hash
    has_password: !!u.password_hash,
    display_name: u.username || `用户${u.id}`
  }));
  
  return ApiResponse.success(results);
}

// Create new user (admin only)
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  const body = await context.request.json();
  const { password, username, is_admin } = body;
  
  if (!password || password.length < 4) {
    return ApiResponse.error('密码长度至少4位', 400, 'VALIDATION_ERROR');
  }
  
  // Hash password (SHA-256)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const result = await env.DB.prepare(
    'INSERT INTO users (password_hash, username, is_admin) VALUES (?, ?, ?)'
  ).bind(passwordHash, username || null, is_admin ? 1 : 0).run();
  
  // Log action
  await env.DB.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_user_id, details)
    VALUES (?, 'create_user', ?, ?)
  `).bind(userId, result.meta.last_row_id, JSON.stringify({ username, is_admin })).run();
  
  return ApiResponse.success({
    id: result.meta.last_row_id,
    username: username || null,
    is_admin: is_admin ? 1 : 0,
    created_at: new Date().toISOString()
  });
}