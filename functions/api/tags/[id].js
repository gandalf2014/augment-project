/**
 * Tag statistics API
 * Returns tag usage statistics and supports hierarchy
 */

import { ApiResponse } from '../../_shared/utils.js';
import { z } from 'zod';

const TagUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parent_id: z.number().int().nullable().optional()
});

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const tagId = params.id;

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

  // Verify tag ownership
  const tag = await db.prepare(
    'SELECT * FROM tags WHERE id = ? AND user_id = ?'
  ).bind(tagId, userId).first();

  if (!tag) {
    return ApiResponse.error('Tag not found', 404, 'TAG_NOT_FOUND');
  }

  const method = request.method;

  // GET - Get tag details with children
  if (method === 'GET') {
    try {
      // Get child tags
      const children = await db.prepare(
        'SELECT * FROM tags WHERE parent_id = ? AND user_id = ?'
      ).bind(tagId, userId).all();

      // Get usage stats
      const usage = await db.prepare(
        'SELECT usage_count, last_used_at FROM tag_usage WHERE tag_id = ? AND user_id = ?'
      ).bind(tagId, userId).first();

      // Get parent tag if exists
      let parent = null;
      if (tag.parent_id) {
        parent = await db.prepare(
          'SELECT id, name, color FROM tags WHERE id = ?'
        ).bind(tag.parent_id).first();
      }

      return ApiResponse.success({
        ...tag,
        parent,
        children: children.results || [],
        usage: usage || { usage_count: 0, last_used_at: null }
      });

    } catch (error) {
      console.error('Get tag error:', error);
      return ApiResponse.error('Failed to get tag', 500, 'TAG_ERROR');
    }
  }

  // PUT - Update tag (including parent_id for hierarchy)
  if (method === 'PUT') {
    try {
      const body = await request.json();

      // Validate input
      const validation = TagUpdateSchema.safeParse(body);
      if (!validation.success) {
        return ApiResponse.error('Invalid input', 400, 'VALIDATION_ERROR');
      }

      const { name, color, parent_id } = validation.data;

      // Check if parent_id is valid (not self, not descendant)
      if (parent_id !== undefined && parent_id !== null) {
        if (parent_id === parseInt(tagId)) {
          return ApiResponse.error('Cannot set parent to self', 400, 'INVALID_PARENT');
        }

        // Check if parent exists and belongs to user
        const parentTag = await db.prepare(
          'SELECT id, parent_id FROM tags WHERE id = ? AND user_id = ?'
        ).bind(parent_id, userId).first();

        if (!parentTag) {
          return ApiResponse.error('Parent tag not found', 404, 'PARENT_NOT_FOUND');
        }

        // Check for circular reference (parent cannot be a descendant)
        const checkCircular = async (checkId) => {
          if (checkId === parseInt(tagId)) return true;
          const t = await db.prepare(
            'SELECT parent_id FROM tags WHERE id = ?'
          ).bind(checkId).first();
          if (!t || !t.parent_id) return false;
          return checkCircular(t.parent_id);
        };

        if (await checkCircular(parent_id)) {
          return ApiResponse.error('Circular reference detected', 400, 'CIRCULAR_REFERENCE');
        }
      }

      // Build update query
      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (color !== undefined) {
        updates.push('color = ?');
        values.push(color);
      }
      if (parent_id !== undefined) {
        updates.push('parent_id = ?');
        values.push(parent_id);
      }

      if (updates.length === 0) {
        return ApiResponse.error('No fields to update', 400, 'NO_UPDATES');
      }

      updates.push('updated_at = datetime("now")');
      values.push(tagId, userId);

      await db.prepare(
        `UPDATE tags SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...values).run();

      return ApiResponse.success({ updated: true });

    } catch (error) {
      console.error('Update tag error:', error);
      return ApiResponse.error('Failed to update tag', 500, 'TAG_ERROR');
    }
  }

  // DELETE - Delete tag with option to move children
  if (method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const moveChildren = url.searchParams.get('move_children') === 'true';

      // Get children
      const children = await db.prepare(
        'SELECT id FROM tags WHERE parent_id = ? AND user_id = ?'
      ).bind(tagId, userId).all();

      if (children.results?.length > 0) {
        if (moveChildren) {
          // Move children to parent or make them root
          const newParentId = tag.parent_id || null;
          await db.prepare(
            'UPDATE tags SET parent_id = ? WHERE parent_id = ? AND user_id = ?'
          ).bind(newParentId, tagId, userId).run();
        } else {
          return ApiResponse.error('Tag has children. Use move_children=true to move them.', 400, 'HAS_CHILDREN');
        }
      }

      // Delete tag usage records
      await db.prepare(
        'DELETE FROM tag_usage WHERE tag_id = ? AND user_id = ?'
      ).bind(tagId, userId).run();

      // Delete tag
      await db.prepare(
        'DELETE FROM tags WHERE id = ? AND user_id = ?'
      ).bind(tagId, userId).run();

      return ApiResponse.success({ deleted: true });

    } catch (error) {
      console.error('Delete tag error:', error);
      return ApiResponse.error('Failed to delete tag', 500, 'TAG_ERROR');
    }
  }

  return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
}