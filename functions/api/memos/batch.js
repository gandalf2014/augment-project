// functions/api/memos/batch.js

import { ApiResponse } from '../_shared/utils.js';
import { validateBody, BatchSchema, BatchMoveSchema, BatchTagsSchema } from '../_shared/validation.js';

export async function onRequestPost(context) {
  const { DB } = context.env;
  
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
      switch (action) {
        case 'archive':
          await DB.prepare('UPDATE memos SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(memoId).run();
          break;
        case 'restore':
          await DB.prepare('UPDATE memos SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(memoId).run();
          break;
        case 'delete':
          await DB.prepare('DELETE FROM memos WHERE id = ?').bind(memoId).run();
          break;
        case 'move':
          // Check notebook exists inside loop for partial success
          const notebook = await DB.prepare('SELECT id FROM notebooks WHERE id = ?')
            .bind(params.notebook_id).first();
          if (!notebook) {
            results.failed.push({ id: memoId, reason: '笔记本不存在' });
            continue;
          }
          await DB.prepare('UPDATE memos SET notebook_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(params.notebook_id, memoId).run();
          break;
        case 'tags':
          const memo = await DB.prepare('SELECT tags FROM memos WHERE id = ?').bind(memoId).first();
          if (!memo) {
            results.failed.push({ id: memoId, reason: '备忘录不存在' });
            continue;
          }
          let newTags = memo.tags || '';
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
          
          await DB.prepare('UPDATE memos SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(newTags, memoId).run();
          break;
      }
      results.affected++;
    } catch (err) {
      results.failed.push({ id: memoId, reason: err.message });
    }
  }
  
  return ApiResponse.success(results);
}