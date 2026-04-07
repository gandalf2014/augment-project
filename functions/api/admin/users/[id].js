// functions/api/admin/users/[id].js
import { ApiResponse } from '../../../_shared/utils.js';
import { getUserIdFromRequest } from '../../../_shared/auth.js';

// Check if user is admin
async function isAdmin(env, userId) {
  const user = await env.DB.prepare(
    'SELECT is_admin FROM users WHERE id = ?'
  ).bind(userId).first();
  return user?.is_admin === 1;
}

// Get single user details (admin only)
export async function onRequestGet(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  const user = await env.DB.prepare(`
    SELECT 
      u.id,
      u.is_admin,
      u.username,
      u.created_at,
      u.last_login_at,
      u.login_count,
      (SELECT COUNT(*) FROM memos WHERE user_id = u.id) as memo_count,
      (SELECT COUNT(*) FROM tags WHERE user_id = u.id) as tag_count,
      (SELECT COUNT(*) FROM notebooks WHERE user_id = u.id) as notebook_count,
      (SELECT COUNT(*) FROM shared_memos WHERE user_id = u.id) as share_count,
      (SELECT COUNT(*) FROM memo_templates WHERE user_id = u.id) as template_count
    FROM users u
    WHERE u.id = ?
  `).bind(parseInt(id)).first();
  
  if (!user) {
    return ApiResponse.error('用户不存在', 404, 'USER_NOT_FOUND');
  }
  
  return ApiResponse.success(user);
}

// Update user (admin only)
export async function onRequestPut(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  const targetId = parseInt(id);
  const body = await context.request.json();
  
  // Prevent self-modification of admin status
  if (targetId === userId && body.is_admin === false) {
    return ApiResponse.error('不能取消自己的管理员权限', 400, 'SELF_MODIFICATION');
  }
  
  // Prevent modifying the last admin
  if (body.is_admin === false || body.is_admin === 0) {
    const adminCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_admin = 1'
    ).first();
    
    const targetUser = await env.DB.prepare(
      'SELECT is_admin FROM users WHERE id = ?'
    ).bind(targetId).first();
    
    if (targetUser?.is_admin === 1 && adminCount.count <= 1) {
      return ApiResponse.error('至少需要保留一个管理员', 400, 'LAST_ADMIN');
    }
  }
  
  // Update fields
  const updates = [];
  const values = [];
  
  if (body.username !== undefined) {
    updates.push('username = ?');
    values.push(body.username);
  }
  
  if (body.is_admin !== undefined) {
    updates.push('is_admin = ?');
    values.push(body.is_admin ? 1 : 0);
  }
  
  if (body.password) {
    if (body.password.length < 4) {
      return ApiResponse.error('密码长度至少4位', 400, 'VALIDATION_ERROR');
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(body.password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }
  
  if (updates.length === 0) {
    return ApiResponse.error('没有要更新的字段', 400, 'NO_UPDATES');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(targetId);
  
  await env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  // Log action
  await env.DB.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_user_id, details)
    VALUES (?, 'update_user', ?, ?)
  `).bind(userId, targetId, JSON.stringify(body)).run();
  
  const updated = await env.DB.prepare(
    'SELECT id, username, is_admin, created_at FROM users WHERE id = ?'
  ).bind(targetId).first();
  
  return ApiResponse.success(updated);
}

// Delete user (admin only)
export async function onRequestDelete(context) {
  const { env } = context;
  const { id } = context.params;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  if (!await isAdmin(env, userId)) {
    return ApiResponse.error('需要管理员权限', 403, 'FORBIDDEN');
  }
  
  const targetId = parseInt(id);
  
  // Prevent self-deletion
  if (targetId === userId) {
    return ApiResponse.error('不能删除自己的账户', 400, 'SELF_DELETION');
  }
  
  // Check if target is admin
  const targetUser = await env.DB.prepare(
    'SELECT is_admin, username FROM users WHERE id = ?'
  ).bind(targetId).first();
  
  if (!targetUser) {
    return ApiResponse.error('用户不存在', 404, 'USER_NOT_FOUND');
  }
  
  // Prevent deleting last admin
  if (targetUser.is_admin === 1) {
    const adminCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_admin = 1'
    ).first();
    
    if (adminCount.count <= 1) {
      return ApiResponse.error('至少需要保留一个管理员', 400, 'LAST_ADMIN');
    }
  }
  
  // Get stats before deletion for logging
  const stats = await env.DB.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM memos WHERE user_id = ?) as memo_count,
      (SELECT COUNT(*) FROM tags WHERE user_id = ?) as tag_count,
      (SELECT COUNT(*) FROM notebooks WHERE user_id = ?) as notebook_count
  `).bind(targetId, targetId, targetId).first();
  
  // Delete all user data
  await env.DB.prepare('DELETE FROM memos WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM tags WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM notebooks WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM saved_filters WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM shared_memos WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM memo_templates WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM search_history WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetId).run();
  await env.DB.prepare('DELETE FROM password_history WHERE user_id = ?').bind(targetId).run();
  
  // Delete user
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
  
  // Log action
  await env.DB.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_user_id, details)
    VALUES (?, 'delete_user', ?, ?)
  `).bind(userId, targetId, JSON.stringify({
    username: targetUser.username,
    ...stats
  })).run();
  
  return ApiResponse.success({
    deleted: true,
    user_id: targetId,
    stats
  });
}