/**
 * Memo version history API
 * Get and restore previous versions
 */

import { ApiResponse } from '../../../_shared/utils.js';
import { getUserIdFromRequest } from '../../../_shared/auth.js';

// Main request handler
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const db = env.DB;
  const memoId = params.id;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  try {
    if (method === 'GET') {
      return await handleGet(request, db, memoId, userId);
    } else if (method === 'POST') {
      return await handlePost(context, db, memoId, userId);
    } else {
      return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
  } catch (error) {
    console.error('Version API error:', error);
    return ApiResponse.error('Internal server error', 500, 'SERVER_ERROR');
  }
}

// GET - Get version history for a memo
async function handleGet(request, db, memoId, userId) {
  const url = new URL(request.url);
  const version = url.searchParams.get('version');

  // Verify memo ownership
  const memo = await db.prepare(
    'SELECT id FROM memos WHERE id = ? AND user_id = ?'
  ).bind(memoId, userId).first();

  if (!memo) {
    return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
  }

  if (version) {
    // Get specific version
    const v = await db.prepare(
      `SELECT id, title, content, tags, version, created_at
       FROM memo_versions
       WHERE memo_id = ? AND version = ?`
    ).bind(memoId, parseInt(version)).first();

    if (!v) {
      return ApiResponse.error('Version not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ version: v });
  }

  // Get all versions
  const versions = await db.prepare(
    `SELECT id, title, version, created_at
     FROM memo_versions
     WHERE memo_id = ?
     ORDER BY version DESC
     LIMIT 10`
  ).bind(memoId).all();

  // Get current memo
  const current = await db.prepare(
    'SELECT title, content, tags, updated_at FROM memos WHERE id = ?'
  ).bind(memoId).first();

  return ApiResponse.success({
    current: {
      title: current.title,
      content: current.content,
      tags: current.tags,
      updatedAt: current.updated_at
    },
    versions: versions.results || []
  });
}

// POST - Restore to a specific version
async function handlePost(context, db, memoId, userId) {
  const { request } = context;
  
  const body = await request.json();
  const { version } = body;

  if (!version) {
    return ApiResponse.error('Version number required', 400, 'VERSION_REQUIRED');
  }

  // Verify memo ownership
  const memo = await db.prepare(
    'SELECT * FROM memos WHERE id = ? AND user_id = ?'
  ).bind(memoId, userId).first();

  if (!memo) {
    return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
  }

  // Get the version to restore
  const oldVersion = await db.prepare(
    'SELECT * FROM memo_versions WHERE memo_id = ? AND version = ?'
  ).bind(memoId, parseInt(version)).first();

  if (!oldVersion) {
    return ApiResponse.error('Version not found', 404, 'NOT_FOUND');
  }

  // Save current state as new version
  const versionCount = await db.prepare(
    'SELECT COALESCE(MAX(version), 0) as max_version FROM memo_versions WHERE memo_id = ?'
  ).bind(memoId).first();

  await db.prepare(
    `INSERT INTO memo_versions (memo_id, user_id, title, content, tags, version)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(memoId, userId, memo.title, memo.content, memo.tags, (versionCount?.max_version || 0) + 1).run();

  // Restore the old version
  await db.prepare(
    `UPDATE memos SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(oldVersion.title, oldVersion.content, oldVersion.tags, memoId).run();

  return ApiResponse.success({
    restored: true,
    version: version,
    title: oldVersion.title,
    content: oldVersion.content,
    tags: oldVersion.tags
  });
}