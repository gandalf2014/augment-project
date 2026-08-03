/**
 * 中间件集合
 * 提供请求处理、错误处理、认证等功能
 */

import type { Middleware } from '../utils/router';
import { verifyJWT } from '../utils/auth';
import { AppError, ValidationError, RateLimitError } from '../utils/errors';

// Security response headers applied to every response
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

// Decide whether a request origin is allowed to make cross-origin calls:
// - No Origin header (same-origin / non-browser): not cross-origin, no CORS header needed.
// - ALLOWED_ORIGINS whitelist configured: only whitelisted origins get CORS headers.
// - No whitelist: all cross-origin requests are rejected (same-origin only).
function isOriginAllowed(request: Request, env: any): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false; // 同源请求，不需要 CORS

  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin);
}

// CORS middleware: same-origin only by default; cross-origin requires ALLOWED_ORIGINS.
export const corsMiddleware: Middleware = async (request, env, ctx, next) => {
  const origin = request.headers.get('Origin');
  const allowCrossOrigin = origin ? isOriginAllowed(request, env) : false;

  const applyCorsAndSecurityHeaders = (response: Response) => {
    // 安全响应头
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Echo CORS headers only when the origin is on the whitelist
    if (allowCrossOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin as string);
      response.headers.set('Vary', 'Origin');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    return response;
  };

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return applyCorsAndSecurityHeaders(new Response(null, { status: 204 }));
  }

  const response = await next();

  // 确保响应存在且有 headers 属性
  if (!response || !response.headers) {
    const errorResponse = new Response('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return applyCorsAndSecurityHeaders(errorResponse);
  }

  return applyCorsAndSecurityHeaders(response);
};

// 日志中间件
export const loggerMiddleware: Middleware = async (request, env, ctx, next) => {
  const start = Date.now();
  const url = new URL(request.url);
  const requestId = generateRequestId();

  // 添加请求 ID
  (request as any).requestId = requestId;

  const queryObj: Record<string, string> = {};
  const sensitiveKeys = ['token', 'password', 'authorization', 'jwt', 'secret', 'api_key', 'apikey'];
  url.searchParams.forEach((value, key) => {
    queryObj[key] = sensitiveKeys.some(k => key.toLowerCase().includes(k))
      ? '[REDACTED]'
      : value;
  });

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    requestId,
    method: request.method,
    path: url.pathname,
    query: queryObj,
    ip: request.headers.get('CF-Connecting-IP') || 'unknown'
  }));

  const response = await next();
  const duration = Date.now() - start;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    requestId,
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration
  }));

  // 添加请求 ID 到响应头
  response.headers.set('X-Request-ID', requestId);

  return response;
};

// 错误处理中间件
export const errorMiddleware: Middleware = async (request, env, ctx, next) => {
  try {
    return await next();
  } catch (error) {
    const requestId = (request as any).requestId;

    // 应用自定义错误
    if (error instanceof AppError) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId,
        error: error.message,
        code: error.code,
        stack: error.stack
      }));

      return jsonResponse(error.toJSON(), error.statusCode);
    }

    // Zod 验证错误
    if (error && typeof error === 'object' && 'errors' in error) {
      const validationError = new ValidationError('数据验证失败', (error as any).errors);
      return jsonResponse(validationError.toJSON(), 400);
    }

    // JWT 错误
    if (error instanceof Error && error.message.includes('JWT')) {
      return jsonResponse({
        success: false,
        error: 'Invalid or expired token',
        code: 'AUTH_ERROR'
      }, 401);
    }

    // 数据库错误
    if (error instanceof Error && error.message.includes('D1')) {
      console.error('Database error:', error);
      return jsonResponse({
        success: false,
        error: 'Database operation failed',
        code: 'DB_ERROR'
      }, 500);
    }

    // 未知错误：无论环境如何，均不向客户端暴露内部错误细节（细节只进日志）
    console.error('Unhandled error:', error);
    return jsonResponse({
      success: false,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      requestId
    }, 500);
  }
};

// Auth middleware: only accepts Authorization: Bearer <token>.
// Tokens in URLs are rejected so they cannot leak via logs / history / Referer.
export const authMiddleware: Middleware = async (request, env, ctx, next) => {
  // 仅接受 Authorization: Bearer <token>，杜绝 token 出现在 URL / 日志 / Referer 中
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return jsonResponse({
      success: false,
      error: 'Missing authorization token',
      code: 'MISSING_TOKEN'
    }, 401);
  }

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    (request as any).user = payload;
    return await next();
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    }, 401);
  }
};

// 可选认证中间件
export const optionalAuthMiddleware: Middleware = async (request, env, ctx, next) => {
  const authHeader = request.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      (request as any).user = payload;
    } catch (error) {
      // 忽略认证错误，继续处理请求
    }
  }

  return await next();
};

// 管理员权限中间件
export const adminMiddleware: Middleware = async (request, env, ctx, next) => {
  const user = (request as any).user;

  if (!user || user.role !== 'admin') {
    return jsonResponse({
      success: false,
      error: 'Admin access required',
      code: 'FORBIDDEN'
    }, 403);
  }

  return await next();
};

// 内容类型解析中间件
export const parseBodyMiddleware: Middleware = async (request, env, ctx, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('Content-Type');

    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        (ctx as any).requestBody = body;
      } catch (error) {
        return jsonResponse({
          success: false,
          error: 'Invalid JSON body',
          code: 'INVALID_JSON'
        }, 400);
      }
    } else if (contentType?.includes('application/x-www-form-urlencoded') || contentType?.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        const body: Record<string, any> = {};
        formData.forEach((value, key) => {
          body[key] = value;
        });
        (ctx as any).requestBody = body;
      } catch (error) {
        return jsonResponse({
          success: false,
          error: 'Invalid form data',
          code: 'INVALID_FORM'
        }, 400);
      }
    }
  }

  return await next();
};

// 缓存中间件
export const cacheMiddleware = (maxAge: number = 3600): Middleware => {
  return async (request, env, ctx, next) => {
    if (request.method !== 'GET') {
      return await next();
    }

    const response = await next();

    // 设置缓存头
    response.headers.set('Cache-Control', `public, max-age=${maxAge}`);
    response.headers.set('CDN-Cache-Control', `public, max-age=${maxAge}`);

    return response;
  };
};

// Rate Limit 中间件（需要 KV）
export const rateLimitMiddleware = (
  options: {
    limit?: number;
    windowMs?: number;
    keyGenerator?: (request: Request) => string;
  } = {}
): Middleware => {
  const {
    limit = 100,
    windowMs = 60000, // 1分钟
    keyGenerator = (req) => req.headers.get('CF-Connecting-IP') || 'unknown'
  } = options;

  return async (request, env: any, ctx, next) => {
    // 如果没有 KV，跳过 rate limiting
    if (!env.KV) {
      return await next();
    }

    const key = `ratelimit:${keyGenerator(request)}`;

    try {
      const count = await env.KV.get(key);
      const currentCount = count ? parseInt(count) : 0;

      if (currentCount >= limit) {
        throw new RateLimitError(Math.ceil(windowMs / 1000));
      }

      // 增加计数
      await env.KV.put(key, String(currentCount + 1), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });

      return await next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return jsonResponse(error.toJSON(), 429);
      }
      // KV 错误时继续处理
      return await next();
    }
  };
};

// 工具函数
export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function getRequestBody(ctx: ExecutionContext): any {
  return (ctx as any).requestBody;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}