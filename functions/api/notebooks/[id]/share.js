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

// Main request handler
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const db = env.DB;
  const notebookId = params.id;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  try {
    if (method === 'GET') {
      return await handleGet(db, notebookId, userId);
    } else if (method === 'POST') {
      return await handlePost(context, db, notebookId, userId);
    } else if (method === 'DELETE') {
      return await handleDelete(db, notebookId, userId);
    } else {
      return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
  } catch (error) {
    console.error('Share API error:', error);
    return ApiResponse.error('Internal server error', 500, 'SERVER_ERROR');
  }
}

// GET - Get share status for notebook
async function handleGet(db, notebookId, userId) {
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
      createdAt: share.created_at
    } : null
  });
}

// POST - Create or update share link
async function handlePost(context, db, notebookId, userId) {
  const { request } = context;
  
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    // Empty body is OK
  }
  
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

  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  if (share) {
    // Update existing share
    await db.prepare(
      `UPDATE notebook_shares SET expires_at = ?, view_count = 0 WHERE id = ?`
    ).bind(expiresAt, share.id).run();
  } else {
    // Create new share
    const token = generateShareToken();

    await db.prepare(
      `INSERT INTO notebook_shares (notebook_id, owner_id, share_token, expires_at) VALUES (?, ?, ?, ?)`
    ).bind(notebookId, userId, token, expiresAt).run();

    share = { share_token: token, expires_at: expiresAt };
  }

  const baseUrl = new URL(context.request.url).origin;
  
  return ApiResponse.success({
    token: share.share_token,
    expiresAt: share.expires_at,
    shareUrl: `${baseUrl}/shared/${share.share_token}`
  });
}

// DELETE - Remove share link
async function handleDelete(db, notebookId, userId) {
  // Delete share
  const result = await db.prepare(
    'DELETE FROM notebook_shares WHERE notebook_id = ? AND owner_id = ?'
  ).bind(notebookId, userId).run();

  if (result.meta.changes === 0) {
    return ApiResponse.error('Share not found', 404, 'NOT_FOUND');
  }

  return ApiResponse.success({ deleted: true });
}