/**
 * 标签相关路由
 */

import type { Router } from '../utils/router';
import type { Env, CreateTagRequest } from '../types/database';
import { TagService } from '../services/tagService';
import { authMiddleware, jsonResponse } from '../middleware';

export function registerTagRoutes(router: Router) {
  
  // 获取标签列表 (公开)
  router.get('/api/tags', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
      const minUsage = url.searchParams.get('min_usage') ? parseInt(url.searchParams.get('min_usage')!) : undefined;
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.getTags(limit, minUsage);
      
      return jsonResponse({ success: true, data: tags });
    } catch (error) {
      console.error('Get tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch tags' }, 500);
    }
  });

  // 搜索标签 (公开)
  router.get('/api/tags/search', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      if (!query) {
        return jsonResponse({ success: false, error: 'Search query is required' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.searchTags(query, limit);
      
      return jsonResponse({ success: true, data: tags });
    } catch (error) {
      console.error('Search tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to search tags' }, 500);
    }
  });

  // 获取热门标签 (公开)
  router.get('/api/tags/popular', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.getPopularTags(limit);
      
      return jsonResponse({ success: true, data: tags });
    } catch (error) {
      console.error('Get popular tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch popular tags' }, 500);
    }
  });

  // 根据 ID 获取标签 (公开)
  router.get('/api/tags/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid tag ID' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tag = await tagService.getTagById(id);
      
      if (!tag) {
        return jsonResponse({ success: false, error: 'Tag not found' }, 404);
      }
      
      return jsonResponse({ success: true, data: tag });
    } catch (error) {
      console.error('Get tag error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch tag' }, 500);
    }
  });

  // 根据 slug 获取标签 (公开)
  router.get('/api/tags/slug/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      
      const tagService = new TagService(env.DB);
      const tag = await tagService.getTagBySlug(slug);
      
      if (!tag) {
        return jsonResponse({ success: false, error: 'Tag not found' }, 404);
      }
      
      return jsonResponse({ success: true, data: tag });
    } catch (error) {
      console.error('Get tag by slug error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch tag' }, 500);
    }
  });

  // 获取相关标签 (公开)
  router.get('/api/tags/:id/related', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid tag ID' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.getRelatedTags(id, limit);
      
      return jsonResponse({ success: true, data: tags });
    } catch (error) {
      console.error('Get related tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch related tags' }, 500);
    }
  });

  // 创建标签 (需要认证)
  router.post('/api/tags', async (request, env: Env, ctx, params) => {
    try {
      const data = (request as any).body as CreateTagRequest;
      
      // 验证必填字段
      if (!data.name) {
        return jsonResponse({ 
          success: false, 
          error: 'Tag name is required' 
        }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tag = await tagService.createTag(data);
      
      return jsonResponse({ 
        success: true, 
        data: tag,
        message: 'Tag created successfully' 
      }, 201);
    } catch (error) {
      console.error('Create tag error:', error);
      return jsonResponse({ success: false, error: 'Failed to create tag' }, 500);
    }
  }, [authMiddleware]);

  // 批量创建标签 (需要认证)
  router.post('/api/tags/batch', async (request, env: Env, ctx, params) => {
    try {
      const { names } = (request as any).body as { names: string[] };
      
      if (!names || !Array.isArray(names) || names.length === 0) {
        return jsonResponse({ 
          success: false, 
          error: 'Tag names are required' 
        }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.createTagsIfNotExist(names);
      
      return jsonResponse({ 
        success: true, 
        data: tags,
        message: 'Tags created successfully' 
      }, 201);
    } catch (error) {
      console.error('Batch create tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to create tags' }, 500);
    }
  }, [authMiddleware]);

  // 更新标签 (需要认证)
  router.put('/api/tags/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      const data = (request as any).body as Partial<CreateTagRequest>;
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid tag ID' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      const tag = await tagService.updateTag(id, data);
      
      return jsonResponse({ 
        success: true, 
        data: tag,
        message: 'Tag updated successfully' 
      });
    } catch (error) {
      console.error('Update tag error:', error);
      if (error instanceof Error && error.message === 'Tag not found') {
        return jsonResponse({ success: false, error: 'Tag not found' }, 404);
      }
      return jsonResponse({ success: false, error: 'Failed to update tag' }, 500);
    }
  }, [authMiddleware]);

  // 删除标签 (需要认证)
  router.delete('/api/tags/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid tag ID' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      await tagService.deleteTag(id);
      
      return jsonResponse({ 
        success: true, 
        message: 'Tag deleted successfully' 
      });
    } catch (error) {
      console.error('Delete tag error:', error);
      return jsonResponse({ success: false, error: 'Failed to delete tag' }, 500);
    }
  }, [authMiddleware]);

  // 合并标签 (需要认证)
  router.post('/api/tags/:id/merge', async (request, env: Env, ctx, params) => {
    try {
      const sourceId = parseInt(params!.id);
      const { targetId } = (request as any).body as { targetId: number };
      
      if (isNaN(sourceId) || isNaN(targetId)) {
        return jsonResponse({ success: false, error: 'Invalid tag IDs' }, 400);
      }
      
      if (sourceId === targetId) {
        return jsonResponse({ success: false, error: 'Cannot merge tag with itself' }, 400);
      }
      
      const tagService = new TagService(env.DB);
      await tagService.mergeTags(sourceId, targetId);
      
      return jsonResponse({ 
        success: true, 
        message: 'Tags merged successfully' 
      });
    } catch (error) {
      console.error('Merge tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to merge tags' }, 500);
    }
  }, [authMiddleware]);

  // 获取标签统计信息 (需要认证)
  router.get('/api/admin/tags/stats', async (request, env: Env, ctx, params) => {
    try {
      const tagService = new TagService(env.DB);
      const stats = await tagService.getTagStats();
      
      return jsonResponse({ success: true, data: stats });
    } catch (error) {
      console.error('Get tag stats error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch tag stats' }, 500);
    }
  }, [authMiddleware]);

  // 清理未使用的标签 (需要认证)
  router.delete('/api/admin/tags/cleanup', async (request, env: Env, ctx, params) => {
    try {
      const tagService = new TagService(env.DB);
      const deletedCount = await tagService.cleanupUnusedTags();
      
      return jsonResponse({ 
        success: true, 
        data: { deletedCount },
        message: `Cleaned up ${deletedCount} unused tags` 
      });
    } catch (error) {
      console.error('Cleanup tags error:', error);
      return jsonResponse({ success: false, error: 'Failed to cleanup tags' }, 500);
    }
  }, [authMiddleware]);
}
