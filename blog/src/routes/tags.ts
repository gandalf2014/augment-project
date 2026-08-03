/**
 * 标签相关路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { TagService } from '../services/tagService';
import { authMiddleware, adminMiddleware, jsonResponse, getRequestBody } from '../middleware';
import { validate, CreateTagSchema, UpdateTagSchema } from '../utils/validation';
import { NotFoundError, ValidationError } from '../utils/errors';

export function registerTagRoutes(router: Router) {

  // 获取标签列表 (公开)
  router.get('/api/tags', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    const minUsage = url.searchParams.get('min_usage') ? parseInt(url.searchParams.get('min_usage')!) : undefined;

    const tagService = new TagService(env.DB);
    const tags = await tagService.getTags(limit, minUsage);

    return jsonResponse({ success: true, data: tags });
  });

  // 搜索标签 (公开)
  router.get('/api/tags/search', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query) {
      throw new ValidationError('请输入搜索关键词');
    }

    const tagService = new TagService(env.DB);
    const tags = await tagService.searchTags(query, limit);

    return jsonResponse({ success: true, data: tags });
  });

  // 获取热门标签 (公开)
  router.get('/api/tags/popular', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const tagService = new TagService(env.DB);
    const tags = await tagService.getPopularTags(limit);

    return jsonResponse({ success: true, data: tags });
  });

  // 根据 ID 获取标签 (公开)
  router.get('/api/tags/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的标签ID');
    }

    const tagService = new TagService(env.DB);
    const tag = await tagService.getTagById(id);

    if (!tag) {
      throw new NotFoundError('Tag', id);
    }

    return jsonResponse({ success: true, data: tag });
  });

  // 根据 slug 获取标签 (公开)
  router.get('/api/tags/slug/:slug', async (request, env: Env, ctx, params) => {
    const slug = params!.slug;

    const tagService = new TagService(env.DB);
    const tag = await tagService.getTagBySlug(slug);

    if (!tag) {
      throw new NotFoundError('Tag', slug);
    }

    return jsonResponse({ success: true, data: tag });
  });

  // 获取相关标签 (公开)
  router.get('/api/tags/:id/related', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (isNaN(id)) {
      throw new ValidationError('无效的标签ID');
    }

    const tagService = new TagService(env.DB);
    const tags = await tagService.getRelatedTags(id, limit);

    return jsonResponse({ success: true, data: tags });
  });

  // 创建标签 (需要认证)
  router.post('/api/tags', async (request, env: Env, ctx, params) => {
    const rawData = getRequestBody(ctx);
    const data = validate(CreateTagSchema, rawData);

    const tagService = new TagService(env.DB);
    const tag = await tagService.createTag(data);

    return jsonResponse({
      success: true,
      data: tag,
      message: '标签创建成功'
    }, 201);
  }, [authMiddleware]);

  // 批量创建标签 (需要认证)
  router.post('/api/tags/batch', async (request, env: Env, ctx, params) => {
    const { names } = getRequestBody(ctx) as { names: string[] };

    if (!names || !Array.isArray(names) || names.length === 0) {
      throw new ValidationError('请提供标签名称列表');
    }

    const tagService = new TagService(env.DB);
    const tags = await tagService.createTagsIfNotExist(names);

    return jsonResponse({
      success: true,
      data: tags,
      message: '标签创建成功'
    }, 201);
  }, [authMiddleware]);

  // 更新标签 (需要认证)
  router.put('/api/tags/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的标签ID');
    }

    const rawData = getRequestBody(ctx);
    const data = validate(UpdateTagSchema, rawData);

    const tagService = new TagService(env.DB);

    try {
      const tag = await tagService.updateTag(id, data);
      return jsonResponse({
        success: true,
        data: tag,
        message: '标签更新成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Tag not found') {
        throw new NotFoundError('Tag', id);
      }
      throw error;
    }
  }, [authMiddleware]);

  // 删除标签 (需要认证)
  router.delete('/api/tags/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的标签ID');
    }

    const tagService = new TagService(env.DB);
    await tagService.deleteTag(id);

    return jsonResponse({
      success: true,
      message: '标签删除成功'
    });
  }, [authMiddleware]);

  // 合并标签 (需要认证)
  router.post('/api/tags/:id/merge', async (request, env: Env, ctx, params) => {
    const sourceId = parseInt(params!.id);
    const { targetId } = getRequestBody(ctx) as { targetId: number };

    if (isNaN(sourceId) || isNaN(targetId)) {
      throw new ValidationError('无效的标签ID');
    }

    if (sourceId === targetId) {
      throw new ValidationError('不能将标签合并到自身');
    }

    const tagService = new TagService(env.DB);
    await tagService.mergeTags(sourceId, targetId);

    return jsonResponse({
      success: true,
      message: '标签合并成功'
    });
  }, [authMiddleware, adminMiddleware]);

  // 获取标签统计信息
  router.get('/api/admin/tags/stats', async (request, env: Env, ctx, params) => {
    const tagService = new TagService(env.DB);
    const stats = await tagService.getTagStats();

    return jsonResponse({ success: true, data: stats });
  }, [authMiddleware]);

  // 清理未使用的标签
  router.delete('/api/admin/tags/cleanup', async (request, env: Env, ctx, params) => {
    const tagService = new TagService(env.DB);
    const deletedCount = await tagService.cleanupUnusedTags();

    return jsonResponse({
      success: true,
      data: { deletedCount },
      message: `已清理 ${deletedCount} 个未使用的标签`
    });
  }, [authMiddleware, adminMiddleware]);
}