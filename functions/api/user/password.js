// functions/api/user/password.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest, hashPassword } from '../../_shared/auth.js';

// Change password
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const body = await context.request.json();
  const { currentPassword, newPassword } = body;
  
  if (!currentPassword || !newPassword) {
    return ApiResponse.error('请提供当前密码和新密码', 400, 'VALIDATION_ERROR');
  }
  
  if (newPassword.length < 4) {
    return ApiResponse.error('密码长度至少4位', 400, 'VALIDATION_ERROR');
  }
  
  // Verify current password
  const currentHash = await hashPassword(currentPassword);
  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE id = ?'
  ).bind(userId).first();
  
  if (!user || user.password_hash !== currentHash) {
    return ApiResponse.error('当前密码错误', 400, 'INVALID_PASSWORD');
  }
  
  // Update password
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(newHash, userId).run();
  
  // Log password change
  await env.DB.prepare(
    'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)'
  ).bind(userId, currentHash).run();
  
  return ApiResponse.success({ message: '密码修改成功' });
}