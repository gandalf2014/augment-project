import { ApiResponse } from '../../_shared/utils.js';
import { hashPassword, generateToken } from '../../_shared/auth.js';

/**
 * Login/Register endpoint
 * POST /api/auth/login
 * Body: { password: string }
 * 
 * If password hash doesn't exist -> create new user (register)
 * If password hash exists -> return existing user (login)
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { password } = body;
    
    // Validate password
    if (!password || typeof password !== 'string') {
      return ApiResponse.error('请输入口令', 400, 'VALIDATION_ERROR');
    }
    
    if (password.length < 4) {
      return ApiResponse.error('口令长度至少4位', 400, 'VALIDATION_ERROR');
    }
    
    if (password.length > 100) {
      return ApiResponse.error('口令长度不能超过100位', 400, 'VALIDATION_ERROR');
    }
    
    // Hash the password
    const passwordHash = await hashPassword(password);
    
    // Check if user exists
    const existingUser = await env.DB.prepare(
      'SELECT id, password_hash, created_at, last_login_at FROM users WHERE password_hash = ?'
    ).bind(passwordHash).first();
    
    let user;
    let isNewUser = false;
    
    if (existingUser) {
      // Existing user - login
      user = existingUser;
      
      // Update last_login_at
      await env.DB.prepare(
        'UPDATE users SET last_login_at = datetime("now") WHERE id = ?'
      ).bind(user.id).run();
    } else {
      // New user - register
      isNewUser = true;
      
      const result = await env.DB.prepare(
        'INSERT INTO users (password_hash, created_at, last_login_at) VALUES (?, datetime("now"), datetime("now"))'
      ).bind(passwordHash).run();
      
      if (!result.success) {
        return ApiResponse.error('创建用户失败', 500, 'DATABASE_ERROR');
      }
      
      user = {
        id: result.meta.last_row_id,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };
      
      // Create default notebook for new user
      await env.DB.prepare(
        'INSERT INTO notebooks (name, icon, user_id, created_at, updated_at) VALUES ("未分类", "📁", ?, datetime("now"), datetime("now"))'
      ).bind(user.id).run();
    }
    
    // Generate session token
    const token = await generateToken(user.id);
    
    // Return success with token in cookie
    const response = ApiResponse.success({
      userId: user.id,
      isNewUser,
      message: isNewUser ? '新用户已创建' : '登录成功'
    });
    
    // Set cookie (expires in 30 days)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    response.headers.set('Set-Cookie', `auth_token=${token}; Path=/; Expires=${expires}; SameSite=Strict`);
    
    return response;
    
  } catch (error) {
    console.error('Auth error:', error);
    return ApiResponse.error(error.message, 500, 'AUTH_ERROR');
  }
}

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
export async function onRequestPostLogout(context) {
  const response = ApiResponse.success({ message: '已退出登录' });
  response.headers.set('Set-Cookie', 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return response;
}

/**
 * Check auth status
 * GET /api/auth/status
 */
export async function onRequestGet(context) {
  const { request } = context;
  
  // Check for auth token
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');
  
  let hasAuth = false;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    hasAuth = true;
  } else if (cookieHeader && cookieHeader.includes('auth_token=')) {
    hasAuth = true;
  }
  
  return ApiResponse.success({
    authenticated: hasAuth,
    message: hasAuth ? '已登录' : '未登录'
  });
}