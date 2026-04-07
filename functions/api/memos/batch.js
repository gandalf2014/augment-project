// functions/api/memos/batch.js

import { ApiResponse } from '../../_shared/utils.js';
import { validateBody, BatchSchema, BatchMoveSchema, BatchTagsSchema } from '../../_shared/validation.js';
import { getUserIdFromRequest } from '../../_shared/auth.js';

export async function onRequestPost(context) {
  const { DB, request } = context.env;
  
  // Get user ID
  const userId = getUserIdFromRequest(context.request);
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const validation = await validateBody(context.request, BatchSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { action, memo_ids, params } = validation.data;
  
  // Validate action-specific params structure (not existence)
  if (action === 'move') {
    const moveValidation = BatchMoveSchema.safeParse(validation.data);
    if (!moveValidation.success) {
      return ApiResponse.error(moveValidation.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
  }
  
  if (action === 'tags') {
    const tagsValidation = BatchTagsSchema.safeParse(validation.data);
    if (!tagsValidation.success) {
      return ApiResponse.error(tagsValidation.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
  }
  
  const results = { affected: 0, failed: [] };
  
  for (const memoId of memo_ids) {
    try {
      // First verify memo belongs to user
      const memoCheck = await context.env.DB.prepare(
        'SELECT id, tags FROM memos WHERE id = ? AND user_id = ?'
      ).bind(memoId, userId).first();
      
      if (!memoCheck) {
        results.failed.push({ id: memoId, reason: '备忘录不存在或不属于当前用户' });
        continue;
      }
      
      switch (action) {
        case 'archive':
          await context.env.DB.prepare(
            'UPDATE memos SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
          ).bind(memoId, userId).run();
          break;
        case 'restore':
          await context.env.DB.prepare(
            'UPDATE memos SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
          ).bind(memoId, userId).run();
          break;
        case 'delete':
          await context.env.DB.prepare(
            'DELETE FROM memos WHERE id = ? AND user_id = ?'
          ).bind(memoId, userId).run();
          break;
        case 'move':
          // Check notebook exists and belongs to user
          const notebook = await context.env.DB.prepare(
            'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
          ).bind(params.notebook_id, userId).first();
          if (!notebook) {
            results.failed.push({ id: memoId, reason: '笔记本不存在或不属于当前用户' });
            continue;
          }
          await context.env.DB.prepare(
            'UPDATE memos SET notebook_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
          ).bind(params.notebook_id, memoId, userId).run();
          break;
        case 'tags':
          let newTags = memoCheck.tags || '';
          const inputTags = params.tags.split(',').map(t => t.trim()).filter(t => t);
          
          if (params.mode === 'add') {
            const existingTags = newTags ? newTags.split(',').map(t => t.trim()) : [];
            const combined = [...existingTags, ...inputTags];
            newTags = [...new Set(combined)].join(',');
          } else if (params.mode === 'replace') {
            newTags = inputTags.join(',');
          } else if (params.mode === 'remove') {
            const existingTags = newTags ? newTags.split(',').map(t => t.trim()) : [];
            newTags = existingTags.filter(t => !inputTags.includes(t)).join(',');
          }
          
          await context.env.DB.prepare(
            'UPDATE memos SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
          ).bind(newTags, memoId, userId).run();
          break;
      }
      results.affected++;
    } catch (err) {
      results.failed.push({ id: memoId, reason: err.message });
    }
  }
  
  return ApiResponse.success(results);
}