/**
 * 管理后台路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { PostService } from '../services/postService';
import { CategoryService } from '../services/categoryService';
import { TagService } from '../services/tagService';
import { CommentService } from '../services/commentService';
import { UserService } from '../services/userService';
import { SettingService } from '../services/settingService';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

// 辅助函数：HTML转义
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



// Helper: embed a string safely into a single-quoted JS literal inside an onclick attribute.
// JS-escape first (backslash and quote), then HTML-escape, to prevent
// "HTML attribute decode -> JS string breakout" double-injection.
// Example: payload x');alert(1)// becomes x\');alert(1)// — \' is an escaped quote in JS.
function jsAttr(text: string): string {
  if (!text) return '';
  return escapeHtml(String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029'));
}
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-600 text-yellow-100';
    case 'approved':
      return 'bg-green-600 text-green-100';
    case 'rejected':
      return 'bg-red-600 text-red-100';
    case 'spam':
      return 'bg-gray-600 text-gray-100';
    default:
      return 'bg-gray-600 text-gray-100';
  }
}

// 辅助函数：获取评论状态文本
function getStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return '待审核';
    case 'approved':
      return '已通过';
    case 'rejected':
      return '已拒绝';
    case 'spam':
      return '垃圾评论';
    default:
      return '未知';
  }
}

// Helper: get the authenticated user from the request.
// optionalAuthMiddleware parses Authorization: Bearer <token> into request.user.
// Tokens are never accepted via URL params (would leak to logs/history/Referer).
async function getUserFromRequest(request: Request): Promise<any> {
  return (request as any).user || null;
}

export function registerAdminRoutes(router: Router) {
  
  // 管理后台首页
  router.get('/admin', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        // 返回一个检查 localStorage 的页面
        const html = renderAdminCheckAuth();
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }
      
      // 获取统计数据
      const [postService, categoryService, tagService, commentService, userService] = [
        new PostService(env.DB),
        new CategoryService(env.DB),
        new TagService(env.DB),
        new CommentService(env.DB),
        new UserService(env.DB)
      ];
      
      const [postStats, categoryStats, tagStats, commentStats, userStats] = await Promise.all([
        getPostStats(postService),
        categoryService.getCategoryStats(),
        tagService.getTagStats(),
        commentService.getCommentStats(),
        userService.getUserStats()
      ]);
      
      const html = renderAdminDashboard({
        user,
        stats: {
          posts: postStats,
          categories: categoryStats,
          tags: tagStats,
          comments: commentStats,
          users: userStats
        }
      });
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Authenticated': 'true',
        },
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [optionalAuthMiddleware]);

  // 登录页面
  router.get('/admin/login', async (request, env: Env, ctx, params) => {
    const html = renderLoginPage();
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  });

  // 文章管理页面
  router.get('/admin/posts', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const status = url.searchParams.get('status') || '';
      
      const postService = new PostService(env.DB);
      const postsResult = await postService.getPosts({
        page,
        limit: 20,
        status: status || undefined,
        author: user.role === 'admin' ? undefined : user.id
      });
      
      const html = renderPostsManagement(user, postsResult);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Posts management error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 新建文章页面
  router.get('/admin/posts/new', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      const categoryService = new CategoryService(env.DB);
      const categories = await categoryService.getCategories();

      const html = renderPostEditor(user, null, categories);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('New post page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 编辑文章页面
  router.get('/admin/posts/:id/edit', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      const postId = parseInt(params!.id);
      const postService = new PostService(env.DB);
      const categoryService = new CategoryService(env.DB);

      const [post, categories] = await Promise.all([
        postService.getPostById(postId),
        categoryService.getCategories()
      ]);

      if (!post) {
        return new Response('Post not found', { status: 404 });
      }

      const html = renderPostEditor(user, post, categories);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Edit post page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 评论管理页面
  router.get('/admin/comments', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const status = url.searchParams.get('status') || '';
      
      const commentService = new CommentService(env.DB);
      const commentsResult = await commentService.getComments({
        page,
        limit: 20,
        status: status || undefined
      });
      
      const html = renderCommentsManagement(commentsResult);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Comments management error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 分类管理页面
  router.get('/admin/categories', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      const categoryService = new CategoryService(env.DB);
      const categories = await categoryService.getCategories(true);
      
      const html = renderCategoriesManagement(categories);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Categories management error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 标签管理页面
  router.get('/admin/tags', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      const tagService = new TagService(env.DB);
      const tags = await tagService.getTags();
      
      const html = renderTagsManagement(tags);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Tags management error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);

  // 用户管理页面（仅管理员）
  router.get('/admin/users', async (request, env: Env, ctx, params) => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      if (user.role !== 'admin') {
        return new Response('Forbidden', { status: 403 });
      }
      
      const userService = new UserService(env.DB);
      const users = await userService.getUsers(true);
      
      const html = renderUsersManagement(users);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Users management error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }, [authMiddleware]);
}

// 获取文章统计
async function getPostStats(postService: PostService): Promise<any> {
  const [published, draft, total] = await Promise.all([
    postService.getPosts({ status: 'published', limit: 1 }),
    postService.getPosts({ status: 'draft', limit: 1 }),
    postService.getPosts({ limit: 1 })
  ]);
  
  return {
    total: total.pagination.total,
    published: published.pagination.total,
    draft: draft.pagination.total
  };
}

// 管理后台认证检查页面
function renderAdminCheckAuth(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <div class="loading inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <p class="mt-4 text-gray-600">正在验证身份...</p>
  </div>

  <script>
    async function checkAuth() {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        // 没有 token，跳转到登录页面
        window.location.href = '/admin/login';
        return;
      }

      try {
        // Request the admin page with the Authorization header so the token never appears in the URL
        const response = await fetch('/admin', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (response.ok && response.headers.get('X-Authenticated') === 'true') {
          // Token 有效，用服务端渲染的管理后台页面替换当前文档
          const html = await response.text();
          document.open();
          document.write(html);
          document.close();
        } else {
          // Token 无效，清除并跳转到登录页面
          localStorage.removeItem('auth_token');
          window.location.href = '/admin/login';
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
        window.location.href = '/admin/login';
      }
    }

    // 页面加载时检查认证
    checkAuth();
  </script>
</body>
</html>`;
}

// 登录页面模板
function renderLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理员登录</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full">
    <!-- 返回首页链接 -->
    <div class="mb-6">
      <a href="/" class="inline-flex items-center text-gray-400 hover:text-gray-200 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        返回首页
      </a>
    </div>

    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-md p-8 border border-slate-700 dark:border-slate-700">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-100 dark:text-gray-100">管理员登录</h1>
        <p class="text-gray-400 mt-2">请输入您的账户信息</p>
      </div>

      <form id="login-form" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">邮箱</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
              </svg>
            </div>
            <input type="email" id="email" name="email" required
                   class="w-full pl-10 pr-3 py-3 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                   placeholder="admin@example.com">
          </div>
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">密码</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <input type="password" id="password" name="password" required
                   class="w-full pl-10 pr-12 py-3 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                   placeholder="请输入密码">
            <button type="button" id="toggle-password" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-200 transition-colors">
              <svg id="eye-icon" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit"
                class="w-full bg-blue-600 dark:bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors font-medium flex items-center justify-center">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
          </svg>
          登录
        </button>
      </form>

      <div id="error-message" class="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm hidden"></div>
    </div>

    <p class="text-center text-gray-500 text-sm mt-6">
      默认账户: admin@example.com / password
    </p>
  </div>

  <script>
    // 密码可见性切换
    document.getElementById('toggle-password').addEventListener('click', function() {
      const passwordInput = document.getElementById('password');
      const eyeIcon = document.getElementById('eye-icon');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>';
      } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
      }
    });

    // 登录表单提交
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();

      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>登录中...';

      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          localStorage.setItem('auth_token', result.data.token);
          window.location.href = '/admin';
        } else {
          const errorDiv = document.getElementById('error-message');
          errorDiv.textContent = result.error;
          errorDiv.classList.remove('hidden');
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = '登录失败，请稍后重试';
        errorDiv.classList.remove('hidden');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

// 管理后台仪表板模板
function renderAdminDashboard(data: any): string {
  const { user, stats } = data;
  
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  ${renderAdminHeader(user)}

  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100 mb-8">仪表板</h1>
    
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-900 dark:bg-blue-900 rounded-lg">
            <svg class="w-6 h-6 text-blue-400 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400 dark:text-gray-400">文章总数</p>
            <p class="text-2xl font-semibold text-gray-100 dark:text-gray-100">${stats.posts.total}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-900 dark:bg-green-900 rounded-lg">
            <svg class="w-6 h-6 text-green-400 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400 dark:text-gray-400">分类数量</p>
            <p class="text-2xl font-semibold text-gray-100 dark:text-gray-100">${stats.categories.total}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-900 dark:bg-yellow-900 rounded-lg">
            <svg class="w-6 h-6 text-yellow-400 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400 dark:text-gray-400">评论总数</p>
            <p class="text-2xl font-semibold text-gray-100 dark:text-gray-100">${stats.comments.total}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-900 dark:bg-purple-900 rounded-lg">
            <svg class="w-6 h-6 text-purple-400 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400 dark:text-gray-400">用户数量</p>
            <p class="text-2xl font-semibold text-gray-100 dark:text-gray-100">${stats.users.total}</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 快速操作 -->
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
      <h2 class="text-xl font-semibold text-gray-100 dark:text-gray-100 mb-4">快速操作</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="#" onclick="navigateWithToken('/admin/posts')" class="block p-4 border border-slate-600 dark:border-slate-600 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors cursor-pointer">
          <h3 class="font-medium text-gray-100 dark:text-gray-100">管理文章</h3>
          <p class="text-sm text-gray-300 dark:text-gray-300">创建、编辑和管理博客文章</p>
        </a>
        <a href="#" onclick="navigateWithToken('/admin/comments')" class="block p-4 border border-slate-600 dark:border-slate-600 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors cursor-pointer">
          <h3 class="font-medium text-gray-100 dark:text-gray-100">管理评论</h3>
          <p class="text-sm text-gray-300 dark:text-gray-300">审核和管理用户评论</p>
        </a>
        <a href="#" onclick="navigateWithToken('/admin/categories')" class="block p-4 border border-slate-600 dark:border-slate-600 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors cursor-pointer">
          <h3 class="font-medium text-gray-100 dark:text-gray-100">管理分类</h3>
          <p class="text-sm text-gray-300 dark:text-gray-300">创建和管理文章分类</p>
        </a>
      </div>
    </div>
  </div>

  <script>
    function navigateWithToken(path) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Pass the token via the Authorization header so it never appears in the URL / logs / Referer
        fetch(path, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (response) {
            if (response.ok) {
              return response.text().then(function (html) {
                document.open();
                document.write(html);
                document.close();
              });
            }
            window.location.href = '/admin/login';
          })
          .catch(function () {
            window.location.href = '/admin/login';
          });
      } else {
        window.location.href = '/admin/login';
      }
    }
  </script>
</body>
</html>`;
}

// 管理后台头部
function renderAdminHeader(user: any): string {
  return `
  <header class="bg-slate-800 dark:bg-slate-800 shadow border-b border-slate-700 dark:border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <a href="#" onclick="navigateWithToken('/admin')" class="text-xl font-bold text-gray-100 dark:text-gray-100">管理后台</a>
          <nav class="ml-8 flex space-x-4">
            <a href="#" onclick="navigateWithToken('/admin/posts')" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">文章</a>
            <a href="#" onclick="navigateWithToken('/admin/comments')" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">评论</a>
            <a href="#" onclick="navigateWithToken('/admin/categories')" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">分类</a>
            <a href="#" onclick="navigateWithToken('/admin/tags')" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">标签</a>
            ${user.role === 'admin' ? '<a href="#" onclick="navigateWithToken(\'/admin/users\')" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">用户</a>' : ''}
          </nav>
        </div>

        <div class="flex items-center space-x-4">
          <a href="/" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">查看网站</a>
          <span class="text-gray-300 dark:text-gray-300">欢迎，${user.display_name}</span>
          <button onclick="logout()" class="text-red-400 dark:text-red-400 hover:text-red-300 dark:hover:text-red-300">退出</button>
        </div>
      </div>
    </div>
  </header>

  <script>
    function navigateWithToken(path) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Pass the token via the Authorization header so it never appears in the URL / logs / Referer
        fetch(path, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (response) {
            if (response.ok) {
              return response.text().then(function (html) {
                document.open();
                document.write(html);
                document.close();
              });
            }
            window.location.href = '/admin/login';
          })
          .catch(function () {
            window.location.href = '/admin/login';
          });
      } else {
        window.location.href = '/admin/login';
      }
    }

    function logout() {
      localStorage.removeItem('auth_token');
      window.location.href = '/admin/login';
    }
  </script>`;
}

// 文章管理页面模板
function renderPostsManagement(user: any, postsResult: any): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文章管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  ${renderAdminHeader(user)}

  <div class="container mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">文章管理</h1>
      <button onclick="navigateWithToken('/admin/posts/new')" class="bg-blue-600 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors">
        新建文章
      </button>
    </div>
    
    <!-- 文章列表 -->
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 overflow-hidden">
      <table class="min-w-full divide-y divide-slate-700 dark:divide-slate-700">
        <thead class="bg-slate-700 dark:bg-slate-700">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-300 uppercase tracking-wider">标题</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-300 uppercase tracking-wider">状态</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-300 uppercase tracking-wider">分类</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-300 uppercase tracking-wider">发布时间</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 dark:text-gray-300 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="bg-slate-800 dark:bg-slate-800 divide-y divide-slate-700 dark:divide-slate-700">
          ${postsResult.data.map((post: any) => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-100 dark:text-gray-100">${escapeHtml(post.title)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  post.status === 'published' ? 'bg-green-900 dark:bg-green-900 text-green-200 dark:text-green-200' :
                  post.status === 'draft' ? 'bg-yellow-900 dark:bg-yellow-900 text-yellow-200 dark:text-yellow-200' :
                  'bg-gray-700 dark:bg-gray-700 text-gray-200 dark:text-gray-200'
                }">
                  ${post.status === 'published' ? '已发布' : post.status === 'draft' ? '草稿' : '已归档'}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-100 dark:text-gray-100">
                ${post.category_name || '无分类'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-400">
                ${post.published_at ? new Date(post.published_at).toLocaleDateString('zh-CN') : '-'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <a href="/posts/${post.slug}" class="text-blue-400 dark:text-blue-400 hover:text-blue-300 dark:hover:text-blue-300 mr-3">查看</a>
                <button onclick="navigateWithToken('/admin/posts/${post.id}/edit')" class="text-indigo-400 dark:text-indigo-400 hover:text-indigo-300 dark:hover:text-indigo-300 mr-3">编辑</button>
                <button onclick="deletePost(${post.id})" class="text-red-400 dark:text-red-400 hover:text-red-300 dark:hover:text-red-300">删除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function navigateWithToken(path) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Pass the token via the Authorization header so it never appears in the URL / logs / Referer
        fetch(path, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (response) {
            if (response.ok) {
              return response.text().then(function (html) {
                document.open();
                document.write(html);
                document.close();
              });
            }
            window.location.href = '/admin/login';
          })
          .catch(function () {
            window.location.href = '/admin/login';
          });
      } else {
        window.location.href = '/admin/login';
      }
    }

    async function deletePost(postId) {
      if (!confirm('确定要删除这篇文章吗？此操作不可恢复。')) {
        return;
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      try {
        const response = await fetch(\`/api/admin/posts/\${postId}\`, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        const result = await response.json();

        if (result.success) {
          alert('文章删除成功！');
          window.location.reload();
        } else {
          alert('删除失败：' + result.error);
        }
      } catch (error) {
        alert('删除失败：' + error.message);
      }
    }
  </script>
</body>
</html>`;
}

// 评论管理页面模板
function renderCommentsManagement(commentsResult: any): string {
  const { data: comments, pagination } = commentsResult;

  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>评论管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">评论管理</h1>
        <p class="text-gray-300 dark:text-gray-300 mt-2">共 ${pagination.total} 条评论</p>
      </div>
      <button onclick="goBack()" class="bg-slate-700 hover:bg-slate-600 text-gray-100 px-4 py-2 rounded-lg transition-colors">
        返回
      </button>
    </div>

    <!-- 状态筛选 -->
    <div class="mb-6">
      <div class="flex flex-wrap gap-2">
        <button onclick="filterComments('')" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
          全部
        </button>
        <button onclick="filterComments('pending')" class="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white transition-colors">
          待审核
        </button>
        <button onclick="filterComments('approved')" class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors">
          已通过
        </button>
        <button onclick="filterComments('rejected')" class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors">
          已拒绝
        </button>
        <button onclick="filterComments('spam')" class="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors">
          垃圾评论
        </button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="space-y-4">
      ${comments.map((comment: any) => `
        <div class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-4 mb-3">
                <h3 class="font-semibold text-gray-100 dark:text-gray-100">${escapeHtml(comment.author_name)}</h3>
                <span class="text-sm text-gray-400 dark:text-gray-400">${escapeHtml(comment.author_email)}</span>
                <span class="text-sm text-gray-400 dark:text-gray-400">${new Date(comment.created_at).toLocaleString('zh-CN')}</span>
                <span class="px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(comment.status)}">
                  ${getStatusText(comment.status)}
                </span>
              </div>
              <p class="text-gray-300 dark:text-gray-300 mb-3">${escapeHtml(comment.content)}</p>
              <p class="text-sm text-gray-400 dark:text-gray-400">
                文章：<a href="/posts/${comment.post_slug}" class="text-blue-400 hover:text-blue-300">${escapeHtml(comment.post_title)}</a>
              </p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              ${comment.status === 'pending' ? `
                <button onclick="updateCommentStatus(${comment.id}, 'approved')"
                        class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                  通过
                </button>
                <button onclick="updateCommentStatus(${comment.id}, 'rejected')"
                        class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                  拒绝
                </button>
              ` : comment.status === 'approved' ? `
                <button onclick="updateCommentStatus(${comment.id}, 'rejected')"
                        class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                  拒绝
                </button>
              ` : comment.status === 'rejected' ? `
                <button onclick="updateCommentStatus(${comment.id}, 'approved')"
                        class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                  通过
                </button>
              ` : ''}
              <button onclick="updateCommentStatus(${comment.id}, 'spam')"
                      class="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors">
                标记垃圾
              </button>
              <button onclick="deleteComment(${comment.id})"
                      class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                删除
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 分页 -->
    ${pagination.totalPages > 1 ? `
      <div class="mt-8 flex justify-center">
        <div class="flex items-center gap-2">
          ${pagination.currentPage > 1 ? `
            <a href="?page=${pagination.currentPage - 1}"
               class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-100 rounded transition-colors">
              上一页
            </a>
          ` : ''}

          ${Array.from({length: pagination.totalPages}, (_, i) => i + 1).map(page => `
            <a href="?page=${page}"
               class="px-3 py-2 ${page === pagination.currentPage ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} text-gray-100 rounded transition-colors">
              ${page}
            </a>
          `).join('')}

          ${pagination.currentPage < pagination.totalPages ? `
            <a href="?page=${pagination.currentPage + 1}"
               class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-100 rounded transition-colors">
              下一页
            </a>
          ` : ''}
        </div>
      </div>
    ` : ''}
  </div>

  <script>
    // 获取JWT token
    function getToken() {
      return localStorage.getItem('auth_token');
    }

    // 返回上一页
    function goBack() {
      window.location.href = '/admin';
    }

    // 筛选评论
    function filterComments(status) {
      const url = new URL(window.location);
      if (status) {
        url.searchParams.set('status', status);
      } else {
        url.searchParams.delete('status');
      }
      url.searchParams.delete('page'); // 重置页码
      window.location.href = url.toString();
    }

    // 更新评论状态
    async function updateCommentStatus(commentId, status) {
      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      try {
        const response = await fetch(\`/api/admin/comments/\${commentId}/status\`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({ status })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('操作失败：' + result.error);
        }
      } catch (error) {
        console.error('Update comment status error:', error);
        alert('操作失败');
      }
    }

    // 删除评论
    async function deleteComment(commentId) {
      if (!confirm('确定要删除这条评论吗？')) {
        return;
      }

      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      try {
        const response = await fetch(\`/api/admin/comments/\${commentId}\`, {
          method: 'DELETE',
          headers: {
            'Authorization': \`Bearer \${token}\`
          }
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('删除失败：' + result.error);
        }
      } catch (error) {
        console.error('Delete comment error:', error);
        alert('删除失败');
      }
    }
  </script>
</body>
</html>`;
}

// 分类管理页面模板
function renderCategoriesManagement(categories: any[]): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分类管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">分类管理</h1>
        <p class="text-gray-300 dark:text-gray-300 mt-2">共 ${categories.length} 个分类</p>
      </div>
      <div class="flex items-center gap-4">
        <button onclick="showCreateForm()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          新建分类
        </button>
        <button onclick="goBack()" class="bg-slate-700 hover:bg-slate-600 text-gray-100 px-4 py-2 rounded-lg transition-colors">
          返回
        </button>
      </div>
    </div>

    <!-- 新建分类表单 -->
    <div id="createForm" class="hidden mb-8 bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6">
      <h2 class="text-xl font-semibold text-gray-100 dark:text-gray-100 mb-4">新建分类</h2>
      <form onsubmit="createCategory(event)" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">分类名称</label>
          <input type="text" id="categoryName" required
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">分类别名 (URL)</label>
          <input type="text" id="categorySlug"
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 placeholder="留空自动生成">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">描述</label>
          <textarea id="categoryDescription" rows="3"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
        </div>
        <div class="flex items-center gap-4">
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            创建分类
          </button>
          <button type="button" onclick="hideCreateForm()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
            取消
          </button>
        </div>
      </form>
    </div>

    <!-- 分类列表 -->
    <div class="space-y-4">
      ${categories.map((category: any) => `
        <div class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-4 mb-2">
                <h3 class="text-lg font-semibold text-gray-100 dark:text-gray-100">${escapeHtml(category.name)}</h3>
                <span class="text-sm text-gray-400 dark:text-gray-400">/${escapeHtml(category.slug)}</span>
                <span class="px-2 py-1 rounded text-xs font-medium ${category.is_active ? 'bg-green-600 text-green-100' : 'bg-gray-600 text-gray-100'}">
                  ${category.is_active ? '启用' : '禁用'}
                </span>
                ${category.post_count ? `
                  <span class="text-sm text-gray-400 dark:text-gray-400">${category.post_count} 篇文章</span>
                ` : ''}
              </div>
              ${category.description ? `
                <p class="text-gray-300 dark:text-gray-300 text-sm">${escapeHtml(category.description)}</p>
              ` : ''}
              <p class="text-xs text-gray-400 dark:text-gray-400 mt-2">
                创建时间：${new Date(category.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button onclick="editCategory(${category.id}, '${jsAttr(category.name)}', '${jsAttr(category.slug)}', '${jsAttr(category.description || '')}', ${category.is_active})"
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                编辑
              </button>
              <button onclick="toggleCategoryStatus(${category.id}, ${!category.is_active})"
                      class="px-3 py-1 ${category.is_active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white text-sm rounded transition-colors">
                ${category.is_active ? '禁用' : '启用'}
              </button>
              <button onclick="deleteCategory(${category.id}, '${jsAttr(category.name)}')"
                      class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                删除
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    ${categories.length === 0 ? `
      <div class="text-center py-12">
        <p class="text-gray-400 dark:text-gray-400 text-lg">暂无分类</p>
        <button onclick="showCreateForm()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
          创建第一个分类
        </button>
      </div>
    ` : ''}
  </div>

  <!-- 编辑分类模态框 -->
  <div id="editModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-semibold text-gray-100 dark:text-gray-100 mb-4">编辑分类</h2>
      <form onsubmit="updateCategory(event)" class="space-y-4">
        <input type="hidden" id="editCategoryId">
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">分类名称</label>
          <input type="text" id="editCategoryName" required
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">分类别名 (URL)</label>
          <input type="text" id="editCategorySlug"
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">描述</label>
          <textarea id="editCategoryDescription" rows="3"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
        </div>
        <div class="flex items-center">
          <input type="checkbox" id="editCategoryActive" class="mr-2">
          <label for="editCategoryActive" class="text-sm text-gray-300 dark:text-gray-300">启用分类</label>
        </div>
        <div class="flex items-center gap-4">
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            更新分类
          </button>
          <button type="button" onclick="hideEditModal()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
            取消
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // 获取JWT token
    function getToken() {
      return localStorage.getItem('auth_token');
    }

    // 返回上一页
    function goBack() {
      window.location.href = '/admin';
    }

    // 显示创建表单
    function showCreateForm() {
      document.getElementById('createForm').classList.remove('hidden');
      document.getElementById('categoryName').focus();
    }

    // 隐藏创建表单
    function hideCreateForm() {
      document.getElementById('createForm').classList.add('hidden');
      document.getElementById('categoryName').value = '';
      document.getElementById('categorySlug').value = '';
      document.getElementById('categoryDescription').value = '';
    }

    // 创建分类
    async function createCategory(event) {
      event.preventDefault();

      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      const name = document.getElementById('categoryName').value;
      const slug = document.getElementById('categorySlug').value;
      const description = document.getElementById('categoryDescription').value;

      try {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({
            name,
            slug: slug || undefined,
            description: description || undefined
          })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('创建失败：' + result.error);
        }
      } catch (error) {
        console.error('Create category error:', error);
        alert('创建失败');
      }
    }

    // 编辑分类
    function editCategory(id, name, slug, description, isActive) {
      document.getElementById('editCategoryId').value = id;
      document.getElementById('editCategoryName').value = name;
      document.getElementById('editCategorySlug').value = slug;
      document.getElementById('editCategoryDescription').value = description;
      document.getElementById('editCategoryActive').checked = isActive;
      document.getElementById('editModal').classList.remove('hidden');
    }

    // 隐藏编辑模态框
    function hideEditModal() {
      document.getElementById('editModal').classList.add('hidden');
    }

    // 更新分类
    async function updateCategory(event) {
      event.preventDefault();

      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      const id = document.getElementById('editCategoryId').value;
      const name = document.getElementById('editCategoryName').value;
      const slug = document.getElementById('editCategorySlug').value;
      const description = document.getElementById('editCategoryDescription').value;
      const isActive = document.getElementById('editCategoryActive').checked;

      try {
        const response = await fetch(\`/api/categories/\${id}\`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({
            name,
            slug,
            description: description || undefined,
            is_active: isActive
          })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('更新失败：' + result.error);
        }
      } catch (error) {
        console.error('Update category error:', error);
        alert('更新失败');
      }
    }

    // 切换分类状态
    async function toggleCategoryStatus(id, isActive) {
      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      try {
        const response = await fetch(\`/api/categories/\${id}\`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({
            is_active: isActive
          })
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('操作失败：' + result.error);
        }
      } catch (error) {
        console.error('Toggle category status error:', error);
        alert('操作失败');
      }
    }

    // 删除分类
    async function deleteCategory(id, name) {
      if (!confirm(\`确定要删除分类"\${name}"吗？\`)) {
        return;
      }

      const token = getToken();
      if (!token) {
        alert('请先登录');
        return;
      }

      try {
        const response = await fetch(\`/api/categories/\${id}\`, {
          method: 'DELETE',
          headers: {
            'Authorization': \`Bearer \${token}\`
          }
        });

        const result = await response.json();
        if (result.success) {
          location.reload();
        } else {
          alert('删除失败：' + result.error);
        }
      } catch (error) {
        console.error('Delete category error:', error);
        alert('删除失败');
      }
    }

    // 自动生成别名
    document.getElementById('categoryName').addEventListener('input', function() {
      const name = this.value;
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9\\u4e00-\\u9fa5]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      document.getElementById('categorySlug').value = slug;
    });
  </script>
</body>
</html>`;
}

// 标签管理页面模板
function renderTagsManagement(tags: any[]): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标签管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  <div class="container mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">标签管理</h1>
        <p class="text-gray-300 dark:text-gray-300 mt-2">共 ${tags.length} 个标签</p>
      </div>
      <div class="flex items-center gap-4">
        <button onclick="showCreateForm()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          新建标签
        </button>
        <button onclick="goBack()" class="bg-slate-700 hover:bg-slate-600 text-gray-100 px-4 py-2 rounded-lg transition-colors">
          返回
        </button>
      </div>
    </div>

    <!-- 新建标签表单 -->
    <div id="createForm" class="hidden mb-8 bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6">
      <h2 class="text-xl font-semibold text-gray-100 dark:text-gray-100 mb-4">新建标签</h2>
      <form onsubmit="createTag(event)" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">标签名称</label>
            <input type="text" id="tagName" required
                   class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">标签别名 (URL)</label>
            <input type="text" id="tagSlug"
                   class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                   placeholder="留空自动生成">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">描述</label>
          <textarea id="tagDescription" rows="2"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">颜色</label>
          <div class="flex items-center gap-4">
            <input type="color" id="tagColor" value="#10B981"
                   class="w-16 h-10 rounded cursor-pointer border-0">
            <input type="text" id="tagColorText" value="#10B981"
                   class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 w-32">
          </div>
        </div>
        <div class="flex items-center gap-4">
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            创建标签
          </button>
          <button type="button" onclick="hideCreateForm()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
            取消
          </button>
        </div>
      </form>
    </div>

    <!-- 标签列表 -->
    <div class="flex flex-wrap gap-4">
      ${tags.map((tag: any) => `
        <div class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-4 min-w-48">
          <div class="flex items-center justify-between mb-2">
            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: ${tag.color}20; color: ${tag.color}">
              #${escapeHtml(tag.name)}
            </span>
            <span class="text-xs text-gray-400">${tag.usage_count || 0} 篇</span>
          </div>
          ${tag.description ? `<p class="text-sm text-gray-400 truncate">${escapeHtml(tag.description)}</p>` : ''}
          <div class="flex items-center gap-2 mt-3">
            <button onclick="editTag(${tag.id}, '${jsAttr(tag.name)}', '${jsAttr(tag.slug)}', '${jsAttr(tag.description || '')}', '${jsAttr(tag.color)}')"
                    class="text-xs text-blue-400 hover:text-blue-300">编辑</button>
            <button onclick="deleteTag(${tag.id}, '${jsAttr(tag.name)}')"
                    class="text-xs text-red-400 hover:text-red-300">删除</button>
          </div>
        </div>
      `).join('')}
    </div>

    ${tags.length === 0 ? `
      <div class="text-center py-12">
        <p class="text-gray-400 dark:text-gray-400 text-lg">暂无标签</p>
        <button onclick="showCreateForm()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
          创建第一个标签
        </button>
      </div>
    ` : ''}
  </div>

  <!-- 编辑标签模态框 -->
  <div id="editModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-semibold text-gray-100 mb-4">编辑标签</h2>
      <form onsubmit="updateTag(event)" class="space-y-4">
        <input type="hidden" id="editTagId">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">标签名称</label>
          <input type="text" id="editTagName" required
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">标签别名</label>
          <input type="text" id="editTagSlug"
                 class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">描述</label>
          <textarea id="editTagDescription" rows="2"
                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">颜色</label>
          <div class="flex items-center gap-4">
            <input type="color" id="editTagColor" class="w-16 h-10 rounded cursor-pointer border-0">
            <input type="text" id="editTagColorText" class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 w-32">
          </div>
        </div>
        <div class="flex items-center gap-4">
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">更新</button>
          <button type="button" onclick="hideEditModal()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">取消</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    function getToken() { return localStorage.getItem('auth_token'); }
    function goBack() { window.location.href = '/admin'; }

    function showCreateForm() {
      document.getElementById('createForm').classList.remove('hidden');
      document.getElementById('tagName').focus();
    }

    function hideCreateForm() {
      document.getElementById('createForm').classList.add('hidden');
      document.getElementById('tagName').value = '';
      document.getElementById('tagSlug').value = '';
      document.getElementById('tagDescription').value = '';
      document.getElementById('tagColor').value = '#10B981';
      document.getElementById('tagColorText').value = '#10B981';
    }

    // 颜色同步
    document.getElementById('tagColor').addEventListener('input', function() {
      document.getElementById('tagColorText').value = this.value;
    });
    document.getElementById('tagColorText').addEventListener('input', function() {
      document.getElementById('tagColor').value = this.value;
    });

    // 自动生成别名
    document.getElementById('tagName').addEventListener('input', function() {
      const slug = this.value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      document.getElementById('tagSlug').value = slug;
    });

    async function createTag(event) {
      event.preventDefault();
      const token = getToken();
      if (!token) { alert('请先登录'); return; }

      try {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            name: document.getElementById('tagName').value,
            slug: document.getElementById('tagSlug').value || undefined,
            description: document.getElementById('tagDescription').value || undefined,
            color: document.getElementById('tagColor').value
          })
        });
        const result = await response.json();
        if (result.success) { location.reload(); }
        else { alert('创建失败：' + result.error); }
      } catch (error) { alert('创建失败'); }
    }

    function editTag(id, name, slug, description, color) {
      document.getElementById('editTagId').value = id;
      document.getElementById('editTagName').value = name;
      document.getElementById('editTagSlug').value = slug;
      document.getElementById('editTagDescription').value = description;
      document.getElementById('editTagColor').value = color;
      document.getElementById('editTagColorText').value = color;
      document.getElementById('editModal').classList.remove('hidden');
    }

    function hideEditModal() { document.getElementById('editModal').classList.add('hidden'); }

    async function updateTag(event) {
      event.preventDefault();
      const token = getToken();
      if (!token) { alert('请先登录'); return; }

      const id = document.getElementById('editTagId').value;
      try {
        const response = await fetch('/api/tags/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            name: document.getElementById('editTagName').value,
            slug: document.getElementById('editTagSlug').value,
            description: document.getElementById('editTagDescription').value || undefined,
            color: document.getElementById('editTagColor').value
          })
        });
        const result = await response.json();
        if (result.success) { location.reload(); }
        else { alert('更新失败：' + result.error); }
      } catch (error) { alert('更新失败'); }
    }

    async function deleteTag(id, name) {
      if (!confirm('确定要删除标签"' + name + '"吗？')) return;
      const token = getToken();
      if (!token) { alert('请先登录'); return; }

      try {
        const response = await fetch('/api/tags/' + id, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const result = await response.json();
        if (result.success) { location.reload(); }
        else { alert('删除失败：' + result.error); }
      } catch (error) { alert('删除失败'); }
    }
  </script>
</body>
</html>`;
}

// 用户管理页面模板
function renderUsersManagement(users: any[]): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>用户管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">用户管理</h1>
    <p>共 ${users.length} 个用户</p>
  </div>
</body>
</html>`;
}



// 文章编辑器页面模板
function renderPostEditor(user: any, post: any, categories: any[]): string {
  const isEdit = !!post;
  const title = isEdit ? '编辑文章' : '新建文章';

  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
  </script>
  <style>
    .preview-content { line-height: 1.7; }
    .preview-content h1, .preview-content h2, .preview-content h3 { font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .preview-content h1 { font-size: 1.875rem; }
    .preview-content h2 { font-size: 1.5rem; }
    .preview-content h3 { font-size: 1.25rem; }
    .preview-content p { margin-bottom: 1rem; }
    .preview-content pre { background: #1e1e1e; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1rem 0; }
    .preview-content code { font-family: monospace; }
    .preview-content ul, .preview-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
    .preview-content li { margin-bottom: 0.25rem; }
    .preview-content blockquote { border-left: 4px solid #60A5FA; padding-left: 1rem; color: #9CA3AF; margin: 1rem 0; }
    .preview-content a { color: #60A5FA; text-decoration: underline; }
    .preview-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    .preview-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .preview-content th, .preview-content td { border: 1px solid #374151; padding: 0.5rem; }
    .preview-content th { background: #1F2937; }
  </style>
</head>
<body class="bg-slate-900 dark:bg-slate-900">
  ${renderAdminHeader(user)}

  <div class="container mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">${title}</h1>
      <button onclick="navigateWithToken('/admin/posts')" class="bg-gray-600 dark:bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors">
        返回列表
      </button>
    </div>

    <form id="postForm" class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow border border-slate-700 dark:border-slate-700 p-6">
      <div class="space-y-6">
        <!-- 文章标题 -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">文章标题</label>
          <input type="text" id="title" name="title" value="${isEdit ? escapeHtml(post.title) : ''}"
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
                 placeholder="请输入文章标题" required>
        </div>

        <!-- 文章别名 -->
        <div>
          <label for="slug" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">文章别名 (URL)</label>
          <input type="text" id="slug" name="slug" value="${isEdit ? escapeHtml(post.slug) : ''}"
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
                 placeholder="自动生成或手动输入">
        </div>

        <!-- 文章摘要 -->
        <div>
          <label for="excerpt" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">文章摘要</label>
          <textarea id="excerpt" name="excerpt" rows="3"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
                    placeholder="请输入文章摘要">${isEdit ? escapeHtml(post.excerpt || '') : ''}</textarea>
        </div>

        <!-- 文章内容与预览 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label for="content" class="block text-sm font-medium text-gray-300 dark:text-gray-300">文章内容 (Markdown)</label>
            <div class="flex items-center space-x-4 text-sm">
              <span id="wordCount" class="text-gray-400">0 字</span>
              <span id="readTime" class="text-gray-400">约 1 分钟阅读</span>
              <button type="button" onclick="togglePreview()" class="text-blue-400 hover:text-blue-300">
                <span id="previewBtn">显示预览</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4" id="editorContainer">
            <!-- 编辑器 -->
            <div id="editorPanel">
              <textarea id="content" name="content" rows="20"
                        class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-sm"
                        placeholder="请输入文章内容（支持 Markdown）" required>${isEdit ? escapeHtml(post.content || '') : ''}</textarea>
            </div>

            <!-- 预览面板 -->
            <div id="previewPanel" class="hidden">
              <div id="preview" class="w-full min-h-96 px-4 py-3 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 overflow-auto preview-content"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 分类选择 -->
          <div>
            <label for="category_id" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">分类</label>
            <select id="category_id" name="category_id"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500">
              <option value="">请选择分类</option>
              ${categories.map(category => `
                <option value="${category.id}" ${isEdit && post.category_id === category.id ? 'selected' : ''}>
                  ${escapeHtml(category.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- 文章状态 -->
          <div>
            <label for="status" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">状态</label>
            <select id="status" name="status"
                    class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500">
              <option value="draft" ${isEdit && post.status === 'draft' ? 'selected' : ''}>草稿</option>
              <option value="published" ${isEdit && post.status === 'published' ? 'selected' : ''}>已发布</option>
              <option value="archived" ${isEdit && post.status === 'archived' ? 'selected' : ''}>已归档</option>
            </select>
          </div>
        </div>

        <!-- 标签 -->
        <div>
          <label for="tags" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">标签</label>
          <input type="text" id="tags" name="tags" value="${isEdit && post.tags ? post.tags.map((tag: any) => tag.name).join(', ') : ''}"
                 class="w-full px-3 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
                 placeholder="请输入标签，用逗号分隔">
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end space-x-4 pt-6 border-t border-slate-700 dark:border-slate-700">
          <button type="button" onclick="navigateWithToken('/admin/posts')"
                  class="px-6 py-2 bg-gray-600 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors">
            取消
          </button>
          <button type="submit"
                  class="px-6 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors">
            ${isEdit ? '更新文章' : '发布文章'}
          </button>
        </div>
      </div>
    </form>
  </div>

  <script>
    let previewVisible = false;

    function navigateWithToken(path) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Pass the token via the Authorization header so it never appears in the URL / logs / Referer
        fetch(path, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (response) {
            if (response.ok) {
              return response.text().then(function (html) {
                document.open();
                document.write(html);
                document.close();
              });
            }
            window.location.href = '/admin/login';
          })
          .catch(function () {
            window.location.href = '/admin/login';
          });
      } else {
        window.location.href = '/admin/login';
      }
    }

    function togglePreview() {
      previewVisible = !previewVisible;
      const editorPanel = document.getElementById('editorPanel');
      const previewPanel = document.getElementById('previewPanel');
      const previewBtn = document.getElementById('previewBtn');
      const editorContainer = document.getElementById('editorContainer');

      if (previewVisible) {
        editorContainer.classList.remove('grid-cols-1');
        editorContainer.classList.add('grid-cols-2');
        previewPanel.classList.remove('hidden');
        previewBtn.textContent = '隐藏预览';
        updatePreview();
      } else {
        editorContainer.classList.remove('grid-cols-2');
        editorContainer.classList.add('grid-cols-1');
        previewPanel.classList.add('hidden');
        previewBtn.textContent = '显示预览';
      }
    }

    function updatePreview() {
      const content = document.getElementById('content').value;
      const preview = document.getElementById('preview');
      preview.innerHTML = marked.parse(content);
    }

    function updateStats() {
      const content = document.getElementById('content').value;
      const wordCount = content.length;
      const readTime = Math.max(1, Math.ceil(wordCount / 400));

      document.getElementById('wordCount').textContent = wordCount + ' 字';
      document.getElementById('readTime').textContent = '约 ' + readTime + ' 分钟阅读';
    }

    // 自动生成别名
    document.getElementById('title').addEventListener('input', function() {
      const title = this.value;
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      document.getElementById('slug').value = slug;
    });

    // 实时预览和统计
    document.getElementById('content').addEventListener('input', function() {
      updateStats();
      if (previewVisible) {
        updatePreview();
      }
    });

    // 初始化统计
    updateStats();

    // 表单提交
    document.getElementById('postForm').addEventListener('submit', async function(e) {
      e.preventDefault();

      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const formData = new FormData(this);
      const data = {
        title: formData.get('title'),
        slug: formData.get('slug'),
        excerpt: formData.get('excerpt'),
        content: formData.get('content'),
        category_id: formData.get('category_id') || null,
        status: formData.get('status'),
        tags: formData.get('tags')
      };

      try {
        const url = ${isEdit ? `'/api/admin/posts/${post.id}'` : `'/api/admin/posts'`};
        const method = ${isEdit ? `'PUT'` : `'POST'`};

        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          alert('${isEdit ? '文章更新成功！' : '文章创建成功！'}');
          navigateWithToken('/admin/posts');
        } else {
          alert('操作失败：' + result.error);
        }
      } catch (error) {
        alert('操作失败：' + error.message);
      }
    });
  </script>
</body>
</html>`;
}
