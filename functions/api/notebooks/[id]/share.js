/**
 * Notebook sharing API
 * Create and manage share links for notebooks
 */

import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

// Generate random share token
function generateShareToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GET - Get share status for notebook
export async function onGet(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const notebookId = params.id;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  try {
    // Verify notebook ownership
    const notebook = await db.prepare(
      'SELECT * FROM notebooks WHERE id = ? AND user_id = ?'
    ).bind(notebookId, userId).first();

    if (!notebook) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    // Get existing share
    const share = await db.prepare(
      'SELECT * FROM notebook_shares WHERE notebook_id = ? AND owner_id = ?'
    ).bind(notebookId, userId).first();

    return ApiResponse.success({
      notebook: {
        id: notebook.id,
        name: notebook.name
      },
      share: share ? {
        token: share.share_token,
        expiresAt: share.expires_at,
        viewCount: share.view_count,
        createdAt: share.created_at,
        shareUrl: `${new URL(request.url).origin}/shared/${share.share_token}`
      } : null
    });

  } catch (error) {
    console.error('Get share error:', error);
    return ApiResponse.error('Failed to get share status', 500, 'SHARE_ERROR');
  }
}

// POST - Create or update share link
export async function onPost(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const notebookId = params.id;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  try {
    const body = await request.json();
    const { expiresInDays } = body || {};

    // Verify notebook ownership
    const notebook = await db.prepare(
      'SELECT * FROM notebooks WHERE id = ? AND user_id = ?'
    ).bind(notebookId, userId).first();

    if (!notebook) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    // Check for existing share
    let share = await db.prepare(
      'SELECT * FROM notebook_shares WHERE notebook_id = ? AND owner_id = ?'
    ).bind(notebookId, userId).first();

    if (share) {
      // Update existing share
      const expiresAt = expiresInDays 
        ? `datetime('now', '+${expiresInDays} days')` 
        : null;
      
      await db.prepare(
        `UPDATE notebook_shares SET expires_at = ?, view_count = 0 WHERE id = ?`
      ).bind(expiresAt ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null, share.id).run();
    } else {
      // Create new share
      const token = generateShareToken();
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await db.prepare(
        `INSERT INTO notebook_shares (notebook_id, owner_id, share_token, expires_at) VALUES (?, ?, ?, ?)`
      ).bind(notebookId, userId, token, expiresAt).run();

      share = { share_token: token, expires_at: expiresAt };
    }

    return ApiResponse.success({
      token: share.share_token,
      expiresAt: share.expires_at,
      shareUrl: `${new URL(request.url).origin}/shared/${share.share_token}`
    });

  } catch (error) {
    console.error('Create share error:', error);
    return ApiResponse.error('Failed to create share', 500, 'SHARE_ERROR');
  }
}

// DELETE - Remove share link
export async function onDelete(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const notebookId = params.id;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  try {
    // Delete share
    const result = await db.prepare(
      'DELETE FROM notebook_shares WHERE notebook_id = ? AND owner_id = ?'
    ).bind(notebookId, userId).run();

    if (result.changes === 0) {
      return ApiResponse.error('Share not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ deleted: true });

  } catch (error) {
    console.error('Delete share error:', error);
    return ApiResponse.error('Failed to delete share', 500, 'SHARE_ERROR');
  }
}