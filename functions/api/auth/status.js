import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

/**
 * Check auth status
 * GET /api/auth/status
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  
  const userId = getUserIdFromRequest(request);
  
  if (!userId) {
    return ApiResponse.success({
      authenticated: false,
      userId: null,
      message: '未登录'
    });
  }
  
  // Verify user exists in database
  try {
    const user = await env.DB.prepare(
      'SELECT id, is_admin, username, created_at, last_login_at FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return ApiResponse.success({
        authenticated: false,
        userId: null,
        message: '用户不存在'
      });
    }
    
    return ApiResponse.success({
      authenticated: true,
      userId: user.id,
      isAdmin: user.is_admin === 1,
      username: user.username,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      message: '已登录'
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}