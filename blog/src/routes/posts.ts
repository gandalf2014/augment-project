/**
 * 文章相关路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { PostService } from '../services/postService';
import { TagService } from '../services/tagService';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware, jsonResponse, getRequestBody } from '../middleware';
import { validate, CreatePostSchema, UpdatePostSchema, PostQuerySchema, BatchActionSchema } from '../utils/validation';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { renderMarkdown, extractToc, estimateReadTime } from '../utils/markdown';

export function registerPostRoutes(router: Router) {

  // 获取文章列表 (公开)
  router.get('/api/posts', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const queryParams = validate(PostQuerySchema, {
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '10',
      category: url.searchParams.get('category') || undefined,
      tag: url.searchParams.get('tag') || undefined,
      search: url.searchParams.get('search') || undefined,
      status: url.searchParams.get('status') || 'published',
      featured: url.searchParams.get('featured') || undefined,
      author: url.searchParams.get('author') || undefined
    });

    const postService = new PostService(env.DB);
    const result = await postService.getPosts(queryParams);

    return jsonResponse(result);
  }, [optionalAuthMiddleware]);

  // 获取单篇文章 (公开)
  router.get('/api/posts/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的文章ID');
    }

    const postService = new PostService(env.DB);
    const post = await postService.getPostById(id);

    if (!post) {
      throw new NotFoundError('Post', id);
    }

    // 增加浏览量
    if (post.status === 'published') {
      await postService.incrementViewCount(id);
    }

    // 渲染 Markdown 内容
    const renderedPost = {
      ...post,
      rendered_content: renderMarkdown(post.content),
      toc: extractToc(post.content),
      read_time: estimateReadTime(post.content)
    };

    return jsonResponse({ success: true, data: renderedPost });
  }, [optionalAuthMiddleware]);

  // 根据 slug 获取文章 (公开)
  router.get('/api/posts/slug/:slug', async (request, env: Env, ctx, params) => {
    const slug = params!.slug;

    const postService = new PostService(env.DB);
    const post = await postService.getPostBySlug(slug);

    if (!post) {
      throw new NotFoundError('Post', slug);
    }

    await postService.incrementViewCount(post.id);

    // 渲染 Markdown 内容
    const renderedPost = {
      ...post,
      rendered_content: renderMarkdown(post.content),
      toc: extractToc(post.content),
      read_time: estimateReadTime(post.content)
    };

    return jsonResponse({ success: true, data: renderedPost });
  });

  // 创建文章 (需要认证)
  router.post('/api/posts', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const rawData = getRequestBody(ctx);

    // 转换数据
    const validatedData = validate(CreatePostSchema, {
      ...rawData,
      featured_image: rawData.featured_image || undefined,
      category_id: rawData.category_id || undefined,
      status: rawData.status === 'archived' ? 'draft' : rawData.status
    });

    const data = {
      ...validatedData,
      status: (validatedData.status === 'archived' ? 'draft' : validatedData.status) as 'draft' | 'published'
    };

    const postService = new PostService(env.DB);
    const post = await postService.createPost(data, user.id);

    return jsonResponse({
      success: true,
      data: post,
      message: '文章创建成功'
    }, 201);
  }, [authMiddleware]);

  // 更新文章 (需要认证)
  router.put('/api/posts/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const id = parseInt(params!.id);
    const rawData = getRequestBody(ctx);

    if (isNaN(id)) {
      throw new ValidationError('无效的文章ID');
    }

    const validatedData = validate(UpdatePostSchema, { ...rawData, id });
    const data = { ...validatedData, id } as any;

    const postService = new PostService(env.DB);
    const existingPost = await postService.getPostById(id);

    if (!existingPost) {
      throw new NotFoundError('Post', id);
    }

    // 权限检查
    if (existingPost.author_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('只有作者或管理员可以编辑文章');
    }

    const post = await postService.updatePost(data);

    return jsonResponse({
      success: true,
      data: post,
      message: '文章更新成功'
    });
  }, [authMiddleware]);

  // 删除文章 (需要认证)
  router.delete('/api/posts/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const id = parseInt(params!.id);

    if (isNaN(id)) {
      throw new ValidationError('无效的文章ID');
    }

    const postService = new PostService(env.DB);
    const existingPost = await postService.getPostById(id);

    if (!existingPost) {
      throw new NotFoundError('Post', id);
    }

    if (existingPost.author_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('只有作者或管理员可以删除文章');
    }

    await postService.deletePost(id);

    return jsonResponse({
      success: true,
      message: '文章删除成功'
    });
  }, [authMiddleware]);

  // ==================== 管理员路由 ====================

  // 获取管理员文章列表
  router.get('/api/admin/posts', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const url = new URL(request.url);

    const queryParams = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '10'),
      category: url.searchParams.get('category') || undefined,
      tag: url.searchParams.get('tag') || undefined,
      search: url.searchParams.get('search') || undefined,
      status: url.searchParams.get('status') || undefined,
      featured: url.searchParams.get('featured') === 'true' ? true : undefined,
      author: user.role === 'admin' ?
        (url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined) :
        user.id
    };

    const postService = new PostService(env.DB);
    const result = await postService.getPosts(queryParams);

    return jsonResponse(result);
  }, [authMiddleware]);

  // 批量操作
  router.patch('/api/admin/posts/batch', async (request, env: Env, ctx, params) => {
    const rawData = getRequestBody(ctx);
    const { ids, action } = validate(BatchActionSchema, rawData);

    const postService = new PostService(env.DB);

    switch (action) {
      case 'publish':
        for (const id of ids) {
          await postService.updatePost({
            id,
            status: 'published',
            published_at: new Date().toISOString()
          } as any);
        }
        break;

      case 'draft':
        for (const id of ids) {
          await postService.updatePost({ id, status: 'draft' } as any);
        }
        break;

      case 'archive':
        for (const id of ids) {
          await postService.updatePost({ id, status: 'archived' } as any);
        }
        break;

      case 'delete':
        for (const id of ids) {
          await postService.deletePost(id);
        }
        break;

      default:
        throw new ValidationError('无效的操作类型');
    }

    return jsonResponse({
      success: true,
      message: `成功${action === 'delete' ? '删除' : '更新'} ${ids.length} 篇文章`
    });
  }, [authMiddleware, adminMiddleware]);

  // 管理员创建文章
  router.post('/api/admin/posts', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const rawData = getRequestBody(ctx);

    // 处理标签
    let tag_ids: number[] = [];
    if (rawData.tags && typeof rawData.tags === 'string') {
      const tagService = new TagService(env.DB);
      const tagNames = rawData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);

      for (const tagName of tagNames) {
        try {
          const tag = await tagService.createTag({ name: tagName });
          tag_ids.push(tag.id);
        } catch {
          const existingTags = await tagService.getTags();
          const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          if (existingTag) {
            tag_ids.push(existingTag.id);
          }
        }
      }
    }

    const validatedData = validate(CreatePostSchema, {
      ...rawData,
      tag_ids: tag_ids.length > 0 ? tag_ids : rawData.tag_ids,
      featured_image: rawData.featured_image || undefined,
      category_id: rawData.category_id || undefined
    });

    const data = {
      ...validatedData,
      status: (validatedData.status === 'archived' ? 'draft' : validatedData.status) as 'draft' | 'published'
    };

    const postService = new PostService(env.DB);
    const post = await postService.createPost(data, user.id);

    return jsonResponse({
      success: true,
      data: post,
      message: '文章创建成功'
    }, 201);
  }, [authMiddleware]);

  // 管理员更新文章
  router.put('/api/admin/posts/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const id = parseInt(params!.id);
    const rawData = getRequestBody(ctx);

    if (isNaN(id)) {
      throw new ValidationError('无效的文章ID');
    }

    const postService = new PostService(env.DB);
    const existingPost = await postService.getPostById(id);

    if (!existingPost) {
      throw new NotFoundError('Post', id);
    }

    if (user.role !== 'admin' && existingPost.author_id !== user.id) {
      throw new ForbiddenError('权限不足');
    }

    // 处理标签
    let tag_ids: number[] | undefined = undefined;
    if (rawData.tags !== undefined) {
      tag_ids = [];
      if (rawData.tags && typeof rawData.tags === 'string') {
        const tagService = new TagService(env.DB);
        const tagNames = rawData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);

        for (const tagName of tagNames) {
          try {
            const tag = await tagService.createTag({ name: tagName });
            tag_ids.push(tag.id);
          } catch {
            const existingTags = await tagService.getTags();
            const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tag_ids.push(existingTag.id);
            }
          }
        }
      }
    }

    const validatedData = validate(UpdatePostSchema, {
      id,
      ...rawData,
      tag_ids,
      featured_image: rawData.featured_image || undefined,
      category_id: rawData.category_id || undefined
    });

    const post = await postService.updatePost(validatedData as any);

    return jsonResponse({
      success: true,
      data: post,
      message: '文章更新成功'
    });
  }, [authMiddleware]);

  // 管理员删除文章
  router.delete('/api/admin/posts/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const id = parseInt(params!.id);

    if (isNaN(id)) {
      throw new ValidationError('无效的文章ID');
    }

    const postService = new PostService(env.DB);
    const existingPost = await postService.getPostById(id);

    if (!existingPost) {
      throw new NotFoundError('Post', id);
    }

    if (user.role !== 'admin' && existingPost.author_id !== user.id) {
      throw new ForbiddenError('权限不足');
    }

    await postService.deletePost(id);

    return jsonResponse({
      success: true,
      message: '文章删除成功'
    });
  }, [authMiddleware]);
}