/**
 * 用户服务
 */

import type { 
  User, 
  AuthUser,
  LoginRequest,
  Env 
} from '../types/database';
import { 
  hashPassword, 
  verifyPassword, 
  generateJWT 
} from '../utils/auth';
import { isValidEmail } from '../utils/database';

export class UserService {
  constructor(private db: D1Database) {}

  // 用户登录
  async login(credentials: LoginRequest, jwtSecret: string): Promise<{
    user: AuthUser;
    token: string;
  }> {
    const { email, password } = credentials;
    
    // 验证邮箱格式
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    // 查找用户
    const user = await this.db.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first<User>();
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }
    
    // 创建认证用户对象
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role
    };
    
    // 生成 JWT token
    const token = await generateJWT(authUser, jwtSecret);
    
    return { user: authUser, token };
  }

  // 根据 ID 获取用户
  async getUserById(id: number): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first<User>();
    
    return result || null;
  }

  // 根据邮箱获取用户
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first<User>();
    
    return result || null;
  }

  // 根据用户名获取用户
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first<User>();
    
    return result || null;
  }

  // 获取所有用户（管理员功能）
  async getUsers(includeInactive: boolean = false): Promise<Omit<User, 'password_hash'>[]> {
    let query = `
      SELECT id, username, email, display_name, avatar_url, bio, role, is_active, created_at, updated_at
      FROM users
    `;
    
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.db.prepare(query).all<Omit<User, 'password_hash'>>();
    return result.results || [];
  }

  // 创建用户
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    role?: 'admin' | 'editor';
  }): Promise<User> {
    const { username, email, password, display_name, avatar_url, bio, role = 'editor' } = userData;
    
    // 验证邮箱格式
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    // 检查用户名是否已存在
    const existingUsername = await this.getUserByUsername(username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }
    
    // 检查邮箱是否已存在
    const existingEmail = await this.getUserByEmail(email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }
    
    // 哈希密码
    const passwordHash = await hashPassword(password);
    
    // 插入用户
    const result = await this.db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, avatar_url, bio, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      username,
      email,
      passwordHash,
      display_name,
      avatar_url || null,
      bio || null,
      role
    ).run();
    
    const userId = result.meta.last_row_id as number;
    
    // 返回创建的用户
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }
    
    return user;
  }

  // 更新用户信息
  async updateUser(id: number, updateData: {
    username?: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
    role?: 'admin' | 'editor';
    is_active?: boolean;
  }): Promise<User> {
    const { username, email, display_name, avatar_url, bio, role, is_active } = updateData;
    
    // 构建更新字段
    const fields: string[] = [];
    const values: any[] = [];
    
    if (username !== undefined) {
      // 检查用户名是否已被其他用户使用
      const existingUser = await this.getUserByUsername(username);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Username already exists');
      }
      fields.push('username = ?');
      values.push(username);
    }
    
    if (email !== undefined) {
      // 验证邮箱格式
      if (!isValidEmail(email)) {
        throw new Error('Invalid email format');
      }
      // 检查邮箱是否已被其他用户使用
      const existingUser = await this.getUserByEmail(email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already exists');
      }
      fields.push('email = ?');
      values.push(email);
    }
    
    if (display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(display_name);
    }
    
    if (avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(avatar_url);
    }
    
    if (bio !== undefined) {
      fields.push('bio = ?');
      values.push(bio);
    }
    
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    // 执行更新
    if (fields.length > 0) {
      await this.db.prepare(`
        UPDATE users SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values, id).run();
    }
    
    // 返回更新后的用户
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  // 更新密码
  async updatePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
    // 获取用户
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    // 验证当前密码
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }
    
    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword);
    
    // 更新密码
    await this.db.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPasswordHash, id).run();
  }

  // 重置密码（管理员功能）
  async resetPassword(id: number, newPassword: string): Promise<void> {
    // 哈希新密码
    const passwordHash = await hashPassword(newPassword);
    
    // 更新密码
    await this.db.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(passwordHash, id).run();
  }

  // 删除用户
  async deleteUser(id: number): Promise<void> {
    // 检查用户是否有文章
    const postCount = await this.db.prepare(
      'SELECT COUNT(*) as count FROM posts WHERE author_id = ?'
    ).bind(id).first<{ count: number }>();
    
    if (postCount && postCount.count > 0) {
      throw new Error('Cannot delete user with associated posts');
    }
    
    await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }

  // 切换用户状态
  async toggleUserStatus(id: number): Promise<User> {
    await this.db.prepare(`
      UPDATE users 
      SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END 
      WHERE id = ?
    `).bind(id).run();
    
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  // 获取用户统计信息
  async getUserStats(): Promise<{
    total: number;
    active: number;
    admins: number;
    editors: number;
  }> {
    const totalResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first<{ count: number }>();
    
    const activeResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    ).first<{ count: number }>();
    
    const adminsResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1'
    ).first<{ count: number }>();
    
    const editorsResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE role = "editor" AND is_active = 1'
    ).first<{ count: number }>();
    
    return {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      admins: adminsResult?.count || 0,
      editors: editorsResult?.count || 0
    };
  }
}
