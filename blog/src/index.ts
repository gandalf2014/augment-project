/**
 * 个人博客系统 - 主入口文件
 * 基于 Cloudflare Workers + D1 数据库
 */

import { router } from './utils/router';
import {
  corsMiddleware,
  loggerMiddleware,
  errorMiddleware,
  parseBodyMiddleware
} from './middleware';
import { registerPostRoutes } from './routes/posts';
import { registerCategoryRoutes } from './routes/categories';
import { registerTagRoutes } from './routes/tags';
import { registerAuthRoutes } from './routes/auth';
import { registerCommentRoutes } from './routes/comments';
import { registerPageRoutes } from './routes/pages';
import { registerAdminRoutes } from './routes/admin';
import type { Env } from './types/database';

// 注册全局中间件
router.use(corsMiddleware);
router.use(loggerMiddleware);
router.use(errorMiddleware);
router.use(parseBodyMiddleware);

// 注册路由
registerPageRoutes(router); // 页面路由要放在最前面，避免被 API 路由覆盖
registerAdminRoutes(router); // 管理后台路由
registerPostRoutes(router);
registerCategoryRoutes(router);
registerTagRoutes(router);
registerAuthRoutes(router);
registerCommentRoutes(router);

// 首页路由已经在 registerPageRoutes 中处理了

// 健康检查
router.get('/health', async (request, env, ctx) => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: env.DB ? 'connected' : 'disconnected'
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
