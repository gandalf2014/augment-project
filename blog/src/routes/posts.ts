/**
 * 文章相关路由
 */

import type { Router } from '../utils/router';
import type { Env, CreatePostRequest, UpdatePostRequest } from '../types/database';
import { PostService } from '../services/postService';
import { TagService } from '../services/tagService';
import { authMiddleware, optionalAuthMiddleware, jsonResponse } from '../middleware';

export function registerPostRoutes(router: Router) {
  
  // 获取文章列表 (公开)
  router.get('/api/posts', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const queryParams = {
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '10'),
        category: url.searchParams.get('category') || undefined,
        tag: url.searchParams.get('tag') || undefined,
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || 'published',
        featured: url.searchParams.get('featured') === 'true' ? true : undefined,
        author: url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined
      };
      
      const postService = new PostService(env.DB);
      const result = await postService.getPosts(queryParams);
      
      return jsonResponse(result);
    } catch (error) {
      console.error('Get posts error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch posts' }, 500);
    }
  }, [optionalAuthMiddleware]);

  // 获取单篇文章 (公开)
  router.get('/api/posts/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }
      
      const postService = new PostService(env.DB);
      const post = await postService.getPostById(id);
      
      if (!post) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }
      
      // 如果是已发布的文章，增加浏览量
      if (post.status === 'published') {
        await postService.incrementViewCount(id);
      }
      
      return jsonResponse({ success: true, data: post });
    } catch (error) {
      console.error('Get post error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch post' }, 500);
    }
  }, [optionalAuthMiddleware]);

  // 根据 slug 获取文章 (公开)
  router.get('/api/posts/slug/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      
      const postService = new PostService(env.DB);
      const post = await postService.getPostBySlug(slug);
      
      if (!post) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }
      
      // 增加浏览量
      await postService.incrementViewCount(post.id);
      
      return jsonResponse({ success: true, data: post });
    } catch (error) {
      console.error('Get post by slug error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch post' }, 500);
    }
  });

  // 创建文章 (需要认证)
  router.post('/api/posts', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const data = (request as any).body as CreatePostRequest;
      
      // 验证必填字段
      if (!data.title || !data.content) {
        return jsonResponse({ 
          success: false, 
          error: 'Title and content are required' 
        }, 400);
      }
      
      const postService = new PostService(env.DB);
      const post = await postService.createPost(data, user.id);
      
      return jsonResponse({ 
        success: true, 
        data: post,
        message: 'Post created successfully' 
      }, 201);
    } catch (error) {
      console.error('Create post error:', error);
      return jsonResponse({ success: false, error: 'Failed to create post' }, 500);
    }
  }, [authMiddleware]);

  // 更新文章 (需要认证)
  router.put('/api/posts/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const id = parseInt(params!.id);
      const data = (request as any).body as Partial<CreatePostRequest>;
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }
      
      // 检查文章是否存在以及权限
      const postService = new PostService(env.DB);
      const existingPost = await postService.getPostById(id);
      
      if (!existingPost) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }
      
      // 检查权限（只有作者或管理员可以编辑）
      if (existingPost.author_id !== user.id && user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Permission denied' }, 403);
      }
      
      const updateData: UpdatePostRequest = { id, ...data };
      const post = await postService.updatePost(updateData);
      
      return jsonResponse({ 
        success: true, 
        data: post,
        message: 'Post updated successfully' 
      });
    } catch (error) {
      console.error('Update post error:', error);
      return jsonResponse({ success: false, error: 'Failed to update post' }, 500);
    }
  }, [authMiddleware]);

  // 删除文章 (需要认证)
  router.delete('/api/posts/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const id = parseInt(params!.id);
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }
      
      // 检查文章是否存在以及权限
      const postService = new PostService(env.DB);
      const existingPost = await postService.getPostById(id);
      
      if (!existingPost) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }
      
      // 检查权限（只有作者或管理员可以删除）
      if (existingPost.author_id !== user.id && user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Permission denied' }, 403);
      }
      
      await postService.deletePost(id);
      
      return jsonResponse({ 
        success: true, 
        message: 'Post deleted successfully' 
      });
    } catch (error) {
      console.error('Delete post error:', error);
      return jsonResponse({ success: false, error: 'Failed to delete post' }, 500);
    }
  }, [authMiddleware]);

  // 获取管理员文章列表 (需要认证)
  router.get('/api/admin/posts', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const url = new URL(request.url);
      
      const queryParams = {
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '10'),
        category: url.searchParams.get('category') || undefined,
        tag: url.searchParams.get('tag') || undefined,
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined, // 管理员可以看到所有状态
        featured: url.searchParams.get('featured') === 'true' ? true : undefined,
        author: user.role === 'admin' ? 
          (url.searchParams.get('author') ? parseInt(url.searchParams.get('author')!) : undefined) :
          user.id // 非管理员只能看到自己的文章
      };
      
      const postService = new PostService(env.DB);
      const result = await postService.getPosts(queryParams);
      
      return jsonResponse(result);
    } catch (error) {
      console.error('Get admin posts error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch posts' }, 500);
    }
  }, [authMiddleware]);

  // 批量更新文章状态 (需要管理员权限)
  router.patch('/api/admin/posts/batch', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      const { ids, action } = (request as any).body as { ids: number[], action: string };
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid post IDs' }, 400);
      }
      
      const postService = new PostService(env.DB);
      
      switch (action) {
        case 'publish':
          for (const id of ids) {
            await postService.updatePost({ 
              id, 
              status: 'published',
              published_at: new Date().toISOString()
            });
          }
          break;
          
        case 'draft':
          for (const id of ids) {
            await postService.updatePost({ id, status: 'draft' });
          }
          break;
          
        case 'archive':
          for (const id of ids) {
            await postService.updatePost({ id, status: 'archived' });
          }
          break;
          
        case 'delete':
          for (const id of ids) {
            await postService.deletePost(id);
          }
          break;
          
        default:
          return jsonResponse({ success: false, error: 'Invalid action' }, 400);
      }
      
      return jsonResponse({ 
        success: true, 
        message: `Posts ${action}ed successfully` 
      });
    } catch (error) {
      console.error('Batch update posts error:', error);
      return jsonResponse({ success: false, error: 'Failed to update posts' }, 500);
    }
  }, [authMiddleware]);

  // 管理员创建文章 (需要管理员权限)
  router.post('/api/admin/posts', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const rawData = (ctx as any).requestBody as any;



      // 验证必填字段
      if (!rawData || !rawData.title || !rawData.content) {
        return jsonResponse({
          success: false,
          error: 'Title and content are required'
        }, 400);
      }

      // 处理标签：将字符串转换为 tag_ids 数组
      let tag_ids: number[] = [];
      if (rawData.tags && typeof rawData.tags === 'string') {
        const tagService = new TagService(env.DB);
        const tagNames = rawData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);

        // 为每个标签名创建或获取标签ID
        for (const tagName of tagNames) {
          try {
            const tag = await tagService.createTag({ name: tagName });
            tag_ids.push(tag.id);
          } catch (error) {
            // 如果标签已存在，尝试获取现有标签
            const existingTags = await tagService.getTags();
            const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tag_ids.push(existingTag.id);
            }
          }
        }
      }

      // 构建创建请求数据
      const data: CreatePostRequest = {
        title: rawData.title,
        slug: rawData.slug,
        excerpt: rawData.excerpt,
        content: rawData.content,
        featured_image: rawData.featured_image,
        category_id: rawData.category_id ? parseInt(rawData.category_id) : undefined,
        status: rawData.status || 'draft',
        is_featured: rawData.is_featured || false,
        published_at: rawData.published_at,
        tag_ids: tag_ids.length > 0 ? tag_ids : undefined
      };

      const postService = new PostService(env.DB);
      const post = await postService.createPost(data, user.id);

      return jsonResponse({
        success: true,
        data: post,
        message: 'Post created successfully'
      }, 201);
    } catch (error) {
      console.error('Admin create post error:', error);
      return jsonResponse({ success: false, error: 'Failed to create post' }, 500);
    }
  }, [authMiddleware]);

  // 管理员更新文章 (需要管理员权限)
  router.put('/api/admin/posts/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const id = parseInt(params!.id);
      const rawData = (ctx as any).requestBody as any;

      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }

      // 检查文章是否存在
      const postService = new PostService(env.DB);
      const existingPost = await postService.getPostById(id);

      if (!existingPost) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }

      // 管理员可以编辑任何文章，普通用户只能编辑自己的文章
      if (user.role !== 'admin' && existingPost.author_id !== user.id) {
        return jsonResponse({ success: false, error: 'Permission denied' }, 403);
      }

      // 处理标签：将字符串转换为 tag_ids 数组
      let tag_ids: number[] | undefined = undefined;
      if (rawData.tags !== undefined) {
        tag_ids = [];
        if (rawData.tags && typeof rawData.tags === 'string') {
          const tagService = new TagService(env.DB);
          const tagNames = rawData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);

          // 为每个标签名创建或获取标签ID
          for (const tagName of tagNames) {
            try {
              const tag = await tagService.createTag({ name: tagName });
              tag_ids.push(tag.id);
            } catch (error) {
              // 如果标签已存在，尝试获取现有标签
              const existingTags = await tagService.getTags();
              const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
              if (existingTag) {
                tag_ids.push(existingTag.id);
              }
            }
          }
        }
      }

      // 构建更新请求数据
      const updateData: UpdatePostRequest = {
        id,
        title: rawData.title,
        slug: rawData.slug,
        excerpt: rawData.excerpt,
        content: rawData.content,
        featured_image: rawData.featured_image,
        category_id: rawData.category_id ? parseInt(rawData.category_id) : undefined,
        status: rawData.status,
        is_featured: rawData.is_featured,
        published_at: rawData.published_at,
        tag_ids: tag_ids
      };

      const post = await postService.updatePost(updateData);

      return jsonResponse({
        success: true,
        data: post,
        message: 'Post updated successfully'
      });
    } catch (error) {
      console.error('Admin update post error:', error);
      return jsonResponse({ success: false, error: 'Failed to update post' }, 500);
    }
  }, [authMiddleware]);

  // 管理员删除文章 (需要管理员权限)
  router.delete('/api/admin/posts/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const id = parseInt(params!.id);

      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }

      // 检查文章是否存在
      const postService = new PostService(env.DB);
      const existingPost = await postService.getPostById(id);

      if (!existingPost) {
        return jsonResponse({ success: false, error: 'Post not found' }, 404);
      }

      // 管理员可以删除任何文章，普通用户只能删除自己的文章
      if (user.role !== 'admin' && existingPost.author_id !== user.id) {
        return jsonResponse({ success: false, error: 'Permission denied' }, 403);
      }

      await postService.deletePost(id);

      return jsonResponse({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      console.error('Admin delete post error:', error);
      return jsonResponse({ success: false, error: 'Failed to delete post' }, 500);
    }
  }, [authMiddleware]);
}
