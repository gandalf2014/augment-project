/**
 * 评论相关路由
 */

import type { Router } from '../utils/router';
import type { Env, CreateCommentRequest } from '../types/database';
import { CommentService } from '../services/commentService';
import { authMiddleware, jsonResponse, getRequestBody } from '../middleware';

export function registerCommentRoutes(router: Router) {
  
  // 获取文章评论 (公开)
  router.get('/api/posts/:postId/comments', async (request, env: Env, ctx, params) => {
    try {
      const postId = parseInt(params!.postId);
      if (isNaN(postId)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }
      
      const commentService = new CommentService(env.DB);
      const comments = await commentService.getPostComments(postId);
      
      return jsonResponse({ success: true, data: comments });
    } catch (error) {
      console.error('Get post comments error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch comments' }, 500);
    }
  });

  // 创建评论 (公开)
  router.post('/api/posts/:postId/comments', async (request, env: Env, ctx, params) => {
    try {
      const postId = parseInt(params!.postId);
      if (isNaN(postId)) {
        return jsonResponse({ success: false, error: 'Invalid post ID' }, 400);
      }
      
      const data = getRequestBody(ctx) as Omit<CreateCommentRequest, 'post_id'>;
      
      // 验证必填字段
      if (!data.author_name || !data.author_email || !data.content) {
        return jsonResponse({ 
          success: false, 
          error: 'Author name, email, and content are required' 
        }, 400);
      }
      
      // 获取客户端 IP
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      request.headers.get('X-Real-IP') || 
                      'unknown';
      
      const commentData: CreateCommentRequest = {
        ...data,
        post_id: postId
      };
      
      const commentService = new CommentService(env.DB);
      
      // 检查是否为垃圾评论
      const isSpam = await commentService.checkSpam(commentData);
      
      const comment = await commentService.createComment(commentData, clientIP);
      
      // 如果检测到垃圾评论，自动标记为垃圾
      if (isSpam) {
        await commentService.updateCommentStatus(comment.id, 'spam');
      }
      
      return jsonResponse({ 
        success: true, 
        data: comment,
        message: isSpam ? 
          'Comment submitted but marked as spam for review' : 
          'Comment submitted for review' 
      }, 201);
    } catch (error) {
      console.error('Create comment error:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return jsonResponse({ success: false, error: error.message }, 404);
        }
        if (error.message.includes('Invalid')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
      }
      return jsonResponse({ success: false, error: 'Failed to create comment' }, 500);
    }
  });

  // 获取评论列表 (管理员)
  router.get('/api/admin/comments', async (request, env: Env, ctx, params) => {
    try {
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
    } catch (error) {
      console.error('Get admin comments error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch comments' }, 500);
    }
  }, [authMiddleware]);

  // 更新评论状态 (管理员)
  router.patch('/api/admin/comments/:id/status', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      const { status } = getRequestBody(ctx) as { status: 'pending' | 'approved' | 'rejected' | 'spam' };
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid comment ID' }, 400);
      }
      
      if (!['pending', 'approved', 'rejected', 'spam'].includes(status)) {
        return jsonResponse({ success: false, error: 'Invalid status' }, 400);
      }
      
      const commentService = new CommentService(env.DB);
      const comment = await commentService.updateCommentStatus(id, status);
      
      return jsonResponse({ 
        success: true, 
        data: comment,
        message: 'Comment status updated successfully' 
      });
    } catch (error) {
      console.error('Update comment status error:', error);
      if (error instanceof Error && error.message === 'Comment not found') {
        return jsonResponse({ success: false, error: 'Comment not found' }, 404);
      }
      return jsonResponse({ success: false, error: 'Failed to update comment status' }, 500);
    }
  }, [authMiddleware]);

  // 批量更新评论状态 (管理员)
  router.patch('/api/admin/comments/batch/status', async (request, env: Env, ctx, params) => {
    try {
      const { ids, status } = getRequestBody(ctx) as { 
        ids: number[], 
        status: 'pending' | 'approved' | 'rejected' | 'spam' 
      };
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid comment IDs' }, 400);
      }
      
      if (!['pending', 'approved', 'rejected', 'spam'].includes(status)) {
        return jsonResponse({ success: false, error: 'Invalid status' }, 400);
      }
      
      const commentService = new CommentService(env.DB);
      await commentService.batchUpdateCommentStatus(ids, status);
      
      return jsonResponse({ 
        success: true, 
        message: `Comments ${status} successfully` 
      });
    } catch (error) {
      console.error('Batch update comment status error:', error);
      return jsonResponse({ success: false, error: 'Failed to update comment status' }, 500);
    }
  }, [authMiddleware]);

  // 删除评论 (管理员)
  router.delete('/api/admin/comments/:id', async (request, env: Env, ctx, params) => {
    try {
      const id = parseInt(params!.id);
      
      if (isNaN(id)) {
        return jsonResponse({ success: false, error: 'Invalid comment ID' }, 400);
      }
      
      const commentService = new CommentService(env.DB);
      await commentService.deleteComment(id);
      
      return jsonResponse({ 
        success: true, 
        message: 'Comment deleted successfully' 
      });
    } catch (error) {
      console.error('Delete comment error:', error);
      return jsonResponse({ success: false, error: 'Failed to delete comment' }, 500);
    }
  }, [authMiddleware]);

  // 批量删除评论 (管理员)
  router.delete('/api/admin/comments/batch', async (request, env: Env, ctx, params) => {
    try {
      const { ids } = getRequestBody(ctx) as { ids: number[] };
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid comment IDs' }, 400);
      }
      
      const commentService = new CommentService(env.DB);
      await commentService.batchDeleteComments(ids);
      
      return jsonResponse({ 
        success: true, 
        message: 'Comments deleted successfully' 
      });
    } catch (error) {
      console.error('Batch delete comments error:', error);
      return jsonResponse({ success: false, error: 'Failed to delete comments' }, 500);
    }
  }, [authMiddleware]);

  // 获取评论统计信息 (管理员)
  router.get('/api/admin/comments/stats', async (request, env: Env, ctx, params) => {
    try {
      const commentService = new CommentService(env.DB);
      const stats = await commentService.getCommentStats();
      
      return jsonResponse({ success: true, data: stats });
    } catch (error) {
      console.error('Get comment stats error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch comment stats' }, 500);
    }
  }, [authMiddleware]);

  // 获取最新评论 (管理员)
  router.get('/api/admin/comments/recent', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const status = url.searchParams.get('status') || 'approved';
      
      const commentService = new CommentService(env.DB);
      const comments = await commentService.getRecentComments(limit, status);
      
      return jsonResponse({ success: true, data: comments });
    } catch (error) {
      console.error('Get recent comments error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch recent comments' }, 500);
    }
  }, [authMiddleware]);

  // 获取用户评论历史 (管理员)
  router.get('/api/admin/comments/user/:email', async (request, env: Env, ctx, params) => {
    try {
      const email = decodeURIComponent(params!.email);
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      const commentService = new CommentService(env.DB);
      const comments = await commentService.getUserComments(email, limit);
      
      return jsonResponse({ success: true, data: comments });
    } catch (error) {
      console.error('Get user comments error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch user comments' }, 500);
    }
  }, [authMiddleware]);
}
