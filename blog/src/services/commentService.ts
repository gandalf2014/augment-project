/**
 * 评论服务
 */

import type { 
  Comment, 
  CommentWithReplies,
  CreateCommentRequest,
  CommentQueryParams,
  PaginatedResponse,
  Env 
} from '../types/database';
import { 
  buildPaginationQuery,
  buildPaginatedResponse,
  buildCommentQueryConditions,
  isValidEmail,
  isValidUrl,
  escapeHtml,
  stripHtml
} from '../utils/database';

export class CommentService {
  constructor(private db: D1Database) {}

  // 获取评论列表
  async getComments(params: CommentQueryParams = {}): Promise<PaginatedResponse<Comment>> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100); // 最大100条
    
    // 构建查询条件
    const { conditions, bindings } = buildCommentQueryConditions(params);
    
    // 基础查询
    let baseQuery = 'SELECT * FROM comments';
    
    // 添加条件
    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // 排序
    baseQuery += ' ORDER BY created_at DESC';
    
    // 分页
    const { query, offset } = buildPaginationQuery(baseQuery, page, limit);
    
    // 执行查询
    const result = await this.db.prepare(query)
      .bind(...bindings, limit, offset)
      .all<Comment>();
    
    // 构建计数查询
    let countQuery = 'SELECT COUNT(*) as count FROM comments';
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return buildPaginatedResponse(
      this.db,
      countQuery,
      bindings,
      result.results || [],
      page,
      limit
    );
  }

  // 获取文章的评论（包含回复）
  async getPostComments(postId: number, status: string = 'approved'): Promise<CommentWithReplies[]> {
    // 获取所有评论
    const result = await this.db.prepare(`
      SELECT * FROM comments 
      WHERE post_id = ? AND status = ?
      ORDER BY created_at ASC
    `).bind(postId, status).all<Comment>();
    
    const comments = result.results || [];
    
    // 构建评论树结构
    const commentMap = new Map<number, CommentWithReplies>();
    const rootComments: CommentWithReplies[] = [];
    
    // 初始化所有评论
    for (const comment of comments) {
      const commentWithReplies: CommentWithReplies = {
        ...comment,
        replies: []
      };
      commentMap.set(comment.id, commentWithReplies);
      
      if (!comment.parent_id) {
        rootComments.push(commentWithReplies);
      }
    }
    
    // 构建回复关系
    for (const comment of comments) {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        const current = commentMap.get(comment.id);
        if (parent && current) {
          parent.replies!.push(current);
        }
      }
    }
    
    return rootComments;
  }

  // 根据 ID 获取评论
  async getCommentById(id: number): Promise<Comment | null> {
    const result = await this.db.prepare(
      'SELECT * FROM comments WHERE id = ?'
    ).bind(id).first<Comment>();
    
    return result || null;
  }

  // 创建评论
  async createComment(data: CreateCommentRequest, authorIp?: string): Promise<Comment> {
    // 验证必填字段
    if (!data.post_id || !data.author_name || !data.author_email || !data.content) {
      throw new Error('Post ID, author name, email, and content are required');
    }
    
    // 验证邮箱格式
    if (!isValidEmail(data.author_email)) {
      throw new Error('Invalid email format');
    }
    
    // 验证网站 URL（如果提供）
    if (data.author_website && !isValidUrl(data.author_website)) {
      throw new Error('Invalid website URL');
    }
    
    // 检查文章是否存在
    const post = await this.db.prepare(
      'SELECT id FROM posts WHERE id = ?'
    ).bind(data.post_id).first();
    
    if (!post) {
      throw new Error('Post not found');
    }
    
    // 检查父评论是否存在（如果是回复）
    if (data.parent_id) {
      const parentComment = await this.getCommentById(data.parent_id);
      if (!parentComment) {
        throw new Error('Parent comment not found');
      }
      if (parentComment.post_id !== data.post_id) {
        throw new Error('Parent comment belongs to different post');
      }
    }
    
    // 清理和转义内容
    const cleanContent = escapeHtml(stripHtml(data.content.trim()));
    
    // 插入评论
    const result = await this.db.prepare(`
      INSERT INTO comments (
        post_id, parent_id, author_name, author_email, 
        author_website, author_ip, content, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.post_id,
      data.parent_id || null,
      data.author_name.trim(),
      data.author_email.trim(),
      data.author_website?.trim() || null,
      authorIp || null,
      cleanContent,
      'pending' // 默认需要审核
    ).run();
    
    const commentId = result.meta.last_row_id as number;
    
    // 返回创建的评论
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new Error('Failed to create comment');
    }
    
    return comment;
  }

  // 更新评论状态
  async updateCommentStatus(id: number, status: 'pending' | 'approved' | 'rejected' | 'spam'): Promise<Comment> {
    await this.db.prepare(
      'UPDATE comments SET status = ? WHERE id = ?'
    ).bind(status, id).run();
    
    const comment = await this.getCommentById(id);
    if (!comment) {
      throw new Error('Comment not found');
    }
    
    return comment;
  }

  // 批量更新评论状态
  async batchUpdateCommentStatus(ids: number[], status: 'pending' | 'approved' | 'rejected' | 'spam'): Promise<void> {
    if (ids.length === 0) return;
    
    const placeholders = ids.map(() => '?').join(',');
    await this.db.prepare(`
      UPDATE comments SET status = ? WHERE id IN (${placeholders})
    `).bind(status, ...ids).run();
  }

  // 删除评论
  async deleteComment(id: number): Promise<void> {
    // 删除评论及其所有回复
    await this.db.prepare(`
      DELETE FROM comments 
      WHERE id = ? OR parent_id = ?
    `).bind(id, id).run();
  }

  // 批量删除评论
  async batchDeleteComments(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    
    // 获取所有要删除的评论ID（包括回复）
    const allIds = new Set(ids);
    
    for (const id of ids) {
      const replies = await this.db.prepare(
        'SELECT id FROM comments WHERE parent_id = ?'
      ).bind(id).all<{ id: number }>();
      
      for (const reply of replies.results || []) {
        allIds.add(reply.id);
      }
    }
    
    const placeholders = Array.from(allIds).map(() => '?').join(',');
    await this.db.prepare(`
      DELETE FROM comments WHERE id IN (${placeholders})
    `).bind(...Array.from(allIds)).run();
  }

  // 获取评论统计信息
  async getCommentStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    spam: number;
  }> {
    const totalResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM comments'
    ).first<{ count: number }>();
    
    const pendingResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE status = "pending"'
    ).first<{ count: number }>();
    
    const approvedResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE status = "approved"'
    ).first<{ count: number }>();
    
    const rejectedResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE status = "rejected"'
    ).first<{ count: number }>();
    
    const spamResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE status = "spam"'
    ).first<{ count: number }>();
    
    return {
      total: totalResult?.count || 0,
      pending: pendingResult?.count || 0,
      approved: approvedResult?.count || 0,
      rejected: rejectedResult?.count || 0,
      spam: spamResult?.count || 0
    };
  }

  // 获取最新评论
  async getRecentComments(limit: number = 10, status: string = 'approved'): Promise<Comment[]> {
    const result = await this.db.prepare(`
      SELECT c.*, p.title as post_title, p.slug as post_slug
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id
      WHERE c.status = ?
      ORDER BY c.created_at DESC
      LIMIT ?
    `).bind(status, limit).all<any>();
    
    return result.results || [];
  }

  // 检查垃圾评论（简单的启发式检查）
  async checkSpam(comment: CreateCommentRequest): Promise<boolean> {
    const content = comment.content.toLowerCase();
    
    // 简单的垃圾评论检测规则
    const spamKeywords = [
      'viagra', 'casino', 'poker', 'lottery', 'winner',
      'click here', 'free money', 'make money', 'work from home'
    ];
    
    // 检查是否包含垃圾关键词
    for (const keyword of spamKeywords) {
      if (content.includes(keyword)) {
        return true;
      }
    }
    
    // 检查是否有过多的链接
    const linkCount = (content.match(/https?:\/\//g) || []).length;
    if (linkCount > 2) {
      return true;
    }
    
    // 检查是否重复字符过多
    if (/(.)\1{10,}/.test(content)) {
      return true;
    }
    
    return false;
  }

  // 获取用户的评论历史
  async getUserComments(email: string, limit: number = 20): Promise<Comment[]> {
    const result = await this.db.prepare(`
      SELECT * FROM comments 
      WHERE author_email = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(email, limit).all<Comment>();
    
    return result.results || [];
  }
}
