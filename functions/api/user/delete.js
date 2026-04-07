// functions/api/user/delete.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest, hashPassword } from '../../_shared/auth.js';

// Delete account (requires password confirmation)
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const body = await context.request.json();
  const { password, confirmation } = body;
  
  // Verify confirmation text
  if (confirmation !== 'DELETE') {
    return ApiResponse.error('请输入 DELETE 确认删除', 400, 'CONFIRMATION_REQUIRED');
  }
  
  // Verify password
  const passwordHash = await hashPassword(password);
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE id = ? AND password_hash = ?'
  ).bind(userId, passwordHash).first();
  
  if (!user) {
    return ApiResponse.error('密码错误', 400, 'INVALID_PASSWORD');
  }
  
  // Delete all user data (cascading will handle related tables)
  // Note: We need to delete in order due to foreign key constraints
  
  // 1. Delete memo versions
  await env.DB.prepare('DELETE FROM memo_versions WHERE user_id = ?').bind(userId).run();
  
  // 2. Delete shared memos
  await env.DB.prepare('DELETE FROM shared_memos WHERE user_id = ?').bind(userId).run();
  
  // 3. Delete search history
  await env.DB.prepare('DELETE FROM search_history WHERE user_id = ?').bind(userId).run();
  
  // 4. Delete sessions
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  
  // 5. Delete user settings
  await env.DB.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(userId).run();
  
  // 6. Delete password history
  await env.DB.prepare('DELETE FROM password_history WHERE user_id = ?').bind(userId).run();
  
  // 7. Delete templates
  await env.DB.prepare('DELETE FROM memo_templates WHERE user_id = ?').bind(userId).run();
  
  // 8. Delete saved filters
  await env.DB.prepare('DELETE FROM saved_filters WHERE user_id = ?').bind(userId).run();
  
  // 9. Delete memos
  await env.DB.prepare('DELETE FROM memos WHERE user_id = ?').bind(userId).run();
  
  // 10. Delete tags
  await env.DB.prepare('DELETE FROM tags WHERE user_id = ?').bind(userId).run();
  
  // 11. Delete notebooks
  await env.DB.prepare('DELETE FROM notebooks WHERE user_id = ?').bind(userId).run();
  
  // 12. Finally delete user
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  
  return ApiResponse.success({ message: '账户已删除', deleted: true });
}