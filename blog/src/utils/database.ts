/**
 * 数据库工具函数
 */

import type { 
  PaginatedResponse, 
  PostQueryParams, 
  CommentQueryParams 
} from '../types/database';

// 生成 slug
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/[\s_-]+/g, '-') // 替换空格和下划线为连字符
    .replace(/^-+|-+$/g, ''); // 移除开头和结尾的连字符
}

// 确保 slug 唯一性
export async function ensureUniqueSlug(
  db: D1Database, 
  table: string, 
  baseSlug: string, 
  excludeId?: number
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    let query = `SELECT id FROM ${table} WHERE slug = ?`;
    const params = [slug];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId.toString());
    }
    
    const result = await db.prepare(query).bind(...params).first();
    
    if (!result) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// 构建分页查询
export function buildPaginationQuery(
  baseQuery: string,
  page: number = 1,
  limit: number = 10
): { query: string; offset: number; limit: number } {
  const offset = (page - 1) * limit;
  const query = `${baseQuery} LIMIT ? OFFSET ?`;
  
  return { query, offset, limit };
}

// 构建分页响应
export async function buildPaginatedResponse<T>(
  db: D1Database,
  countQuery: string,
  countParams: any[],
  data: T[],
  page: number,
  limit: number
): Promise<PaginatedResponse<T>> {
  // 获取总数
  const countResult = await db.prepare(countQuery).bind(...countParams).first<{ count: number }>();
  const total = countResult?.count || 0;
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// 构建文章查询条件
export function buildPostQueryConditions(params: PostQueryParams): {
  conditions: string[];
  bindings: any[];
} {
  const conditions: string[] = [];
  const bindings: any[] = [];
  
  if (params.status) {
    conditions.push('p.status = ?');
    bindings.push(params.status);
  }
  
  if (params.category) {
    conditions.push('c.slug = ?');
    bindings.push(params.category);
  }
  
  if (params.tag) {
    conditions.push('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.slug = ?)');
    bindings.push(params.tag);
  }
  
  if (params.search) {
    conditions.push('(p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)');
    const searchTerm = `%${params.search}%`;
    bindings.push(searchTerm, searchTerm, searchTerm);
  }
  
  if (params.featured !== undefined) {
    conditions.push('p.is_featured = ?');
    bindings.push(params.featured ? 1 : 0);
  }
  
  if (params.author) {
    conditions.push('p.author_id = ?');
    bindings.push(params.author);
  }
  
  return { conditions, bindings };
}

// 构建评论查询条件
export function buildCommentQueryConditions(params: CommentQueryParams): {
  conditions: string[];
  bindings: any[];
} {
  const conditions: string[] = [];
  const bindings: any[] = [];
  
  if (params.post_id) {
    conditions.push('post_id = ?');
    bindings.push(params.post_id);
  }
  
  if (params.status) {
    conditions.push('status = ?');
    bindings.push(params.status);
  }
  
  return { conditions, bindings };
}

// 格式化日期
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// 截取文本
export function truncateText(text: string, length: number = 150): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

// 提取文章摘要
export function extractExcerpt(content: string, length: number = 200): string {
  // 移除 Markdown 标记
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // 移除标题标记
    .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
    .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
    .replace(/`(.*?)`/g, '$1') // 移除代码标记
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // 移除图片
    .replace(/\n+/g, ' ') // 替换换行为空格
    .trim();
  
  return truncateText(plainText, length);
}

// 验证邮箱格式
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证 URL 格式
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 清理 HTML 标签
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// 转义 HTML 特殊字符
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 生成随机颜色
export function generateRandomColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 数据库事务辅助函数
export async function withTransaction<T>(
  db: D1Database,
  callback: (db: D1Database) => Promise<T>
): Promise<T> {
  // D1 目前不支持显式事务，但我们可以为将来的支持做准备
  return await callback(db);
}
