// functions/api/share/[token].js
import { ApiResponse } from '../../_shared/utils.js';

// Get shared memo (public, no auth required)
export async function onRequestGet(context) {
  const { env } = context;
  const { token } = context.params;
  
  const share = await env.DB.prepare(`
    SELECT s.*, m.title, m.content, m.tags, m.created_at, m.updated_at
    FROM shared_memos s
    JOIN memos m ON s.memo_id = m.id
    WHERE s.share_token = ?
  `).bind(token).first();
  
  if (!share) {
    return ApiResponse.error('分享链接不存在或已过期', 404, 'NOT_FOUND');
  }
  
  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return ApiResponse.error('分享链接已过期', 410, 'EXPIRED');
  }
  
  // Increment view count
  await env.DB.prepare(
    'UPDATE shared_memos SET view_count = view_count + 1 WHERE id = ?'
  ).bind(share.id).run();
  
  return ApiResponse.success({
    title: share.title,
    content: share.content,
    tags: share.tags,
    created_at: share.created_at,
    view_count: share.view_count + 1
  });
}