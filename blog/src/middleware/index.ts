/**
 * 中间件集合
 */

import type { Middleware } from '../utils/router';
import { verifyJWT } from '../utils/auth';

// CORS 中间件
export const corsMiddleware: Middleware = async (request, env, ctx, next) => {
  // 添加 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = await next();

  // 确保响应存在且有 headers 属性
  if (!response || !response.headers) {
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    });
  }

  // 添加 CORS 头到响应
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

// 日志中间件
export const loggerMiddleware: Middleware = async (request, env, ctx, next) => {
  const start = Date.now();
  const url = new URL(request.url);
  
  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
  
  const response = await next();
  const duration = Date.now() - start;
  
  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - ${response.status} (${duration}ms)`);
  
  return response;
};

// 错误处理中间件
export const errorMiddleware: Middleware = async (request, env, ctx, next) => {
  try {
    return await next();
  } catch (error) {
    console.error('Request error:', error);
    
    // 根据错误类型返回不同的响应
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      if (error.message.includes('Not Found')) {
        return jsonResponse({ success: false, error: 'Not Found' }, 404);
      }
      if (error.message.includes('Validation')) {
        return jsonResponse({ success: false, error: error.message }, 400);
      }
    }
    
    // 默认服务器错误
    return jsonResponse({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
};

// JSON 响应中间件
export const jsonResponseMiddleware: Middleware = async (request, env, ctx, next) => {
  const response = await next();
  
  // 如果响应已经设置了 Content-Type，则不修改
  if (response.headers.get('Content-Type')) {
    return response;
  }
  
  // 为 API 路由添加 JSON Content-Type
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    response.headers.set('Content-Type', 'application/json');
  }
  
  return response;
};

// 认证中间件
export const authMiddleware: Middleware = async (request, env, ctx, next) => {
  let token: string | null = null;

  // 首先尝试从 Authorization 头获取 token
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 如果没有 Authorization 头，尝试从 URL 参数获取 token
  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('token');
  }

  if (!token) {
    return jsonResponse({ success: false, error: 'Missing or invalid authorization header' }, 401);
  }

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);

    // 将用户信息添加到请求上下文
    (request as any).user = payload;

    return await next();
  } catch (error) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 401);
  }
};

// 可选认证中间件（不强制要求认证）
export const optionalAuthMiddleware: Middleware = async (request, env, ctx, next) => {
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      (request as any).user = payload;
    } catch (error) {
      // 忽略认证错误，继续处理请求
      console.warn('Optional auth failed:', error.message);
    }
  }
  
  return await next();
};

// 内容类型解析中间件
export const parseBodyMiddleware: Middleware = async (request, env, ctx, next) => {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    const contentType = request.headers.get('Content-Type');

    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        // 使用 ctx 来存储解析后的 body
        (ctx as any).requestBody = body;
      } catch (error) {
        console.error('JSON parse error:', error);
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
      }
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await request.formData();
        const body: Record<string, any> = {};
        for (const [key, value] of formData.entries()) {
          body[key] = value;
        }
        (ctx as any).requestBody = body;
      } catch (error) {
        console.error('Form data parse error:', error);
        return jsonResponse({ success: false, error: 'Invalid form data' }, 400);
      }
    }
  }

  return await next();
};

// 缓存中间件
export const cacheMiddleware = (maxAge: number = 3600): Middleware => {
  return async (request, env, ctx, next) => {
    // 只对 GET 请求启用缓存
    if (request.method !== 'GET') {
      return await next();
    }
    
    const response = await next();
    
    // 添加缓存头
    response.headers.set('Cache-Control', `public, max-age=${maxAge}`);
    
    return response;
  };
};

// 工具函数：创建 JSON 响应
export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// 工具函数：获取请求体
export function getRequestBody(ctx: ExecutionContext): any {
  return (ctx as any).requestBody;
}
