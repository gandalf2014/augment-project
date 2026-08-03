/**
 * 分类相关路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { CategoryService } from '../services/categoryService';
import { authMiddleware, adminMiddleware, jsonResponse, getRequestBody } from '../middleware';
import { validate, CreateCategorySchema, UpdateCategorySchema } from '../utils/validation';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

export function registerCategoryRoutes(router: Router) {

  // 获取分类列表 (公开)
  router.get('/api/categories', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';

    const categoryService = new CategoryService(env.DB);
    const categories = await categoryService.getCategories(includeInactive);

    return jsonResponse({ success: true, data: categories });
  });

  // 根据 ID 获取分类 (公开)
  router.get('/api/categories/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的分类ID');
    }

    const categoryService = new CategoryService(env.DB);
    const category = await categoryService.getCategoryById(id);

    if (!category) {
      throw new NotFoundError('Category', id);
    }

    return jsonResponse({ success: true, data: category });
  });

  // 根据 slug 获取分类 (公开)
  router.get('/api/categories/slug/:slug', async (request, env: Env, ctx, params) => {
    const slug = params!.slug;

    const categoryService = new CategoryService(env.DB);
    const category = await categoryService.getCategoryBySlug(slug);

    if (!category) {
      throw new NotFoundError('Category', slug);
    }

    return jsonResponse({ success: true, data: category });
  });

  // 创建分类 (需要认证)
  router.post('/api/categories', async (request, env: Env, ctx, params) => {
    const rawData = getRequestBody(ctx);
    const data = validate(CreateCategorySchema, rawData);

    const categoryService = new CategoryService(env.DB);

    try {
      const category = await categoryService.createCategory(data);
      return jsonResponse({
        success: true,
        data: category,
        message: '分类创建成功'
      }, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictError('分类名称已存在');
      }
      throw error;
    }
  }, [authMiddleware]);

  // 更新分类 (需要认证)
  router.put('/api/categories/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的分类ID');
    }

    const rawData = getRequestBody(ctx);
    const data = validate(UpdateCategorySchema, rawData);

    const categoryService = new CategoryService(env.DB);

    try {
      const category = await categoryService.updateCategory(id, data);
      return jsonResponse({
        success: true,
        data: category,
        message: '分类更新成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Category not found') {
        throw new NotFoundError('Category', id);
      }
      throw error;
    }
  }, [authMiddleware]);

  // 删除分类 (需要认证)
  router.delete('/api/categories/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的分类ID');
    }

    const categoryService = new CategoryService(env.DB);

    try {
      await categoryService.deleteCategory(id);
      return jsonResponse({
        success: true,
        message: '分类删除成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('associated posts')) {
        throw new ValidationError('无法删除有关联文章的分类');
      }
      throw error;
    }
  }, [authMiddleware]);

  // 切换分类状态 (需要认证)
  router.patch('/api/categories/:id/toggle', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的分类ID');
    }

    const categoryService = new CategoryService(env.DB);

    try {
      const category = await categoryService.toggleCategoryStatus(id);
      return jsonResponse({
        success: true,
        data: category,
        message: '分类状态已更新'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Category not found') {
        throw new NotFoundError('Category', id);
      }
      throw error;
    }
  }, [authMiddleware]);

  // 重新排序分类 (需要认证)
  router.patch('/api/categories/reorder', async (request, env: Env, ctx, params) => {
    const { categoryIds } = getRequestBody(ctx) as { categoryIds: number[] };

    if (!categoryIds || !Array.isArray(categoryIds)) {
      throw new ValidationError('无效的分类ID列表');
    }

    const categoryService = new CategoryService(env.DB);
    await categoryService.reorderCategories(categoryIds);

    return jsonResponse({
      success: true,
      message: '分类排序已更新'
    });
  }, [authMiddleware]);

  // 获取分类统计信息
  router.get('/api/admin/categories/stats', async (request, env: Env, ctx, params) => {
    const categoryService = new CategoryService(env.DB);
    const stats = await categoryService.getCategoryStats();

    return jsonResponse({ success: true, data: stats });
  }, [authMiddleware]);
}