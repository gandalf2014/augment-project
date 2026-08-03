/**
 * 评论相关路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { CommentService } from '../services/commentService';
import { authMiddleware, adminMiddleware, jsonResponse, getRequestBody, rateLimitMiddleware } from '../middleware';
import { validate, CreateCommentSchema, CommentQuerySchema, BatchActionSchema } from '../utils/validation';
import { NotFoundError, ValidationError } from '../utils/errors';

export function registerCommentRoutes(router: Router) {

  // 获取文章评论 (公开)
  router.get('/api/posts/:postId/comments', async (request, env: Env, ctx, params) => {
    const postId = parseInt(params!.postId);
    if (isNaN(postId)) {
      throw new ValidationError('无效的文章ID');
    }

    const commentService = new CommentService(env.DB);
    const comments = await commentService.getPostComments(postId);

    return jsonResponse({ success: true, data: comments });
  });

  // 创建评论 (公开)
  router.post('/api/posts/:postId/comments', async (request, env: Env, ctx, params) => {
    const postId = parseInt(params!.postId);
    if (isNaN(postId)) {
      throw new ValidationError('无效的文章ID');
    }

    const rawData = getRequestBody(ctx);
    const data = validate(CreateCommentSchema, { ...rawData, post_id: postId });

    // 获取客户端 IP
    const clientIP = request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      request.headers.get('X-Real-IP') ||
      'unknown';

    const commentService = new CommentService(env.DB);

    // 检查是否为垃圾评论
    const isSpam = await commentService.checkSpam(data);

    const comment = await commentService.createComment(data, clientIP);

    if (isSpam) {
      await commentService.updateCommentStatus(comment.id, 'spam');
    }

    return jsonResponse({
      success: true,
      data: comment,
      message: isSpam ?
        '评论已提交，但被标记为垃圾评论需要审核' :
        '评论已提交，等待审核'
    }, 201);
  }, [rateLimitMiddleware({
    limit: 20,
    windowMs: 60000,
    keyGenerator: (req) => req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'
  })]);

  // ==================== 管理员路由 ====================

  // 获取评论列表
  router.get('/api/admin/comments', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const queryParams = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '20'),
      post_id: url.searchParams.get('post_id') ? parseInt(url.searchParams.get('post_id')!) : undefined,
      status: url.searchParams.get('status') || undefined
    };

    const commentService = new CommentService(env.DB);
    const result = await commentService.getComments(queryParams);

    return jsonResponse(result);
  }, [authMiddleware]);

  // 获取评论统计
  router.get('/api/admin/comments/stats', async (request, env: Env, ctx, params) => {
    const commentService = new CommentService(env.DB);
    const stats = await commentService.getCommentStats();

    return jsonResponse({ success: true, data: stats });
  }, [authMiddleware]);

  // 获取最新评论
  router.get('/api/admin/comments/recent', async (request, env: Env, ctx, params) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || 'approved';

    const commentService = new CommentService(env.DB);
    const comments = await commentService.getRecentComments(limit, status);

    return jsonResponse({ success: true, data: comments });
  }, [authMiddleware]);

  // 更新评论状态
  router.patch('/api/admin/comments/:id/status', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);
    const rawData = getRequestBody(ctx);

    if (isNaN(id)) {
      throw new ValidationError('无效的评论ID');
    }

    const { status } = rawData as { status: 'pending' | 'approved' | 'rejected' | 'spam' };
    if (!['pending', 'approved', 'rejected', 'spam'].includes(status)) {
      throw new ValidationError('无效的评论状态');
    }

    const commentService = new CommentService(env.DB);
    const comment = await commentService.updateCommentStatus(id, status);

    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    return jsonResponse({
      success: true,
      data: comment,
      message: '评论状态已更新'
    });
  }, [authMiddleware]);

  // 批量更新评论状态
  router.patch('/api/admin/comments/batch/status', async (request, env: Env, ctx, params) => {
    const rawData = getRequestBody(ctx);
    const { ids, status } = rawData as { ids: number[], status: 'pending' | 'approved' | 'rejected' | 'spam' };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('请选择要操作的评论');
    }

    if (!['pending', 'approved', 'rejected', 'spam'].includes(status)) {
      throw new ValidationError('无效的评论状态');
    }

    const commentService = new CommentService(env.DB);
    await commentService.batchUpdateCommentStatus(ids, status);

    return jsonResponse({
      success: true,
      message: `成功${status === 'approved' ? '批准' : status === 'rejected' ? '拒绝' : '处理'} ${ids.length} 条评论`
    });
  }, [authMiddleware, adminMiddleware]);

  // 删除评论（删除属破坏性操作，仅管理员可执行）
  router.delete('/api/admin/comments/:id', async (request, env: Env, ctx, params) => {
    const id = parseInt(params!.id);

    if (isNaN(id)) {
      throw new ValidationError('无效的评论ID');
    }

    const commentService = new CommentService(env.DB);
    await commentService.deleteComment(id);

    return jsonResponse({
      success: true,
      message: '评论已删除'
    });
  }, [authMiddleware, adminMiddleware]);

  // 批量删除评论
  router.delete('/api/admin/comments/batch', async (request, env: Env, ctx, params) => {
    const { ids } = getRequestBody(ctx) as { ids: number[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('请选择要删除的评论');
    }

    const commentService = new CommentService(env.DB);
    await commentService.batchDeleteComments(ids);

    return jsonResponse({
      success: true,
      message: `成功删除 ${ids.length} 条评论`
    });
  }, [authMiddleware, adminMiddleware]);

  // 获取用户评论历史
  router.get('/api/admin/comments/user/:email', async (request, env: Env, ctx, params) => {
    const email = decodeURIComponent(params!.email);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const commentService = new CommentService(env.DB);
    const comments = await commentService.getUserComments(email, limit);

    return jsonResponse({ success: true, data: comments });
  }, [authMiddleware]);
}