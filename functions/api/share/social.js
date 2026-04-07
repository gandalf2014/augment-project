/**
 * Social share tracking API
 * Records shares to various social platforms
 */

import { ApiResponse } from '../../_shared/utils.js';
import { z } from 'zod';

const ShareSchema = z.object({
  memo_id: z.number().int(),
  platform: z.enum(['wechat', 'weibo', 'twitter', 'facebook', 'linkedin', 'email', 'copy'])
});

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // Check authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const token = authHeader.slice(7);
  const sessionRes = await db.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime("now")'
  ).bind(token).first();

  if (!sessionRes) {
    return ApiResponse.error('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  const userId = sessionRes.user_id;

  if (request.method !== 'POST') {
    return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    const body = await request.json();
    const validation = ShareSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.error('Invalid input', 400, 'VALIDATION_ERROR');
    }

    const { memo_id, platform } = validation.data;

    // Verify memo ownership
    const memo = await db.prepare(
      'SELECT id, title, content FROM memos WHERE id = ? AND user_id = ?'
    ).bind(memo_id, userId).first();

    if (!memo) {
      return ApiResponse.error('Memo not found', 404, 'MEMO_NOT_FOUND');
    }

    // Record share
    await db.prepare(
      'INSERT INTO social_shares (memo_id, user_id, platform) VALUES (?, ?, ?)'
    ).bind(memo_id, userId, platform).run();

    // Generate share content
    const shareUrl = `${new URL(request.url).origin}/share`;
    const shareTitle = memo.title || '备忘录分享';
    const shareText = memo.content?.substring(0, 100) || '';

    // Platform-specific URLs
    const shareUrls = {
      wechat: null, // Need QR code or JS SDK
      weibo: `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`,
      copy: null
    };

    return ApiResponse.success({
      shared: true,
      platform,
      share_url: shareUrls[platform],
      title: shareTitle,
      text: shareText
    });

  } catch (error) {
    console.error('Social share error:', error);
    return ApiResponse.error('Failed to record share', 500, 'SHARE_ERROR');
  }
}