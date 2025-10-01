/**
 * 标签服务
 */

import type { 
  Tag, 
  CreateTagRequest,
  Env 
} from '../types/database';
import { 
  generateSlug, 
  ensureUniqueSlug,
  generateRandomColor
} from '../utils/database';

export class TagService {
  constructor(private db: D1Database) {}

  // 获取所有标签
  async getTags(limit?: number, minUsage?: number): Promise<Tag[]> {
    let query = 'SELECT * FROM tags';
    const conditions: string[] = [];
    const bindings: any[] = [];
    
    if (minUsage !== undefined) {
      conditions.push('usage_count >= ?');
      bindings.push(minUsage);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' ORDER BY usage_count DESC, name ASC';
    
    if (limit) {
      query += ' LIMIT ?';
      bindings.push(limit);
    }
    
    const result = await this.db.prepare(query).bind(...bindings).all<Tag>();
    return result.results || [];
  }

  // 根据 ID 获取标签
  async getTagById(id: number): Promise<Tag | null> {
    const result = await this.db.prepare(
      'SELECT * FROM tags WHERE id = ?'
    ).bind(id).first<Tag>();
    
    return result || null;
  }

  // 根据 slug 获取标签
  async getTagBySlug(slug: string): Promise<Tag | null> {
    const result = await this.db.prepare(
      'SELECT * FROM tags WHERE slug = ?'
    ).bind(slug).first<Tag>();
    
    return result || null;
  }

  // 根据名称获取标签
  async getTagByName(name: string): Promise<Tag | null> {
    const result = await this.db.prepare(
      'SELECT * FROM tags WHERE name = ?'
    ).bind(name).first<Tag>();
    
    return result || null;
  }

  // 搜索标签
  async searchTags(query: string, limit: number = 10): Promise<Tag[]> {
    const searchTerm = `%${query}%`;
    const result = await this.db.prepare(`
      SELECT * FROM tags 
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY usage_count DESC, name ASC
      LIMIT ?
    `).bind(searchTerm, searchTerm, limit).all<Tag>();
    
    return result.results || [];
  }

  // 创建标签
  async createTag(data: CreateTagRequest): Promise<Tag> {
    // 生成 slug
    const slug = data.slug || generateSlug(data.name);
    const uniqueSlug = await ensureUniqueSlug(this.db, 'tags', slug);
    
    // 生成颜色（如果没有提供）
    const color = data.color || generateRandomColor();
    
    // 插入标签
    const result = await this.db.prepare(`
      INSERT INTO tags (name, slug, description, color)
      VALUES (?, ?, ?, ?)
    `).bind(
      data.name,
      uniqueSlug,
      data.description || null,
      color
    ).run();
    
    const tagId = result.meta.last_row_id as number;
    
    // 返回创建的标签
    const tag = await this.getTagById(tagId);
    if (!tag) {
      throw new Error('Failed to create tag');
    }
    
    return tag;
  }

  // 更新标签
  async updateTag(id: number, data: Partial<CreateTagRequest>): Promise<Tag> {
    // 构建更新字段
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
      
      // 如果更新了名称且没有提供新的 slug，则重新生成
      if (data.slug === undefined) {
        const newSlug = generateSlug(data.name);
        const uniqueSlug = await ensureUniqueSlug(this.db, 'tags', newSlug, id);
        fields.push('slug = ?');
        values.push(uniqueSlug);
      }
    }
    
    if (data.slug !== undefined) {
      const uniqueSlug = await ensureUniqueSlug(this.db, 'tags', data.slug, id);
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
    
    // 执行更新
    if (fields.length > 0) {
      await this.db.prepare(`
        UPDATE tags SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values, id).run();
    }
    
    // 返回更新后的标签
    const tag = await this.getTagById(id);
    if (!tag) {
      throw new Error('Tag not found');
    }
    
    return tag;
  }

  // 删除标签
  async deleteTag(id: number): Promise<void> {
    // 删除标签会自动删除关联关系（由于外键约束）
    await this.db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  }

  // 批量创建标签（如果不存在）
  async createTagsIfNotExist(tagNames: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];
    
    for (const name of tagNames) {
      // 检查标签是否已存在
      let tag = await this.getTagByName(name.trim());
      
      if (!tag) {
        // 创建新标签
        tag = await this.createTag({ name: name.trim() });
      }
      
      tags.push(tag);
    }
    
    return tags;
  }

  // 获取热门标签
  async getPopularTags(limit: number = 20): Promise<Tag[]> {
    const result = await this.db.prepare(`
      SELECT * FROM tags 
      WHERE usage_count > 0
      ORDER BY usage_count DESC, name ASC
      LIMIT ?
    `).bind(limit).all<Tag>();
    
    return result.results || [];
  }

  // 获取相关标签（基于共同出现的文章）
  async getRelatedTags(tagId: number, limit: number = 10): Promise<Tag[]> {
    const result = await this.db.prepare(`
      SELECT t.*, COUNT(*) as relation_count
      FROM tags t
      JOIN post_tags pt1 ON t.id = pt1.tag_id
      JOIN post_tags pt2 ON pt1.post_id = pt2.post_id
      WHERE pt2.tag_id = ? AND t.id != ?
      GROUP BY t.id
      ORDER BY relation_count DESC, t.usage_count DESC
      LIMIT ?
    `).bind(tagId, tagId, limit).all<Tag>();
    
    return result.results || [];
  }

  // 获取标签统计信息
  async getTagStats(): Promise<{
    total: number;
    used: number;
    totalUsage: number;
    averageUsage: number;
  }> {
    const totalResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM tags'
    ).first<{ count: number }>();
    
    const usedResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM tags WHERE usage_count > 0'
    ).first<{ count: number }>();
    
    const usageResult = await this.db.prepare(
      'SELECT SUM(usage_count) as total, AVG(usage_count) as average FROM tags'
    ).first<{ total: number; average: number }>();
    
    return {
      total: totalResult?.count || 0,
      used: usedResult?.count || 0,
      totalUsage: usageResult?.total || 0,
      averageUsage: Math.round((usageResult?.average || 0) * 100) / 100
    };
  }

  // 清理未使用的标签
  async cleanupUnusedTags(): Promise<number> {
    const result = await this.db.prepare(
      'DELETE FROM tags WHERE usage_count = 0'
    ).run();
    
    return result.meta.changes || 0;
  }

  // 合并标签
  async mergeTags(sourceTagId: number, targetTagId: number): Promise<void> {
    // 将源标签的所有文章关联转移到目标标签
    await this.db.prepare(`
      UPDATE OR IGNORE post_tags 
      SET tag_id = ? 
      WHERE tag_id = ?
    `).bind(targetTagId, sourceTagId).run();
    
    // 删除重复的关联
    await this.db.prepare(`
      DELETE FROM post_tags 
      WHERE tag_id = ?
    `).bind(sourceTagId).run();
    
    // 删除源标签
    await this.deleteTag(sourceTagId);
  }
}
