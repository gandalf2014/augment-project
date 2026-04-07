/**
 * Input validation schemas using Zod
 */
import { z } from 'zod';

/**
 * Memo validation schema
 */
export const MemoSchema = z.object({
  title: z.string()
    .max(200, 'Title must be 200 characters or less')
    .optional()
    .transform(val => val?.trim() || ''),

  content: z.string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50000 characters or less')
    .transform(val => val.trim()),

  tags: z.string()
    .max(500, 'Tags must be 500 characters or less')
    .optional()
    .transform(val => val?.trim() || ''),

  is_favorite: z.boolean()
    .optional()
    .default(false)
});

/**
 * Tag validation schema
 */
export const TagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, 'Tag name can only contain letters, numbers, Chinese characters, underscores and hyphens')
    .transform(val => val.trim()),

  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #2563eb)')
    .optional()
    .default('#2563eb')
});

/**
 * Notebook validation schema
 */
export const NotebookSchema = z.object({
  name: z.string()
    .min(1, 'Notebook name is required')
    .max(50, 'Notebook name must be 50 characters or less')
    .transform(val => val.trim()),

  icon: z.string()
    .max(10, 'Icon must be 10 characters or less')
    .optional()
    .default('📁')
});

/**
 * Batch operation schemas
 */
export const BatchSchema = z.object({
  action: z.enum(['archive', 'restore', 'delete', 'move', 'tags']),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    notebook_id: z.number().int().positive().optional(),
    mode: z.enum(['add', 'replace', 'remove']).optional(),
    tags: z.string().optional()
  }).optional()
});

export const BatchMoveSchema = z.object({
  action: z.literal('move'),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    notebook_id: z.number().int().positive()
  })
});

export const BatchTagsSchema = z.object({
  action: z.literal('tags'),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    mode: z.enum(['add', 'replace', 'remove']),
    tags: z.string().min(1)
  })
});

/**
 * Saved filter schemas
 */
export const SavedFilterSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default('⭐'),
  filter_config: z.object({
    notebook: z.union([z.literal('all'), z.number().int().positive()]).nullable(),
    tags: z.array(z.string()).nullable(),
    favorite: z.boolean().nullable(),
    archived: z.boolean().nullable(),
    search: z.string().max(100).nullable()
  })
});

export const SavedFilterUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(10).optional(),
  filter_config: SavedFilterSchema.shape.filter_config.optional()
});

/**
 * Pagination query schema
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Validate request body against schema
 * @param {Request} request - The request object
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function validateBody(request, schema) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: errors.join('; ') };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: 'Invalid JSON body' };
  }
}

/**
 * Validate query parameters against schema
 * @param {URLSearchParams} params - URL search params
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {{success: boolean, data?: any, error?: string}}
 */
export function validateQuery(params, schema) {
  const obj = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }

  const result = schema.safeParse(obj);
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
    return { success: false, error: errors.join('; ') };
  }

  return { success: true, data: result.data };
}