/**
 * 前端页面路由
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { PostService } from '../services/postService';
import { CategoryService } from '../services/categoryService';
import { TagService } from '../services/tagService';
import { CommentService } from '../services/commentService';
import { SettingService } from '../services/settingService';
import { renderHomePage, renderPostPage } from '../utils/templates';

export function registerPageRoutes(router: Router) {
  
  // 首页
  router.get('/', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      
      // 获取设置
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      const postsPerPage = settings.posts_per_page || 10;
      
      // 获取文章列表
      const postService = new PostService(env.DB);
      const postsResult = await postService.getPosts({
        page,
        limit: postsPerPage,
        status: 'published'
      });
      
      // 获取分类和标签
      const categoryService = new CategoryService(env.DB);
      const tagService = new TagService(env.DB);
      
      const [categories, tags] = await Promise.all([
        categoryService.getCategories(),
        tagService.getPopularTags(20)
      ]);
      
      const html = renderHomePage(postsResult, categories, tags, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Home page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 文章详情页
  router.get('/posts/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      
      // 获取设置
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      
      // 获取文章
      const postService = new PostService(env.DB);
      const post = await postService.getPostBySlug(slug);
      
      if (!post) {
        return new Response('Post not found', { status: 404 });
      }
      
      // 获取评论
      const commentService = new CommentService(env.DB);
      const comments = await commentService.getPostComments(post.id);
      
      const html = renderPostPage(post, comments, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Post page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 分类页面
  router.get('/categories', async (request, env: Env, ctx, params) => {
    try {
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      
      const categoryService = new CategoryService(env.DB);
      const categories = await categoryService.getCategories();
      
      const html = renderCategoriesPage(categories, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Categories page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 分类文章列表页
  router.get('/categories/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      const postsPerPage = settings.posts_per_page || 10;
      
      // 获取分类
      const categoryService = new CategoryService(env.DB);
      const category = await categoryService.getCategoryBySlug(slug);
      
      if (!category) {
        return new Response('Category not found', { status: 404 });
      }
      
      // 获取分类下的文章
      const postService = new PostService(env.DB);
      const postsResult = await postService.getPosts({
        page,
        limit: postsPerPage,
        category: slug,
        status: 'published'
      });
      
      const html = renderCategoryPostsPage(category, postsResult, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Category posts page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 标签页面
  router.get('/tags', async (request, env: Env, ctx, params) => {
    try {
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      
      const tagService = new TagService(env.DB);
      const tags = await tagService.getTags();
      
      const html = renderTagsPage(tags, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Tags page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 标签文章列表页
  router.get('/tags/:slug', async (request, env: Env, ctx, params) => {
    try {
      const slug = params!.slug;
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      const postsPerPage = settings.posts_per_page || 10;
      
      // 获取标签
      const tagService = new TagService(env.DB);
      const tag = await tagService.getTagBySlug(slug);
      
      if (!tag) {
        return new Response('Tag not found', { status: 404 });
      }
      
      // 获取标签下的文章
      const postService = new PostService(env.DB);
      const postsResult = await postService.getPosts({
        page,
        limit: postsPerPage,
        tag: slug,
        status: 'published'
      });
      
      const html = renderTagPostsPage(tag, postsResult, settings);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Tag posts page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 搜索页面
  router.get('/search', async (request, env: Env, ctx, params) => {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const page = parseInt(url.searchParams.get('page') || '1');

      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      const postsPerPage = settings.posts_per_page || 10;

      let postsResult = { data: [], pagination: { total: 0, page: 1, totalPages: 0, hasNext: false, hasPrev: false } };

      if (query.trim()) {
        const postService = new PostService(env.DB);
        postsResult = await postService.getPosts({
          page,
          limit: postsPerPage,
          search: query,
          status: 'published'
        });
      }

      const html = renderSearchPage(query, postsResult, settings);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Search page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // 关于页面
  router.get('/about', async (request, env: Env, ctx, params) => {
    try {
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();

      // 获取关于页面内容
      const pageResult = await env.DB.prepare(
        'SELECT * FROM pages WHERE slug = "about" AND is_published = 1'
      ).first();

      const html = renderAboutPage(pageResult, settings);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('About page error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

// 分类列表页面模板
function renderCategoriesPage(categories: any[], settings: Record<string, any>): string {
  // 这里可以实现分类列表页面的模板
  // 为了简化，暂时返回一个基本的页面
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分类 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">分类</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${categories.map(category => `
        <a href="/categories/${category.slug}" 
           class="block bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div class="flex items-center mb-2">
            <span class="w-4 h-4 rounded-full mr-3" style="background-color: ${category.color}"></span>
            <h2 class="text-xl font-semibold">${category.name}</h2>
          </div>
          <p class="text-gray-600 mb-2">${category.description || ''}</p>
          <span class="text-sm text-gray-500">${category.post_count || 0} 篇文章</span>
        </a>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

// 标签列表页面模板
function renderTagsPage(tags: any[], settings: Record<string, any>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标签 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">标签</h1>
    <div class="flex flex-wrap gap-3">
      ${tags.map(tag => `
        <a href="/tags/${tag.slug}" 
           class="px-4 py-2 rounded-full border hover:shadow-sm transition-shadow"
           style="border-color: ${tag.color}; color: ${tag.color}">
          ${tag.name} (${tag.usage_count})
        </a>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

// 分类文章列表页面模板
function renderCategoryPostsPage(category: any, postsResult: any, settings: Record<string, any>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${category.name} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">${category.name}</h1>
    <p class="text-gray-600 mb-8">${category.description || ''}</p>
    <!-- 这里可以复用文章列表组件 -->
    <p>共 ${postsResult.pagination.total} 篇文章</p>
  </div>
</body>
</html>`;
}

// 标签文章列表页面模板
function renderTagPostsPage(tag: any, postsResult: any, settings: Record<string, any>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>#${tag.name} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">#${tag.name}</h1>
    <p class="text-gray-600 mb-8">${tag.description || ''}</p>
    <!-- 这里可以复用文章列表组件 -->
    <p>共 ${postsResult.pagination.total} 篇文章</p>
  </div>
</body>
</html>`;
}

// 搜索页面模板
function renderSearchPage(query: string, postsResult: any, settings: Record<string, any>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>搜索${query ? ` "${query}"` : ''} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-8">搜索结果</h1>

      <!-- 搜索框 -->
      <form method="GET" action="/search" class="mb-8">
        <div class="flex">
          <input type="text" name="q" value="${escapeHtml(query)}"
                 placeholder="搜索文章..."
                 class="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          <button type="submit"
                  class="px-6 py-3 bg-primary text-white rounded-r-lg hover:bg-primary/90 transition-colors">
            搜索
          </button>
        </div>
      </form>

      ${query ? `
        <div class="mb-6">
          <p class="text-gray-600">
            搜索 "${escapeHtml(query)}" 共找到 ${postsResult.pagination.total} 篇文章
          </p>
        </div>

        ${postsResult.data.length > 0 ? `
          <div class="space-y-6">
            ${postsResult.data.map((post: any) => `
              <article class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-xl font-bold mb-2">
                  <a href="/posts/${escapeHtml(post.slug)}" class="hover:text-primary transition-colors">
                    ${escapeHtml(post.title)}
                  </a>
                </h2>
                <p class="text-gray-600 mb-4">${escapeHtml(post.excerpt || '')}</p>
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span>${new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN')}</span>
                  <span>${post.view_count} 阅读</span>
                  <span>${post.comment_count} 评论</span>
                </div>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="text-center py-12">
            <p class="text-gray-500">没有找到相关文章</p>
          </div>
        `}
      ` : `
        <div class="text-center py-12">
          <p class="text-gray-500">请输入搜索关键词</p>
        </div>
      `}
    </div>
  </div>
</body>
</html>`;
}

// 关于页面模板
function renderAboutPage(page: any, settings: Record<string, any>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>关于 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-8">
      <h1 class="text-3xl font-bold mb-8">${page?.title || '关于我'}</h1>
      <div class="prose max-w-none">
        ${page?.content || '<p>暂无内容</p>'}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// HTML 转义函数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}
