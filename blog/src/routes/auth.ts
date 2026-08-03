/**
 * 认证相关路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { UserService } from '../services/userService';
import { authMiddleware, adminMiddleware, jsonResponse, getRequestBody, rateLimitMiddleware } from '../middleware';
import { validate, LoginSchema, RegisterSchema } from '../utils/validation';
import { NotFoundError, ValidationError, UnauthorizedError, ForbiddenError } from '../utils/errors';

export function registerAuthRoutes(router: Router) {

  // Login (rate-limited per IP: 5/min to prevent brute force)
  router.post('/api/auth/login', async (request, env: Env, ctx, params) => {
    const rawData = getRequestBody(ctx);
    const credentials = validate(LoginSchema, rawData);

    const userService = new UserService(env.DB);

    try {
      const result = await userService.login(credentials, env.JWT_SECRET);
      return jsonResponse({
        success: true,
        data: result,
        message: '登录成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        throw new UnauthorizedError('邮箱或密码错误');
      }
      throw error;
    }
  }, [rateLimitMiddleware({
    limit: 5,
    windowMs: 60000,
    keyGenerator: (req) => req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'
  })]);

  // 获取当前用户信息
  router.get('/api/auth/me', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;

    const userService = new UserService(env.DB);
    const fullUser = await userService.getUserById(user.id);

    if (!fullUser) {
      throw new NotFoundError('User', user.id);
    }

    const { password_hash, ...userInfo } = fullUser;
    return jsonResponse({ success: true, data: userInfo });
  }, [authMiddleware]);

  // 更新当前用户信息
  router.put('/api/auth/profile', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const updateData = getRequestBody(ctx);

    const userService = new UserService(env.DB);

    try {
      const updatedUser = await userService.updateUser(user.id, updateData);
      const { password_hash, ...userInfo } = updatedUser;
      return jsonResponse({
        success: true,
        data: userInfo,
        message: '资料更新成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ValidationError('用户名或邮箱已被使用');
      }
      throw error;
    }
  }, [authMiddleware]);

  // 更改密码
  router.put('/api/auth/password', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const { currentPassword, newPassword } = getRequestBody(ctx) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      throw new ValidationError('请提供当前密码和新密码');
    }

    if (newPassword.length < 6) {
      throw new ValidationError('新密码至少需要6个字符');
    }

    const userService = new UserService(env.DB);

    try {
      await userService.updatePassword(user.id, currentPassword, newPassword);
      return jsonResponse({
        success: true,
        message: '密码更新成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Current password is incorrect') {
        throw new ValidationError('当前密码不正确');
      }
      throw error;
    }
  }, [authMiddleware]);

  // ==================== 管理员路由 ====================

  // 获取所有用户
  router.get('/api/admin/users', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';

    const userService = new UserService(env.DB);
    const users = await userService.getUsers(includeInactive);

    // 移除密码哈希
    const safeUsers = users.map((u: any) => {
      const { password_hash, ...rest } = u;
      return rest;
    });

    return jsonResponse({ success: true, data: safeUsers });
  }, [authMiddleware]);

  // 获取用户统计
  router.get('/api/admin/users/stats', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    const userService = new UserService(env.DB);
    const stats = await userService.getUserStats();

    return jsonResponse({ success: true, data: stats });
  }, [authMiddleware]);

  // 创建用户
  router.post('/api/admin/users', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    const rawData = getRequestBody(ctx);

    if (!rawData.username || !rawData.email || !rawData.password || !rawData.display_name) {
      throw new ValidationError('用户名、邮箱、密码和显示名称都是必填项');
    }

    if (rawData.password.length < 6) {
      throw new ValidationError('密码至少需要6个字符');
    }

    const userService = new UserService(env.DB);

    try {
      const newUser = await userService.createUser(rawData);
      const { password_hash, ...userInfo } = newUser;
      return jsonResponse({
        success: true,
        data: userInfo,
        message: '用户创建成功'
      }, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ValidationError('用户名或邮箱已存在');
      }
      throw error;
    }
  }, [authMiddleware]);

  // 更新用户
  router.put('/api/admin/users/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const userId = parseInt(params!.id);

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    if (isNaN(userId)) {
      throw new ValidationError('无效的用户ID');
    }

    const updateData = getRequestBody(ctx);
    const userService = new UserService(env.DB);

    try {
      const updatedUser = await userService.updateUser(userId, updateData);
      const { password_hash, ...userInfo } = updatedUser;
      return jsonResponse({
        success: true,
        data: userInfo,
        message: '用户更新成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        throw new NotFoundError('User', userId);
      }
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ValidationError('用户名或邮箱已存在');
      }
      throw error;
    }
  }, [authMiddleware]);

  // 重置用户密码
  router.put('/api/admin/users/:id/password', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const userId = parseInt(params!.id);

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    if (isNaN(userId)) {
      throw new ValidationError('无效的用户ID');
    }

    const { newPassword } = getRequestBody(ctx) as { newPassword: string };

    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('新密码至少需要6个字符');
    }

    const userService = new UserService(env.DB);
    await userService.resetPassword(userId, newPassword);

    return jsonResponse({
      success: true,
      message: '密码重置成功'
    });
  }, [authMiddleware]);

  // 切换用户状态
  router.patch('/api/admin/users/:id/toggle', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const userId = parseInt(params!.id);

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    if (isNaN(userId)) {
      throw new ValidationError('无效的用户ID');
    }

    if (userId === user.id) {
      throw new ValidationError('不能禁用自己的账户');
    }

    const userService = new UserService(env.DB);

    try {
      const updatedUser = await userService.toggleUserStatus(userId);
      const { password_hash, ...userInfo } = updatedUser;
      return jsonResponse({
        success: true,
        data: userInfo,
        message: '用户状态已更新'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        throw new NotFoundError('User', userId);
      }
      throw error;
    }
  }, [authMiddleware]);

  // 删除用户
  router.delete('/api/admin/users/:id', async (request, env: Env, ctx, params) => {
    const user = (request as any).user;
    const userId = parseInt(params!.id);

    if (user.role !== 'admin') {
      throw new ForbiddenError('需要管理员权限');
    }

    if (isNaN(userId)) {
      throw new ValidationError('无效的用户ID');
    }

    if (userId === user.id) {
      throw new ValidationError('不能删除自己的账户');
    }

    const userService = new UserService(env.DB);

    try {
      await userService.deleteUser(userId);
      return jsonResponse({
        success: true,
        message: '用户删除成功'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('associated posts')) {
        throw new ValidationError('无法删除有文章关联的用户');
      }
      throw error;
    }
  }, [authMiddleware]);
}