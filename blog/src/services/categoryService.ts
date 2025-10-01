/**
 * 分类服务
 */

import type { 
  Category, 
  CreateCategoryRequest,
  Env 
} from '../types/database';
import { 
  generateSlug, 
  ensureUniqueSlug,
  generateRandomColor
} from '../utils/database';

export class CategoryService {
  constructor(private db: D1Database) {}

  // 获取所有分类
  async getCategories(includeInactive: boolean = false): Promise<Category[]> {
    let query = `
      SELECT c.*, COUNT(p.id) as post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
    `;
    
    if (!includeInactive) {
      query += ' WHERE c.is_active = 1';
    }
    
    query += ' GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC';
    
    const result = await this.db.prepare(query).all<any>();
    return result.results || [];
  }

  // 根据 ID 获取分类
  async getCategoryById(id: number): Promise<Category | null> {
    const result = await this.db.prepare(`
      SELECT c.*, COUNT(p.id) as post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
      WHERE c.id = ?
      GROUP BY c.id
    `).bind(id).first<Category>();
    
    return result || null;
  }

  // 根据 slug 获取分类
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const result = await this.db.prepare(`
      SELECT c.*, COUNT(p.id) as post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
      WHERE c.slug = ? AND c.is_active = 1
      GROUP BY c.id
    `).bind(slug).first<Category>();
    
    return result || null;
  }

  // 创建分类
  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    // 生成 slug
    const slug = data.slug || generateSlug(data.name);
    const uniqueSlug = await ensureUniqueSlug(this.db, 'categories', slug);
    
    // 生成颜色（如果没有提供）
    const color = data.color || generateRandomColor();
    
    // 获取下一个排序位置
    const maxSortResult = await this.db.prepare(
      'SELECT MAX(sort_order) as max_sort FROM categories'
    ).first<{ max_sort: number }>();
    
    const sortOrder = data.sort_order !== undefined ? 
      data.sort_order : 
      (maxSortResult?.max_sort || 0) + 1;
    
    // 插入分类
    const result = await this.db.prepare(`
      INSERT INTO categories (name, slug, description, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      data.name,
      uniqueSlug,
      data.description || null,
      color,
      sortOrder
    ).run();
    
    const categoryId = result.meta.last_row_id as number;
    
    // 返回创建的分类
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Failed to create category');
    }
    
    return category;
  }

  // 更新分类
  async updateCategory(id: number, data: Partial<CreateCategoryRequest>): Promise<Category> {
    // 构建更新字段
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
      
      // 如果更新了名称且没有提供新的 slug，则重新生成
      if (data.slug === undefined) {
        const newSlug = generateSlug(data.name);
        const uniqueSlug = await ensureUniqueSlug(this.db, 'categories', newSlug, id);
        fields.push('slug = ?');
        values.push(uniqueSlug);
      }
    }
    
    if (data.slug !== undefined) {
      const uniqueSlug = await ensureUniqueSlug(this.db, 'categories', data.slug, id);
      fields.push('slug = ?');
      values.push(uniqueSlug);
    }
    
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    
    if (data.color !== undefined) {
      fields.push('color = ?');
      values.push(data.color);
    }
    
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    
    // 执行更新
    if (fields.length > 0) {
      await this.db.prepare(`
        UPDATE categories SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values, id).run();
    }
    
    // 返回更新后的分类
    const category = await this.getCategoryById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    
    return category;
  }

  // 删除分类
  async deleteCategory(id: number): Promise<void> {
    // 检查是否有文章使用此分类
    const postCount = await this.db.prepare(
      'SELECT COUNT(*) as count FROM posts WHERE category_id = ?'
    ).bind(id).first<{ count: number }>();
    
    if (postCount && postCount.count > 0) {
      throw new Error('Cannot delete category with associated posts');
    }
    
    await this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  }

  // 切换分类状态
  async toggleCategoryStatus(id: number): Promise<Category> {
    await this.db.prepare(`
      UPDATE categories 
      SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END 
      WHERE id = ?
    `).bind(id).run();
    
    const category = await this.getCategoryById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    
    return category;
  }

  // 重新排序分类
  async reorderCategories(categoryIds: number[]): Promise<void> {
    for (let i = 0; i < categoryIds.length; i++) {
      await this.db.prepare(
        'UPDATE categories SET sort_order = ? WHERE id = ?'
      ).bind(i + 1, categoryIds[i]).run();
    }
  }

  // 获取分类统计信息
  async getCategoryStats(): Promise<{
    total: number;
    active: number;
    withPosts: number;
  }> {
    const totalResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM categories'
    ).first<{ count: number }>();
    
    const activeResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM categories WHERE is_active = 1'
    ).first<{ count: number }>();
    
    const withPostsResult = await this.db.prepare(`
      SELECT COUNT(DISTINCT c.id) as count 
      FROM categories c 
      JOIN posts p ON c.id = p.category_id 
      WHERE p.status = 'published'
    `).first<{ count: number }>();
    
    return {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      withPosts: withPostsResult?.count || 0
    };
  }
}
