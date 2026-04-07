/**
 * User activity tracking API
 * Records user activities for statistics
 */

import { ApiResponse } from '../../_shared/utils.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // Get user ID from auth
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  if (request.method !== 'POST') {
    return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    const body = await request.json();
    const { action } = body;

    // Valid actions
    const validActions = ['memo_created', 'memo_edited', 'memo_deleted', 'memo_viewed', 'search'];
    if (!validActions.includes(action)) {
      return ApiResponse.error('Invalid action', 400, 'INVALID_ACTION');
    }

    const today = new Date().toISOString().split('T')[0];

    // Get or create activity record for today
    const existing = await db.prepare(
      'SELECT id FROM user_activity WHERE user_id = ? AND activity_date = ?'
    ).bind(userId, today).first();

    if (existing) {
      // Update existing record
      const columnMap = {
        'memo_created': 'memos_created',
        'memo_edited': 'memos_edited',
        'memo_deleted': 'memos_deleted',
        'memo_viewed': 'memos_viewed',
        'search': 'searches_performed'
      };

      const column = columnMap[action];
      await db.prepare(`
        UPDATE user_activity
        SET ${column} = ${column} + 1, updated_at = datetime("now")
        WHERE id = ?
      `).bind(existing.id).run();
    } else {
      // Create new record
      const columnMap = {
        'memo_created': ['memos_created', 1],
        'memo_edited': ['memos_edited', 1],
        'memo_deleted': ['memos_deleted', 1],
        'memo_viewed': ['memos_viewed', 1],
        'search': ['searches_performed', 1]
      };

      const [column, value] = columnMap[action];
      await db.prepare(`
        INSERT INTO user_activity (user_id, activity_date, ${column})
        VALUES (?, ?, ?)
      `).bind(userId, today, value).run();
    }

    // Update tag usage if action involves tags
    if (body.tags && Array.isArray(body.tags)) {
      for (const tagName of body.tags) {
        // Get tag ID
        const tag = await db.prepare(
          'SELECT id FROM tags WHERE user_id = ? AND name = ?'
        ).bind(userId, tagName).first();

        if (tag) {
          const tagUsage = await db.prepare(
            'SELECT id FROM tag_usage WHERE tag_id = ? AND user_id = ?'
          ).bind(tag.id, userId).first();

          if (tagUsage) {
            await db.prepare(
              'UPDATE tag_usage SET usage_count = usage_count + 1, last_used_at = datetime("now") WHERE id = ?'
            ).bind(tagUsage.id).run();
          } else {
            await db.prepare(
              'INSERT INTO tag_usage (tag_id, user_id, usage_count) VALUES (?, ?, 1)'
            ).bind(tag.id, userId).run();
          }
        }
      }
    }

    return ApiResponse.success({ recorded: true });

  } catch (error) {
    console.error('Activity tracking error:', error);
    return ApiResponse.error('Failed to record activity', 500, 'ACTIVITY_ERROR');
  }
}