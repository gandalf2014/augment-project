/**
 * User statistics dashboard API
 * Returns comprehensive stats for the dashboard
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

  try {
    // Get total counts
    const totalMemos = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND is_archived = 0'
    ).bind(userId).first();

    const totalTags = await db.prepare(
      'SELECT COUNT(*) as count FROM tags WHERE user_id = ?'
    ).bind(userId).first();

    const totalNotebooks = await db.prepare(
      'SELECT COUNT(*) as count FROM notebooks WHERE user_id = ?'
    ).bind(userId).first();

    const favoriteCount = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND is_favorite = 1 AND is_archived = 0'
    ).bind(userId).first();

    const archivedCount = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND is_archived = 1'
    ).bind(userId).first();

    // Get activity for last 7 days (may be empty if no activity)
    let activityData = { results: [] };
    try {
      activityData = await db.prepare(`
        SELECT 
          activity_date,
          memos_created,
          memos_edited,
          memos_viewed
        FROM user_activity
        WHERE user_id = ?
          AND activity_date >= date("now", "-7 days")
        ORDER BY activity_date ASC
      `).bind(userId).all();
    } catch (e) {
      // Table may not exist
    }

    // Get tag usage stats (simpler query)
    let tagStats = { results: [] };
    try {
      tagStats = await db.prepare(`
        SELECT 
          t.id, t.name, t.color,
          COUNT(DISTINCT m.id) as usage_count
        FROM tags t
        LEFT JOIN memos m ON m.user_id = ? AND m.tags LIKE '%' || t.name || '%'
        WHERE t.user_id = ?
        GROUP BY t.id
        ORDER BY usage_count DESC
        LIMIT 20
      `).bind(userId, userId).all();
    } catch (e) {
      // Fall back to simple tag list
      tagStats = await db.prepare(
        'SELECT id, name, color FROM tags WHERE user_id = ?'
      ).bind(userId).all();
    }

    // Get heatmap data (may be empty)
    let heatmapData = { results: [] };
    try {
      heatmapData = await db.prepare(`
        SELECT 
          activity_date,
          (memos_created + memos_edited + memos_viewed) as total_activity
        FROM user_activity
        WHERE user_id = ?
          AND activity_date >= date("now", "-30 days")
        ORDER BY activity_date ASC
      `).bind(userId).all();
    } catch (e) {
      // Table may not exist
    }

    // Get word count statistics
    const wordStats = await db.prepare(`
      SELECT 
        SUM(LENGTH(content)) as total_chars,
        AVG(LENGTH(content)) as avg_chars,
        MAX(LENGTH(content)) as max_chars
      FROM memos
      WHERE user_id = ? AND is_archived = 0
    `).bind(userId).first();

    // Get creation timeline (memos per month for last 6 months)
    const timelineData = await db.prepare(`
      SELECT 
        strftime("%Y-%m", created_at) as month,
        COUNT(*) as count
      FROM memos
      WHERE user_id = ?
        AND created_at >= date("now", "-6 months")
      GROUP BY month
      ORDER BY month ASC
    `).bind(userId).all();

    // Get top 5 most used tags
    const topTags = await db.prepare(`
      SELECT 
        t.name, t.color,
        COUNT(DISTINCT m.id) as memo_count
      FROM tags t
      JOIN memos m ON m.user_id = ? AND m.tags LIKE '%' || t.name || '%'
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY memo_count DESC
      LIMIT 5
    `).bind(userId, userId).all();

    return ApiResponse.success({
      totals: {
        memos: totalMemos?.count || 0,
        tags: totalTags?.count || 0,
        notebooks: totalNotebooks?.count || 0,
        favorites: favoriteCount?.count || 0,
        archived: archivedCount?.count || 0
      },
      activity: {
        last7Days: activityData.results || [],
        heatmap: heatmapData.results || []
      },
      content: {
        totalChars: wordStats?.total_chars || 0,
        avgChars: Math.round(wordStats?.avg_chars || 0),
        maxChars: wordStats?.max_chars || 0
      },
      tags: {
        usage: tagStats.results || [],
        top: topTags.results || []
      },
      timeline: timelineData.results || []
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return ApiResponse.error('Failed to fetch statistics: ' + error.message, 500, 'STATS_ERROR');
  }
}