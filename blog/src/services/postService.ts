/**
 * 文章服务
 */

import type { 
  Post, 
  PostWithDetails, 
  CreatePostRequest, 
  UpdatePostRequest,
  PostQueryParams,
  PaginatedResponse,
  Env 
} from '../types/database';
import { 
  generateSlug, 
  ensureUniqueSlug, 
  buildPaginationQuery,
  buildPaginatedResponse,
  buildPostQueryConditions,
  extractExcerpt,
  formatDate
} from '../utils/database';

export class PostService {
  constructor(private db: D1Database) {}

  // 获取文章列表
  async getPosts(params: PostQueryParams = {}): Promise<PaginatedResponse<PostWithDetails>> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 10, 50); // 最大50条
    
    // 构建查询条件
    const { conditions, bindings } = buildPostQueryConditions(params);
    
    // 基础查询
    let baseQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        u.display_name as author_name,
        u.username as author_username
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
    `;
    
    // 添加条件
    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // 排序
    baseQuery += ' ORDER BY p.published_at DESC, p.created_at DESC';
    
    // 分页
    const { query, offset } = buildPaginationQuery(baseQuery, page, limit);
    
    // 执行查询
    const result = await this.db.prepare(query)
      .bind(...bindings, limit, offset)
      .all<any>();
    
    // 获取文章标签
    const posts = await this.attachTagsToPosts(result.results || []);
    
    // 构建计数查询
    let countQuery = `
      SELECT COUNT(*) as count
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return buildPaginatedResponse(
      this.db,
      countQuery,
      bindings,
      posts,
      page,
      limit
    );
  }

  // 根据 ID 获取文章
  async getPostById(id: number): Promise<PostWithDetails | null> {
    const result = await this.db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        u.display_name as author_name,
        u.username as author_username,
        u.avatar_url as author_avatar
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).bind(id).first<any>();
    
    if (!result) return null;
    
    const posts = await this.attachTagsToPosts([result]);
    return posts[0] || null;
  }

  // 根据 slug 获取文章
  async getPostBySlug(slug: string): Promise<PostWithDetails | null> {
    const result = await this.db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        u.display_name as author_name,
        u.username as author_username,
        u.avatar_url as author_avatar
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.slug = ? AND p.status = 'published'
    `).bind(slug).first<any>();
    
    if (!result) return null;
    
    const posts = await this.attachTagsToPosts([result]);
    return posts[0] || null;
  }

  // 创建文章
  async createPost(data: CreatePostRequest, authorId: number): Promise<PostWithDetails> {
    // 生成 slug
    const slug = data.slug || generateSlug(data.title);
    const uniqueSlug = await ensureUniqueSlug(this.db, 'posts', slug);
    
    // 生成摘要（如果没有提供）
    const excerpt = data.excerpt || extractExcerpt(data.content);
    
    // 插入文章
    const result = await this.db.prepare(`
      INSERT INTO posts (
        title, slug, excerpt, content, featured_image, 
        category_id, author_id, status, is_featured, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.title,
      uniqueSlug,
      excerpt,
      data.content,
      data.featured_image || null,
      data.category_id || null,
      authorId,
      data.status || 'draft',
      data.is_featured ? 1 : 0,
      data.status === 'published' ? (data.published_at || formatDate(new Date())) : null
    ).run();
    
    const postId = result.meta.last_row_id as number;
    
    // 添加标签关联
    if (data.tag_ids && data.tag_ids.length > 0) {
      await this.addTagsToPost(postId, data.tag_ids);
    }
    
    // 返回创建的文章
    const post = await this.getPostById(postId);
    if (!post) {
      throw new Error('Failed to create post');
    }
    
    return post;
  }

  // 更新文章
  async updatePost(data: UpdatePostRequest): Promise<PostWithDetails> {
    const { id, tag_ids, ...updateData } = data;
    
    // 构建更新字段
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updateData.title !== undefined) {
      fields.push('title = ?');
      values.push(updateData.title);
      
      // 如果更新了标题且没有提供新的 slug，则重新生成
      if (updateData.slug === undefined) {
        const newSlug = generateSlug(updateData.title);
        const uniqueSlug = await ensureUniqueSlug(this.db, 'posts', newSlug, id);
        fields.push('slug = ?');
        values.push(uniqueSlug);
      }
    }
    
    if (updateData.slug !== undefined) {
      const uniqueSlug = await ensureUniqueSlug(this.db, 'posts', updateData.slug, id);
      fields.push('slug = ?');
      values.push(uniqueSlug);
    }
    
    if (updateData.excerpt !== undefined) {
      fields.push('excerpt = ?');
      values.push(updateData.excerpt);
    }
    
    if (updateData.content !== undefined) {
      fields.push('content = ?');
      values.push(updateData.content);
      
      // 如果更新了内容且没有提供摘要，则重新生成
      if (updateData.excerpt === undefined) {
        fields.push('excerpt = ?');
        values.push(extractExcerpt(updateData.content));
      }
    }
    
    if (updateData.featured_image !== undefined) {
      fields.push('featured_image = ?');
      values.push(updateData.featured_image);
    }
    
    if (updateData.category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(updateData.category_id);
    }
    
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
      
      // 如果状态改为已发布且没有发布时间，则设置当前时间
      if (updateData.status === 'published' && updateData.published_at === undefined) {
        fields.push('published_at = ?');
        values.push(formatDate(new Date()));
      }
    }
    
    if (updateData.is_featured !== undefined) {
      fields.push('is_featured = ?');
      values.push(updateData.is_featured ? 1 : 0);
    }
    
    if (updateData.published_at !== undefined) {
      fields.push('published_at = ?');
      values.push(updateData.published_at);
    }
    
    // 执行更新
    if (fields.length > 0) {
      await this.db.prepare(`
        UPDATE posts SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values, id).run();
    }
    
    // 更新标签关联
    if (tag_ids !== undefined) {
      await this.updatePostTags(id, tag_ids);
    }
    
    // 返回更新后的文章
    const post = await this.getPostById(id);
    if (!post) {
      throw new Error('Post not found');
    }
    
    return post;
  }

  // 删除文章
  async deletePost(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  }

  // 增加浏览量
  async incrementViewCount(id: number): Promise<void> {
    await this.db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?')
      .bind(id).run();
  }

  // 为文章附加标签信息
  private async attachTagsToPosts(posts: any[]): Promise<PostWithDetails[]> {
    if (posts.length === 0) return [];
    
    const postIds = posts.map(p => p.id);
    const placeholders = postIds.map(() => '?').join(',');
    
    const tagsResult = await this.db.prepare(`
      SELECT pt.post_id, t.id, t.name, t.slug, t.color
      FROM post_tags pt
      JOIN tags t ON pt.tag_id = t.id
      WHERE pt.post_id IN (${placeholders})
      ORDER BY t.name
    `).bind(...postIds).all<any>();
    
    // 按文章ID分组标签
    const tagsByPost: Record<number, any[]> = {};
    for (const tag of tagsResult.results || []) {
      if (!tagsByPost[tag.post_id]) {
        tagsByPost[tag.post_id] = [];
      }
      tagsByPost[tag.post_id].push({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color
      });
    }
    
    // 转换为 PostWithDetails 格式
    return posts.map(post => ({
      ...post,
      category: post.category_name ? {
        id: post.category_id,
        name: post.category_name,
        slug: post.category_slug,
        color: post.category_color
      } : undefined,
      author: {
        id: post.author_id,
        username: post.author_username,
        display_name: post.author_name,
        avatar_url: post.author_avatar
      },
      tags: tagsByPost[post.id] || []
    }));
  }

  // 为文章添加标签
  private async addTagsToPost(postId: number, tagIds: number[]): Promise<void> {
    if (tagIds.length === 0) return;
    
    const values = tagIds.map(tagId => `(${postId}, ${tagId})`).join(',');
    await this.db.prepare(`
      INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES ${values}
    `).run();
  }

  // 更新文章标签
  private async updatePostTags(postId: number, tagIds: number[]): Promise<void> {
    // 删除现有标签关联
    await this.db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId).run();
    
    // 添加新的标签关联
    if (tagIds.length > 0) {
      await this.addTagsToPost(postId, tagIds);
    }
  }
}
