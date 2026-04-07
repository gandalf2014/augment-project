/**
 * Batch tag operations API
 * Supports batch delete, merge, and move operations
 */

import { ApiResponse } from '../_shared/utils.js';
import { z } from 'zod';

const BatchDeleteSchema = z.object({
  tag_ids: z.array(z.number().int()).min(1).max(50)
});

const BatchMergeSchema = z.object({
  source_tag_ids: z.array(z.number().int()).min(1).max(50),
  target_tag_id: z.number().int()
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
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'delete';
    const body = await request.json();

    // Delete tags
    if (action === 'delete') {
      const validation = BatchDeleteSchema.safeParse(body);
      if (!validation.success) {
        return ApiResponse.error('Invalid input', 400, 'VALIDATION_ERROR');
      }

      const { tag_ids } = validation.data;
      const placeholders = tag_ids.map(() => '?').join(',');

      // Verify all tags belong to user
      const tags = await db.prepare(
        `SELECT id, parent_id FROM tags WHERE id IN (${placeholders}) AND user_id = ?`
      ).bind(...tag_ids, userId).all();

      if (tags.results?.length !== tag_ids.length) {
        return ApiResponse.error('Some tags not found', 404, 'TAGS_NOT_FOUND');
      }

      // Move children to root
      await db.prepare(
        `UPDATE tags SET parent_id = NULL WHERE parent_id IN (${placeholders}) AND user_id = ?`
      ).bind(...tag_ids, userId).run();

      // Delete tag usage records
      await db.prepare(
        `DELETE FROM tag_usage WHERE tag_id IN (${placeholders}) AND user_id = ?`
      ).bind(...tag_ids, userId).run();

      // Delete tags
      const result = await db.prepare(
        `DELETE FROM tags WHERE id IN (${placeholders}) AND user_id = ?`
      ).bind(...tag_ids, userId).run();

      return ApiResponse.success({
        deleted: result.changes,
        tag_ids
      });
    }

    // Merge tags
    if (action === 'merge') {
      const validation = BatchMergeSchema.safeParse(body);
      if (!validation.success) {
        return ApiResponse.error('Invalid input', 400, 'VALIDATION_ERROR');
      }

      const { source_tag_ids, target_tag_id } = validation.data;

      // Target cannot be in source
      if (source_tag_ids.includes(target_tag_id)) {
        return ApiResponse.error('Target tag cannot be in source tags', 400, 'INVALID_TARGET');
      }

      // Verify target exists
      const targetTag = await db.prepare(
        'SELECT id, name FROM tags WHERE id = ? AND user_id = ?'
      ).bind(target_tag_id, userId).first();

      if (!targetTag) {
        return ApiResponse.error('Target tag not found', 404, 'TARGET_NOT_FOUND');
      }

      // Verify source tags exist
      const placeholders = source_tag_ids.map(() => '?').join(',');
      const sourceTags = await db.prepare(
        `SELECT id, name FROM tags WHERE id IN (${placeholders}) AND user_id = ?`
      ).bind(...source_tag_ids, userId).all();

      if (sourceTags.results?.length !== source_tag_ids.length) {
        return ApiResponse.error('Some source tags not found', 404, 'SOURCE_NOT_FOUND');
      }

      // Update memos to use target tag instead of source tags
      const sourceNames = sourceTags.results.map(t => t.name);
      const targetName = targetTag.name;

      // Get all memos with source tags
      const memos = await db.prepare(
        `SELECT id, tags FROM memos WHERE user_id = ? AND (${sourceNames.map(() => 'tags LIKE ?').join(' OR ')})`
      ).bind(userId, ...sourceNames.map(n => `%${n}%`)).all();

      // Update each memo
      for (const memo of memos.results || []) {
        let memoTags = memo.tags ? memo.tags.split(',').map(t => t.trim()) : [];
        
        // Remove source tags and ensure target tag exists
        memoTags = memoTags.filter(t => !sourceNames.includes(t));
        if (!memoTags.includes(targetName)) {
          memoTags.push(targetName);
        }

        await db.prepare(
          'UPDATE memos SET tags = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(memoTags.join(', '), memo.id).run();
      }

      // Delete source tags and their usage records
      await db.prepare(
        `DELETE FROM tag_usage WHERE tag_id IN (${placeholders}) AND user_id = ?`
      ).bind(...source_tag_ids, userId).run();

      await db.prepare(
        `DELETE FROM tags WHERE id IN (${placeholders}) AND user_id = ?`
      ).bind(...source_tag_ids, userId).run();

      return ApiResponse.success({
        merged: source_tag_ids.length,
        into: target_tag_id,
        memos_updated: memos.results?.length || 0
      });
    }

    // Get tag hierarchy
    if (action === 'hierarchy') {
      const allTags = await db.prepare(
        'SELECT id, name, color, parent_id FROM tags WHERE user_id = ? ORDER BY name'
      ).bind(userId).all();

      // Build tree structure
      const buildTree = (tags, parentId = null) => {
        return tags
          .filter(t => t.parent_id === parentId)
          .map(t => ({
            ...t,
            children: buildTree(tags, t.id)
          }));
      };

      const hierarchy = buildTree(allTags.results || []);

      return ApiResponse.success({
        flat: allTags.results || [],
        hierarchy
      });
    }

    return ApiResponse.error('Invalid action', 400, 'INVALID_ACTION');

  } catch (error) {
    console.error('Batch tag operation error:', error);
    return ApiResponse.error('Failed to perform operation', 500, 'TAG_ERROR');
  }
}