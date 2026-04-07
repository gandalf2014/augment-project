import { ApiResponse } from '../../_shared/utils.js';

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
export async function onRequestPost(context) {
  const response = ApiResponse.success({ message: '已退出登录' });
  // Clear the auth cookie
  response.headers.set('Set-Cookie', 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return response;
}