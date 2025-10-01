/**
 * 数据库类型定义
 */

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  role: 'admin' | 'editor';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  category_id?: number;
  author_id: number;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  view_count: number;
  comment_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PostTag {
  id: number;
  post_id: number;
  tag_id: number;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  parent_id?: number;
  author_name: string;
  author_email: string;
  author_website?: string;
  author_ip?: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: number;
  key: string;
  value?: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_description?: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 扩展的类型，包含关联数据
export interface PostWithDetails extends Post {
  category?: Category;
  author: User;
  tags: Tag[];
  comments?: Comment[];
}

export interface CommentWithReplies extends Comment {
  replies?: Comment[];
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 请求类型
export interface CreatePostRequest {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  category_id?: number;
  tag_ids?: number[];
  status?: 'draft' | 'published';
  is_featured?: boolean;
  published_at?: string;
}

export interface UpdatePostRequest extends Partial<CreatePostRequest> {
  id: number;
}

export interface CreateCommentRequest {
  post_id: number;
  parent_id?: number;
  author_name: string;
  author_email: string;
  author_website?: string;
  content: string;
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface CreateTagRequest {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: string;
}

// 查询参数类型
export interface PostQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
  status?: string;
  featured?: boolean;
  author?: number;
}

export interface CommentQueryParams {
  page?: number;
  limit?: number;
  post_id?: number;
  status?: string;
}

// 数据库环境类型
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}
