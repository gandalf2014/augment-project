/**
 * User statistics dashboard API
 * Returns comprehensive stats for the dashboard
 */

import { ApiResponse } from '../../_shared/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // Check authentication via cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const authMatch = cookieHeader.match(/auth_token=([^;]+)/);
  
  if (!authMatch) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const token = authMatch[1];

  // Validate session
  const sessionRes = await db.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime("now")'
  ).bind(token).first();

  if (!sessionRes) {
    return ApiResponse.error('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  const userId = sessionRes.user_id;

  try {
    // Get total counts
    const totalMemos = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND archived = 0'
    ).bind(userId).first();

    const totalTags = await db.prepare(
      'SELECT COUNT(*) as count FROM tags WHERE user_id = ?'
    ).bind(userId).first();

    const totalNotebooks = await db.prepare(
      'SELECT COUNT(*) as count FROM notebooks WHERE user_id = ?'
    ).bind(userId).first();

    const favoriteCount = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND is_favorite = 1 AND archived = 0'
    ).bind(userId).first();

    const archivedCount = await db.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE user_id = ? AND archived = 1'
    ).bind(userId).first();

    // Get activity for last 7 days
    const activityData = await db.prepare(`
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

    // Get tag usage stats
    const tagStats = await db.prepare(`
      SELECT 
        t.id, t.name, t.color,
        COALESCE(tu.usage_count, 0) as usage_count,
        tu.last_used_at
      FROM tags t
      LEFT JOIN tag_usage tu ON t.id = tu.tag_id AND tu.user_id = ?
      WHERE t.user_id = ?
      ORDER BY usage_count DESC
      LIMIT 20
    `).bind(userId, userId).all();

    // Get most active days (heatmap data for last 30 days)
    const heatmapData = await db.prepare(`
      SELECT 
        activity_date,
        (memos_created + memos_edited + memos_viewed) as total_activity
      FROM user_activity
      WHERE user_id = ?
        AND activity_date >= date("now", "-30 days")
      ORDER BY activity_date ASC
    `).bind(userId).all();

    // Get word count statistics
    const wordStats = await db.prepare(`
      SELECT 
        SUM(LENGTH(content)) as total_chars,
        AVG(LENGTH(content)) as avg_chars,
        MAX(LENGTH(content)) as max_chars
      FROM memos
      WHERE user_id = ? AND archived = 0
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
    return ApiResponse.error('Failed to fetch statistics', 500, 'STATS_ERROR');
  }
}