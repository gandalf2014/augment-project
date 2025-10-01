/**
 * 简单的路由器实现
 */

export type RouteHandler = (request: Request, env: any, ctx: ExecutionContext, params?: Record<string, string>) => Promise<Response>;

export interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
  middleware?: Middleware[];
}

export type Middleware = (request: Request, env: any, ctx: ExecutionContext, next: () => Promise<Response>) => Promise<Response>;

export class Router {
  private routes: Route[] = [];
  private globalMiddleware: Middleware[] = [];

  // 添加全局中间件
  use(middleware: Middleware) {
    this.globalMiddleware.push(middleware);
  }

  // 添加路由
  addRoute(method: string, pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      handler,
      middleware
    });
  }

  // HTTP 方法快捷方式
  get(pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.addRoute('GET', pattern, handler, middleware);
  }

  post(pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.addRoute('POST', pattern, handler, middleware);
  }

  put(pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.addRoute('PUT', pattern, handler, middleware);
  }

  delete(pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.addRoute('DELETE', pattern, handler, middleware);
  }

  patch(pattern: string, handler: RouteHandler, middleware: Middleware[] = []) {
    this.addRoute('PATCH', pattern, handler, middleware);
  }

  // 处理请求
  async handle(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const pathname = url.pathname;

    // 查找匹配的路由
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = this.matchRoute(route.pattern, pathname);
      if (params !== null) {
        // 构建中间件链
        const middlewareChain = [...this.globalMiddleware, ...route.middleware];
        
        // 执行中间件链
        return this.executeMiddleware(middlewareChain, request, env, ctx, () => 
          route.handler(request, env, ctx, params)
        );
      }
    }

    // 没有找到匹配的路由
    return new Response('Not Found', { status: 404 });
  }

  // 匹配路由模式
  private matchRoute(pattern: string, pathname: string): Record<string, string> | null {
    // 将路由模式转换为正则表达式
    const paramNames: string[] = [];
    const regexPattern = pattern
      .replace(/:([^\/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      })
      .replace(/\*/g, '(.*)')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);

    if (!match) return null;

    // 提取参数
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = decodeURIComponent(match[i + 1]);
    }

    return params;
  }

  // 执行中间件链
  private async executeMiddleware(
    middleware: Middleware[],
    request: Request,
    env: any,
    ctx: ExecutionContext,
    finalHandler: () => Promise<Response>
  ): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= middleware.length) {
        return finalHandler();
      }

      const currentMiddleware = middleware[index++];
      return currentMiddleware(request, env, ctx, next);
    };

    return next();
  }
}

// 创建全局路由器实例
export const router = new Router();
