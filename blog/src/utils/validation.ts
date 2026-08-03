/**
 * Zod 验证 Schemas
 * 定义所有 API 请求的数据验证规则
 */

import { z } from 'zod';
import { ValidationError } from './errors';

// 文章相关 - 基础 schema
const CreatePostBaseSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'slug 只能包含小写字母、数字和连字符')
    .max(100)
    .optional(),
  excerpt: z.string().max(500, '摘要不能超过500个字符').optional(),
  content: z.string().min(1, '内容不能为空'),
  featured_image: z.string().max(500).optional(),
  category_id: z.number().int().positive().optional(),
  tag_ids: z.array(z.number().int().positive()).max(10, '最多选择10个标签').optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  is_featured: z.boolean().default(false),
  published_at: z.string().optional()
});

export const CreatePostSchema = CreatePostBaseSchema;

export const UpdatePostSchema = CreatePostBaseSchema.partial().extend({
  id: z.number().int().positive()
});

export const PostQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  featured: z.coerce.boolean().optional(),
  author: z.coerce.number().int().positive().optional()
});

// 分类相关
export const CreateCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(50, '分类名称不能超过50个字符'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'slug 只能包含小写字母、数字和连字符')
    .max(50)
    .optional(),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式无效').default('#3B82F6'),
  sort_order: z.number().int().min(0).default(0)
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// 标签相关
export const CreateTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(30, '标签名称不能超过30个字符'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'slug 只能包含小写字母、数字和连字符')
    .max(50)
    .optional(),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式无效').default('#10B981')
});

export const UpdateTagSchema = CreateTagSchema.partial();

// 评论相关
export const CreateCommentSchema = z.object({
  post_id: z.number().int().positive('文章ID无效'),
  parent_id: z.number().int().positive().optional(),
  author_name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),
  author_email: z.string().email('邮箱格式无效').max(100, '邮箱不能超过100个字符'),
  author_website: z.string().max(200).optional(),
  content: z.string()
    .min(1, '评论内容不能为空')
    .max(2000, '评论内容不能超过2000个字符')
    .refine(val => !containsSpam(val), '评论内容包含禁止的内容')
});

export const CommentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  post_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'spam']).optional()
});

// 用户认证相关
export const LoginSchema = z.object({
  email: z.string().email('邮箱格式无效'),
  password: z.string().min(6, '密码至少6个字符').max(100)
});

export const RegisterSchema = z.object({
  username: z.string()
    .min(3, '用户名至少3个字符')
    .max(30, '用户名不能超过30个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  email: z.string().email('邮箱格式无效'),
  password: z.string()
    .min(8, '密码至少8个字符')
    .max(100)
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/[a-z]/, '密码必须包含至少一个小写字母')
    .regex(/[0-9]/, '密码必须包含至少一个数字'),
  display_name: z.string().min(1).max(50).optional()
});

// 设置相关
export const UpdateSettingSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string')
});

// 页面相关
export const CreatePageSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'slug 只能包含小写字母、数字和连字符')
    .max(100)
    .optional(),
  content: z.string().min(1, '内容不能为空'),
  meta_description: z.string().max(200).optional(),
  is_published: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0)
});

export const UpdatePageSchema = CreatePageSchema.partial();

// 批量操作
export const BatchActionSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '至少选择一项').max(100, '最多操作100项'),
  action: z.enum(['publish', 'draft', 'archive', 'delete', 'approve', 'reject', 'spam'])
});

// 辅助函数：检测垃圾内容
function containsSpam(content: string): boolean {
  const spamPatterns = [
    /\b(viagra|casino|lottery|winner|click here|buy now)\b/i,
    /(https?:\/\/[^\s]+){3,}/, // 超过3个链接
  ];
  return spamPatterns.some(pattern => pattern.test(content));
}

// 验证辅助函数
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    throw new ValidationError('数据验证失败', errors);
  }
  return result.data;
}

// 查询参数验证（宽松模式，忽略额外字段）
export function validateQuery<T>(schema: z.ZodSchema<T>, query: Record<string, string>): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    // 对于查询参数，返回默认值而不是抛出错误
    const defaultValues: any = {};
    const shape = (schema as any)._def?.shape;
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        if (value instanceof z.ZodDefault) {
          defaultValues[key] = (value as z.ZodDefault<any>)._def.defaultValue();
        }
      }
    }
    return { ...defaultValues, ...query } as T;
  }
  return result.data;
}