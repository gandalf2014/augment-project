/**
 * Shared notebook access API (public, no auth required)
 * Returns notebook and its memos for shared access
 */

import { ApiResponse } from '../../_shared/utils.js';

export async function onGet(context) {
  const { env, params } = context;
  const db = env.DB;
  const token = params.token;

  try {
    // Get share by token
    const share = await db.prepare(
      `SELECT ns.*, n.name as notebook_name, n.id as notebook_id
       FROM notebook_shares ns
       JOIN notebooks n ON ns.notebook_id = n.id
       WHERE ns.share_token = ?`
    ).bind(token).first();

    if (!share) {
      return ApiResponse.error('Share not found', 404, 'NOT_FOUND');
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return ApiResponse.error('Share link has expired', 410, 'EXPIRED');
    }

    // Get memos in this notebook
    const memos = await db.prepare(
      `SELECT id, title, content, tags, is_favorite, created_at, updated_at
       FROM memos
       WHERE user_id = ? AND notebook_id = ? AND is_archived = 0
       ORDER BY created_at DESC`
    ).bind(share.owner_id, share.notebook_id).all();

    // Update view count
    await db.prepare(
      'UPDATE notebook_shares SET view_count = view_count + 1 WHERE id = ?'
    ).bind(share.id).run();

    return ApiResponse.success({
      notebook: {
        id: share.notebook_id,
        name: share.notebook_name
      },
      memos: memos.results || [],
      viewCount: share.view_count + 1,
      expiresAt: share.expires_at
    });

  } catch (error) {
    console.error('Get shared notebook error:', error);
    return ApiResponse.error('Failed to get shared notebook', 500, 'SHARE_ERROR');
  }
}