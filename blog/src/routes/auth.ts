/**
 * 认证相关路由
 */

import type { Router } from '../utils/router';
import type { Env, LoginRequest } from '../types/database';
import { UserService } from '../services/userService';
import { authMiddleware, jsonResponse, getRequestBody } from '../middleware';

export function registerAuthRoutes(router: Router) {
  
  // 用户登录
  router.post('/api/auth/login', async (request, env: Env, ctx, params) => {
    try {
      const credentials = getRequestBody(ctx) as LoginRequest;
      
      // 验证必填字段
      if (!credentials.email || !credentials.password) {
        return jsonResponse({ 
          success: false, 
          error: 'Email and password are required' 
        }, 400);
      }
      
      const userService = new UserService(env.DB);
      const result = await userService.login(credentials, env.JWT_SECRET);
      
      return jsonResponse({ 
        success: true, 
        data: result,
        message: 'Login successful' 
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return jsonResponse({ success: false, error: 'Invalid email or password' }, 401);
      }
      return jsonResponse({ success: false, error: 'Login failed' }, 500);
    }
  });

  // 获取当前用户信息
  router.get('/api/auth/me', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      
      const userService = new UserService(env.DB);
      const fullUser = await userService.getUserById(user.id);
      
      if (!fullUser) {
        return jsonResponse({ success: false, error: 'User not found' }, 404);
      }
      
      // 返回用户信息（不包含密码哈希）
      const { password_hash, ...userInfo } = fullUser;
      
      return jsonResponse({ success: true, data: userInfo });
    } catch (error) {
      console.error('Get current user error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch user info' }, 500);
    }
  }, [authMiddleware]);

  // 更新当前用户信息
  router.put('/api/auth/profile', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const updateData = (request as any).body as {
        username?: string;
        email?: string;
        display_name?: string;
        avatar_url?: string;
        bio?: string;
      };
      
      const userService = new UserService(env.DB);
      const updatedUser = await userService.updateUser(user.id, updateData);
      
      // 返回更新后的用户信息（不包含密码哈希）
      const { password_hash, ...userInfo } = updatedUser;
      
      return jsonResponse({ 
        success: true, 
        data: userInfo,
        message: 'Profile updated successfully' 
      });
    } catch (error) {
      console.error('Update profile error:', error);
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
        if (error.message.includes('Invalid email')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
      }
      return jsonResponse({ success: false, error: 'Failed to update profile' }, 500);
    }
  }, [authMiddleware]);

  // 更改密码
  router.put('/api/auth/password', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const { currentPassword, newPassword } = (request as any).body as {
        currentPassword: string;
        newPassword: string;
      };
      
      // 验证必填字段
      if (!currentPassword || !newPassword) {
        return jsonResponse({ 
          success: false, 
          error: 'Current password and new password are required' 
        }, 400);
      }
      
      // 验证新密码长度
      if (newPassword.length < 6) {
        return jsonResponse({ 
          success: false, 
          error: 'New password must be at least 6 characters long' 
        }, 400);
      }
      
      const userService = new UserService(env.DB);
      await userService.updatePassword(user.id, currentPassword, newPassword);
      
      return jsonResponse({ 
        success: true, 
        message: 'Password updated successfully' 
      });
    } catch (error) {
      console.error('Update password error:', error);
      if (error instanceof Error && error.message === 'Current password is incorrect') {
        return jsonResponse({ success: false, error: 'Current password is incorrect' }, 400);
      }
      return jsonResponse({ success: false, error: 'Failed to update password' }, 500);
    }
  }, [authMiddleware]);

  // 获取所有用户（管理员功能）
  router.get('/api/admin/users', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      const url = new URL(request.url);
      const includeInactive = url.searchParams.get('include_inactive') === 'true';
      
      const userService = new UserService(env.DB);
      const users = await userService.getUsers(includeInactive);
      
      return jsonResponse({ success: true, data: users });
    } catch (error) {
      console.error('Get users error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch users' }, 500);
    }
  }, [authMiddleware]);

  // 创建用户（管理员功能）
  router.post('/api/admin/users', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      const userData = (request as any).body as {
        username: string;
        email: string;
        password: string;
        display_name: string;
        avatar_url?: string;
        bio?: string;
        role?: 'admin' | 'editor';
      };
      
      // 验证必填字段
      if (!userData.username || !userData.email || !userData.password || !userData.display_name) {
        return jsonResponse({ 
          success: false, 
          error: 'Username, email, password, and display name are required' 
        }, 400);
      }
      
      // 验证密码长度
      if (userData.password.length < 6) {
        return jsonResponse({ 
          success: false, 
          error: 'Password must be at least 6 characters long' 
        }, 400);
      }
      
      const userService = new UserService(env.DB);
      const newUser = await userService.createUser(userData);
      
      // 返回创建的用户信息（不包含密码哈希）
      const { password_hash, ...userInfo } = newUser;
      
      return jsonResponse({ 
        success: true, 
        data: userInfo,
        message: 'User created successfully' 
      }, 201);
    } catch (error) {
      console.error('Create user error:', error);
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
        if (error.message.includes('Invalid email')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
      }
      return jsonResponse({ success: false, error: 'Failed to create user' }, 500);
    }
  }, [authMiddleware]);

  // 更新用户（管理员功能）
  router.put('/api/admin/users/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const userId = parseInt(params!.id);
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      if (isNaN(userId)) {
        return jsonResponse({ success: false, error: 'Invalid user ID' }, 400);
      }
      
      const updateData = (request as any).body as {
        username?: string;
        email?: string;
        display_name?: string;
        avatar_url?: string;
        bio?: string;
        role?: 'admin' | 'editor';
        is_active?: boolean;
      };
      
      const userService = new UserService(env.DB);
      const updatedUser = await userService.updateUser(userId, updateData);
      
      // 返回更新后的用户信息（不包含密码哈希）
      const { password_hash, ...userInfo } = updatedUser;
      
      return jsonResponse({ 
        success: true, 
        data: userInfo,
        message: 'User updated successfully' 
      });
    } catch (error) {
      console.error('Update user error:', error);
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return jsonResponse({ success: false, error: 'User not found' }, 404);
        }
        if (error.message.includes('already exists')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
        if (error.message.includes('Invalid email')) {
          return jsonResponse({ success: false, error: error.message }, 400);
        }
      }
      return jsonResponse({ success: false, error: 'Failed to update user' }, 500);
    }
  }, [authMiddleware]);

  // 重置用户密码（管理员功能）
  router.put('/api/admin/users/:id/password', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const userId = parseInt(params!.id);
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      if (isNaN(userId)) {
        return jsonResponse({ success: false, error: 'Invalid user ID' }, 400);
      }
      
      const { newPassword } = (request as any).body as { newPassword: string };
      
      // 验证新密码
      if (!newPassword || newPassword.length < 6) {
        return jsonResponse({ 
          success: false, 
          error: 'New password must be at least 6 characters long' 
        }, 400);
      }
      
      const userService = new UserService(env.DB);
      await userService.resetPassword(userId, newPassword);
      
      return jsonResponse({ 
        success: true, 
        message: 'Password reset successfully' 
      });
    } catch (error) {
      console.error('Reset password error:', error);
      return jsonResponse({ success: false, error: 'Failed to reset password' }, 500);
    }
  }, [authMiddleware]);

  // 切换用户状态（管理员功能）
  router.patch('/api/admin/users/:id/toggle', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const userId = parseInt(params!.id);
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      if (isNaN(userId)) {
        return jsonResponse({ success: false, error: 'Invalid user ID' }, 400);
      }
      
      // 不能禁用自己
      if (userId === user.id) {
        return jsonResponse({ success: false, error: 'Cannot disable your own account' }, 400);
      }
      
      const userService = new UserService(env.DB);
      const updatedUser = await userService.toggleUserStatus(userId);
      
      // 返回更新后的用户信息（不包含密码哈希）
      const { password_hash, ...userInfo } = updatedUser;
      
      return jsonResponse({ 
        success: true, 
        data: userInfo,
        message: 'User status updated successfully' 
      });
    } catch (error) {
      console.error('Toggle user status error:', error);
      if (error instanceof Error && error.message === 'User not found') {
        return jsonResponse({ success: false, error: 'User not found' }, 404);
      }
      return jsonResponse({ success: false, error: 'Failed to update user status' }, 500);
    }
  }, [authMiddleware]);

  // 删除用户（管理员功能）
  router.delete('/api/admin/users/:id', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      const userId = parseInt(params!.id);
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      if (isNaN(userId)) {
        return jsonResponse({ success: false, error: 'Invalid user ID' }, 400);
      }
      
      // 不能删除自己
      if (userId === user.id) {
        return jsonResponse({ success: false, error: 'Cannot delete your own account' }, 400);
      }
      
      const userService = new UserService(env.DB);
      await userService.deleteUser(userId);
      
      return jsonResponse({ 
        success: true, 
        message: 'User deleted successfully' 
      });
    } catch (error) {
      console.error('Delete user error:', error);
      if (error instanceof Error && error.message.includes('associated posts')) {
        return jsonResponse({ 
          success: false, 
          error: 'Cannot delete user with associated posts' 
        }, 400);
      }
      return jsonResponse({ success: false, error: 'Failed to delete user' }, 500);
    }
  }, [authMiddleware]);

  // 获取用户统计信息（管理员功能）
  router.get('/api/admin/users/stats', async (request, env: Env, ctx, params) => {
    try {
      const user = (request as any).user;
      
      // 检查管理员权限
      if (user.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Admin access required' }, 403);
      }
      
      const userService = new UserService(env.DB);
      const stats = await userService.getUserStats();
      
      return jsonResponse({ success: true, data: stats });
    } catch (error) {
      console.error('Get user stats error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch user stats' }, 500);
    }
  }, [authMiddleware]);
}
