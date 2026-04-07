// functions/api/import.js
import { ApiResponse } from '../_shared/utils.js';
import { getUserIdFromRequest } from '../_shared/auth.js';

// Import data from JSON backup
export async function onRequestPost(context) {
  const { env } = context;
  const userId = getUserIdFromRequest(context.request);
  
  if (!userId) {
    return ApiResponse.error('请先登录', 401, 'AUTH_REQUIRED');
  }
  
  const contentType = context.request.headers.get('Content-Type') || '';
  
  if (!contentType.includes('multipart/form-data')) {
    return ApiResponse.error('请上传文件', 400, 'VALIDATION_ERROR');
  }
  
  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return ApiResponse.error('未找到文件', 400, 'FILE_REQUIRED');
    }
    
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate structure
    if (!data.memos || !Array.isArray(data.memos)) {
      return ApiResponse.error('无效的备份文件格式', 400, 'INVALID_FORMAT');
    }
    
    const results = {
      memos: 0,
      tags: 0,
      notebooks: 0,
      errors: []
    };
    
    // Import notebooks first
    if (data.notebooks && Array.isArray(data.notebooks)) {
      for (const notebook of data.notebooks) {
        try {
          await env.DB.prepare(
            'INSERT INTO notebooks (name, icon, user_id) VALUES (?, ?, ?)'
          ).bind(notebook.name || '未分类', notebook.icon || '📁', userId).run();
          results.notebooks++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }
    
    // Get notebook mapping
    const notebooks = await env.DB.prepare(
      'SELECT id, name FROM notebooks WHERE user_id = ?'
    ).bind(userId).all();
    const notebookMap = {};
    notebooks.results.forEach(n => notebookMap[n.name] = n.id);
    
    // Import tags
    if (data.tags && Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        try {
          await env.DB.prepare(
            'INSERT OR IGNORE INTO tags (name, color, user_id) VALUES (?, ?, ?)'
          ).bind(tag.name, tag.color || '#64748b', userId).run();
          results.tags++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }
    
    // Import memos
    for (const memo of data.memos) {
      try {
        let notebookId = notebookMap[memo.notebook_name || '未分类'] || 1;
        
        await env.DB.prepare(`
          INSERT INTO memos (title, content, tags, is_favorite, notebook_id, user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          memo.title || '无标题',
          memo.content || '',
          memo.tags || '',
          memo.is_favorite ? 1 : 0,
          notebookId,
          userId,
          memo.created_at || new Date().toISOString(),
          memo.updated_at || new Date().toISOString()
        ).run();
        results.memos++;
      } catch (e) {
        results.errors.push(`Memo: ${memo.title} - ${e.message}`);
      }
    }
    
    return ApiResponse.success({
      message: '导入成功',
      results
    });
    
  } catch (e) {
    return ApiResponse.error(`导入失败: ${e.message}`, 400, 'IMPORT_ERROR');
  }
}