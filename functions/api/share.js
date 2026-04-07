// functions/api/share.js
import { ApiResponse } from '../_shared/utils.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

// Generate random token
function generateShareToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Create share link for memo
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const body = await context.request.json();
  const { memo_id, expires_in, password } = body;
  
  if (!memo_id) {
    return ApiResponse.error('请提供备忘录ID', 400, 'VALIDATION_ERROR');
  }
  
  // Verify memo ownership
  const memo = await env.DB.prepare(
    'SELECT id FROM memos WHERE id = ? AND user_id = ?'
  ).bind(parseInt(memo_id), userId).first();
  
  if (!memo) {
    return ApiResponse.error('备忘录不存在', 404, 'MEMO_NOT_FOUND');
  }
  
  // Check if already shared
  let existing = await env.DB.prepare(
    'SELECT * FROM shared_memos WHERE memo_id = ? AND user_id = ?'
  ).bind(parseInt(memo_id), userId).first();
  
  if (existing) {
    // Update expiration if provided
    if (expires_in) {
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      await env.DB.prepare(
        'UPDATE shared_memos SET expires_at = ? WHERE id = ?'
      ).bind(expiresAt, existing.id).run();
      existing.expires_at = expiresAt;
    }
    return ApiResponse.success(existing);
  }
  
  // Create new share
  const token = generateShareToken();
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;
  
  const result = await env.DB.prepare(`
    INSERT INTO shared_memos (memo_id, user_id, share_token, password, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(parseInt(memo_id), userId, token, password || null, expiresAt).run();
  
  const share = await env.DB.prepare(
    'SELECT * FROM shared_memos WHERE id = ?'
  ).bind(result.meta.last_row_id).first();
  
  return ApiResponse.success({
    ...share,
    share_url: `${new URL(context.request.url).origin}/share/${token}`
  });
}

// List user's shared memos
export async function onRequestGet(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const shares = await env.DB.prepare(`
    SELECT s.*, m.title
    FROM shared_memos s
    JOIN memos m ON s.memo_id = m.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).bind(userId).all();
  
  const baseUrl = new URL(context.request.url).origin;
  const results = shares.results.map(s => ({
    ...s,
    share_url: `${baseUrl}/share/${s.share_token}`
  }));
  
  return ApiResponse.success(results);
}

// Delete share link
export async function onRequestDelete(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const url = new URL(context.request.url);
  const memoId = url.searchParams.get('memo_id');
  
  if (!memoId) {
    return ApiResponse.error('请提供备忘录ID', 400, 'VALIDATION_ERROR');
  }
  
  await env.DB.prepare(
    'DELETE FROM shared_memos WHERE memo_id = ? AND user_id = ?'
  ).bind(parseInt(memoId), userId).run();
  
  return ApiResponse.success({ deleted: true });
}