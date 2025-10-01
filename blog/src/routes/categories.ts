/**
 * 分类相关路由
 */

import type { Router } from '../utils/router';
import type { Env, CreateCategoryRequest } from '../types/database';
import { CategoryService } from '../services/categoryService';
import { authMiddleware, jsonResponse } from '../middleware';

export function registerCategoryRoutes(router: Router) {
  
  // 获取分类列表 (公开)
  router.get('/api/categories', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const includeInactive = url.searchParams.get('include_inactive') === 'true';
      
      const categoryService = new CategoryService(env.DB);
      const categories = await categoryService.getCategories(includeInactive);
      
      return jsonResponse({ success: true, data: categories });
    } catch (error) {
      console.error('Get categories error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch categories' }, 500);
    }
  });

  // 根据 ID 获取分类 (公开)
  router.get('/api/categories/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid category ID' }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.getCategoryById(id);
      
      if (!category) {
        return jsonResponse({ success: false, error: 'Category not found' }, 404);
      }
      
      return jsonResponse({ success: true, data: category });
    } catch (error) {
      console.error('Get category error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch category' }, 500);
    }
  });

  // 根据 slug 获取分类 (公开)
  router.get('/api/categories/slug/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.getCategoryBySlug(slug);
      
      if (!category) {
        return jsonResponse({ success: false, error: 'Category not found' }, 404);
      }
      
      return jsonResponse({ success: true, data: category });
    } catch (error) {
      console.error('Get category by slug error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch category' }, 500);
    }
  });

  // 创建分类 (需要认证)
  router.post('/api/categories', async (request, env: Env, ctx, params) => {
    try {
      const data = (ctx as any).requestBody as CreateCategoryRequest;
      
      // 验证必填字段
      if (!data.name) {
        return jsonResponse({ 
          success: false, 
          error: 'Category name is required' 
        }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.createCategory(data);
      
      return jsonResponse({ 
        success: true, 
        data: category,
        message: 'Category created successfully' 
      }, 201);
    } catch (error) {
      console.error('Create category error:', error);
      return jsonResponse({ success: false, error: 'Failed to create category' }, 500);
    }
  }, [authMiddleware]);

  // 更新分类 (需要认证)
  router.put('/api/categories/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      const data = (ctx as any).requestBody as Partial<CreateCategoryRequest>;
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid category ID' }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.updateCategory(id, data);
      
      return jsonResponse({ 
        success: true, 
        data: category,
        message: 'Category updated successfully' 
      });
    } catch (error) {
      console.error('Update category error:', error);
      if (error instanceof Error && error.message === 'Category not found') {
        return jsonResponse({ success: false, error: 'Category not found' }, 404);
      }
      return jsonResponse({ success: false, error: 'Failed to update category' }, 500);
    }
  }, [authMiddleware]);

  // 删除分类 (需要认证)
  router.delete('/api/categories/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid category ID' }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      await categoryService.deleteCategory(id);
      
      return jsonResponse({ 
        success: true, 
        message: 'Category deleted successfully' 
      });
    } catch (error) {
      console.error('Delete category error:', error);
      if (error instanceof Error && error.message.includes('associated posts')) {
        return jsonResponse({ 
          success: false, 
          error: 'Cannot delete category with associated posts' 
        }, 400);
      }
      return jsonResponse({ success: false, error: 'Failed to delete category' }, 500);
    }
  }, [authMiddleware]);

  // 切换分类状态 (需要认证)
  router.patch('/api/categories/:id/toggle', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid category ID' }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.toggleCategoryStatus(id);
      
      return jsonResponse({ 
        success: true, 
        data: category,
        message: 'Category status updated successfully' 
      });
    } catch (error) {
      console.error('Toggle category status error:', error);
      if (error instanceof Error && error.message === 'Category not found') {
        return jsonResponse({ success: false, error: 'Category not found' }, 404);
      }
      return jsonResponse({ success: false, error: 'Failed to update category status' }, 500);
    }
  }, [authMiddleware]);

  // 重新排序分类 (需要认证)
  router.patch('/api/categories/reorder', async (request, env: Env, ctx, params) => {
    try {
      const { categoryIds } = (request as any).body as { categoryIds: number[] };
      
      if (!categoryIds || !Array.isArray(categoryIds)) {
        return jsonResponse({ success: false, error: 'Invalid category IDs' }, 400);
      }
      
      const categoryService = new CategoryService(env.DB);
      await categoryService.reorderCategories(categoryIds);
      
      return jsonResponse({ 
        success: true, 
        message: 'Categories reordered successfully' 
      });
    } catch (error) {
      console.error('Reorder categories error:', error);
      return jsonResponse({ success: false, error: 'Failed to reorder categories' }, 500);
    }
  }, [authMiddleware]);

  // 获取分类统计信息 (需要认证)
  router.get('/api/admin/categories/stats', async (request, env: Env, ctx, params) => {
    try {
      const categoryService = new CategoryService(env.DB);
      const stats = await categoryService.getCategoryStats();
      
      return jsonResponse({ success: true, data: stats });
    } catch (error) {
      console.error('Get category stats error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch category stats' }, 500);
    }
  }, [authMiddleware]);
}
