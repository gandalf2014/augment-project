// functions/api/user/sessions.js
import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Get all sessions
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const sessions = await env.DB.prepare(`
    SELECT id, user_agent, ip_address, created_at, expires_at,
           CASE WHEN token_hash = ? THEN 1 ELSE 0 END as is_current
    FROM sessions 
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).bind(context.request.headers.get('Cookie')?.match(/auth_token=([^;]+)/)?.[1] || '', userId).all();
  
  return ApiResponse.success(sessions.results);
}

// Logout all other sessions
export async function onRequestDelete(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  // Get current token
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const currentToken = cookieHeader.match(/auth_token=([^;]+)/)?.[1];
  
  if (currentToken) {
    // Hash the current token to identify it
    const encoder = new TextEncoder();
    const data = encoder.encode(currentToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const currentTokenHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Delete all sessions except current
    await env.DB.prepare(
      'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?'
    ).bind(userId, currentTokenHash).run();
  } else {
    // Delete all sessions
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }
  
  return ApiResponse.success({ message: '已登出其他设备' });
}