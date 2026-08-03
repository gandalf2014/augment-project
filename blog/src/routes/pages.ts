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
import { getCache, CacheKeys } from '../utils/cache';

export function registerPageRoutes(router: Router) {
	// 首页
	router.get('/', async (request, env: Env, ctx, params) => {
		try {
			const url = new URL(request.url);
			const page = parseInt(url.searchParams.get('page') || '1');

			// 使用缓存
			const cache = getCache(env.KV);
			const cacheKey = `page:home:${page}`;

			const cachedHtml = await cache.get<string>(cacheKey);
			if (cachedHtml) {
				return new Response(cachedHtml, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'X-Cache': 'HIT',
						'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
						'CDN-Cache-Control': 'public, max-age=300',
					},
				});
			}

			// 获取设置
			const settingService = new SettingService(env.DB);
			const settings = await settingService.getSettings();
			const postsPerPage = settings.posts_per_page || 10;

			// 获取文章列表
			const postService = new PostService(env.DB);
			const postsResult = await postService.getPosts({
				page,
				limit: postsPerPage,
				status: 'published',
			});

			// 获取分类和标签
			const categoryService = new CategoryService(env.DB);
			const tagService = new TagService(env.DB);

			const [categories, tags] = await Promise.all([categoryService.getCategories(), tagService.getPopularTags(20)]);

			const html = renderHomePage(postsResult, categories, tags, settings);

			// 缓存 5 分钟
			await cache.set(cacheKey, html, 300);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'X-Cache': 'MISS',
					'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
					'CDN-Cache-Control': 'public, max-age=300',
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

			// 使用缓存
			const cache = getCache(env.KV);
			const cacheKey = `page:post:${slug}`;

			const cachedHtml = await cache.get<string>(cacheKey);
			if (cachedHtml) {
				// 异步增加浏览量
				ctx.waitUntil(new PostService(env.DB).incrementViewCount(parseInt(cachedHtml.match(/data-post-id="(\d+)"/)?.[1] || '0')));
				return new Response(cachedHtml, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'X-Cache': 'HIT',
						'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
						'CDN-Cache-Control': 'public, max-age=600',
					},
				});
			}

			// 获取设置
			const settingService = new SettingService(env.DB);
			const settings = await settingService.getSettings();

			// 获取文章
			const postService = new PostService(env.DB);
			const post = await postService.getPostBySlug(slug);

			if (!post) {
				return new Response('Post not found', { status: 404 });
			}

			// 增加浏览量
			await postService.incrementViewCount(post.id);

			// 获取评论
			const commentService = new CommentService(env.DB);
			const comments = await commentService.getPostComments(post.id);

			// 获取上一篇和下一篇文章
			const adjacentPosts = await postService.getAdjacentPosts(post.id);

			// 获取相关文章（基于相同分类或标签）
			const tagIds = post.tags?.map((t) => t.id);
			const relatedPosts = await postService.getRelatedPosts(post.id, post.category_id, tagIds, 4);

			const html = renderPostPage(post, comments, settings, adjacentPosts, relatedPosts);

			// 在 HTML 中添加 data-post-id 以便缓存时异步增加浏览量
			const htmlWithId = html.replace('<article', `<article data-post-id="${post.id}"`);

			// 缓存 10 分钟
			await cache.set(cacheKey, htmlWithId, 600);

			return new Response(htmlWithId, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'X-Cache': 'MISS',
					'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
					'CDN-Cache-Control': 'public, max-age=600',
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
					'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
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
				status: 'published',
			});

			const html = renderCategoryPostsPage(category, postsResult, settings);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
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
					'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
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
				status: 'published',
			});

			const html = renderTagPostsPage(tag, postsResult, settings);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
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

			let postsResult: any = { data: [], pagination: { total: 0, page: 1, totalPages: 0, hasNext: false, hasPrev: false } };

			if (query.trim()) {
				const postService = new PostService(env.DB);
				postsResult = await postService.getPosts({
					page,
					limit: postsPerPage,
					search: query,
					status: 'published',
				});
			}

			const html = renderSearchPage(query, postsResult, settings);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=180, stale-while-revalidate=60',
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
			const pageResult = await env.DB.prepare('SELECT * FROM pages WHERE slug = "about" AND is_published = 1').first();

			const html = renderAboutPage(pageResult, settings);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
				},
			});
		} catch (error) {
			console.error('About page error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	});

	// 归档页面
	router.get('/archives', async (request, env: Env, ctx, params) => {
		try {
			const settingService = new SettingService(env.DB);
			const settings = await settingService.getSettings();

			// 获取所有已发布的文章
			const postService = new PostService(env.DB);
			const postsResult = await postService.getPosts({
				status: 'published',
				limit: 1000,
			});

			// 按年份分组
			const archives: Record<string, any[]> = {};
			for (const post of postsResult.data) {
				const date = new Date(post.published_at || post.created_at);
				const year = date.getFullYear().toString();
				if (!archives[year]) {
					archives[year] = [];
				}
				archives[year].push(post);
			}

			const html = renderArchivesPage(archives, postsResult.pagination.total, settings);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
				},
			});
		} catch (error) {
			console.error('Archives page error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	});
}

// 分类列表页面模板
function renderCategoriesPage(categories: any[], settings: Record<string, any>): string {
	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分类 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-primary font-medium">分类</a>
          <a href="/tags" class="text-gray-300 hover:text-gray-100 transition-colors">标签</a>
          <a href="/about" class="text-gray-300 hover:text-gray-100 transition-colors">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <!-- 面包屑导航 -->
    <nav class="mb-6" aria-label="Breadcrumb">
      <ol class="flex items-center text-sm text-gray-400">
        <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
        <li class="flex items-center">
          <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span class="text-gray-200">分类</span>
        </li>
      </ol>
    </nav>

    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-100">分类</h1>
      <span class="text-gray-400">共 ${categories.length} 个分类</span>
    </div>

    ${
			categories.length > 0
				? `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${categories
					.map(
						(category) => `
          <a href="/categories/${category.slug}"
             class="group bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
            <div class="flex items-center mb-4">
              <span class="w-4 h-4 rounded-full mr-3 transition-transform group-hover:scale-125" style="background-color: ${category.color}"></span>
              <h2 class="text-xl font-semibold text-gray-100 group-hover:text-primary transition-colors">${escapeHtml(category.name)}</h2>
            </div>
            <p class="text-gray-400 mb-4 line-clamp-2">${escapeHtml(category.description || '暂无描述')}</p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500">${category.post_count || 0} 篇文章</span>
              <svg class="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </a>
        `,
					)
					.join('')}
      </div>
    `
				: `
      <div class="text-center py-16">
        <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-200 mb-2">暂无分类</h3>
        <p class="text-gray-400">管理员还没有创建任何分类</p>
      </div>
    `
		}
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}

// 标签列表页面模板
function renderTagsPage(tags: any[], settings: Record<string, any>): string {
	const activeTags = tags.filter((tag) => tag.usage_count > 0);
	const tagColors = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标签 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-primary font-medium">标签</a>
          <a href="/about" class="text-gray-300 hover:text-gray-100 transition-colors">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <!-- 面包屑导航 -->
    <nav class="mb-6" aria-label="Breadcrumb">
      <ol class="flex items-center text-sm text-gray-400">
        <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
        <li class="flex items-center">
          <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span class="text-gray-200">标签</span>
        </li>
      </ol>
    </nav>

    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-100">标签</h1>
      <span class="text-gray-400">共 ${activeTags.length} 个标签</span>
    </div>

    ${
			activeTags.length > 0
				? `
      <!-- 标签云 -->
      <div class="bg-slate-800 rounded-lg border border-slate-700 p-8">
        <div class="flex flex-wrap gap-3 justify-center">
          ${activeTags
						.map((tag, index) => {
							const size =
								tag.usage_count > 10 ? 'text-lg px-5 py-2.5' : tag.usage_count > 5 ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5';
							return `
              <a href="/tags/${escapeHtml(tag.slug)}"
                 class="${size} rounded-full border-2 transition-all duration-300 hover:scale-110 hover:shadow-lg"
                 style="border-color: ${tag.color}; color: ${tag.color}; background-color: ${tag.color}15;"
                 title="${escapeHtml(tag.name)} - ${tag.usage_count} 篇文章">
                <span class="mr-1">#</span>${escapeHtml(tag.name)}
                <span class="text-xs opacity-70">(${tag.usage_count})</span>
              </a>
            `;
						})
						.join('')}
        </div>
      </div>

      <!-- 按使用量排序的标签列表 -->
      <div class="mt-8">
        <h2 class="text-xl font-semibold text-gray-100 mb-4">热门标签</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          ${activeTags
						.slice(0, 12)
						.map(
							(tag) => `
            <a href="/tags/${escapeHtml(tag.slug)}"
               class="group bg-slate-800 rounded-lg border border-slate-700 p-3 hover:border-primary transition-colors text-center">
              <div class="w-3 h-3 rounded-full mx-auto mb-2" style="background-color: ${tag.color}"></div>
              <span class="text-gray-200 group-hover:text-primary transition-colors text-sm">${escapeHtml(tag.name)}</span>
              <span class="block text-xs text-gray-500 mt-1">${tag.usage_count} 篇</span>
            </a>
          `,
						)
						.join('')}
        </div>
      </div>
    `
				: `
      <div class="text-center py-16">
        <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-200 mb-2">暂无标签</h3>
        <p class="text-gray-400">还没有文章使用标签</p>
      </div>
    `
		}
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}

// 分类文章列表页面模板
function renderCategoryPostsPage(category: any, postsResult: any, settings: Record<string, any>): string {
	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(category.name)} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-primary font-medium">分类</a>
          <a href="/tags" class="text-gray-300 hover:text-gray-100 transition-colors">标签</a>
          <a href="/about" class="text-gray-300 hover:text-gray-100 transition-colors">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- 面包屑导航 -->
      <nav class="mb-6" aria-label="Breadcrumb">
        <ol class="flex items-center text-sm text-gray-400">
          <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <a href="/categories" class="hover:text-gray-200 transition-colors">分类</a>
          </li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span class="text-gray-200">${escapeHtml(category.name)}</span>
          </li>
        </ol>
      </nav>

      <!-- 分类标题 -->
      <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8">
        <div class="flex items-center gap-4">
          <div class="w-4 h-4 rounded-full" style="background-color: ${category.color}"></div>
          <div>
            <h1 class="text-2xl font-bold text-gray-100">${escapeHtml(category.name)}</h1>
            ${category.description ? `<p class="text-gray-400 mt-1">${escapeHtml(category.description)}</p>` : ''}
          </div>
          <span class="ml-auto text-gray-400">${postsResult.pagination.total} 篇文章</span>
        </div>
      </div>

      ${
				postsResult.data.length > 0
					? `
        <div class="space-y-4">
          ${postsResult.data
						.map(
							(post: any) => `
            <article class="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-primary transition-colors">
              <div class="flex items-start gap-4">
                ${
									post.featured_image
										? `
                  <img src="${escapeHtml(post.featured_image)}" alt="" class="w-24 h-24 object-cover rounded-lg flex-shrink-0 hidden sm:block">
                `
										: ''
								}
                <div class="flex-1">
                  <h2 class="text-xl font-bold mb-2">
                    <a href="/posts/${escapeHtml(post.slug)}" class="text-gray-100 hover:text-primary transition-colors">
                      ${escapeHtml(post.title)}
                    </a>
                  </h2>
                  <p class="text-gray-400 mb-3 line-clamp-2">${escapeHtml(post.excerpt || '')}</p>
                  <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span>${new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>${post.view_count} 阅读</span>
                    <span>${post.comment_count} 评论</span>
                  </div>
                </div>
              </div>
            </article>
          `,
						)
						.join('')}
        </div>
      `
					: `
        <div class="text-center py-16">
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-200 mb-2">暂无文章</h3>
          <p class="text-gray-400">该分类下还没有文章</p>
        </div>
      `
			}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}

// 标签文章列表页面模板
function renderTagPostsPage(tag: any, postsResult: any, settings: Record<string, any>): string {
	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>#${escapeHtml(tag.name)} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-primary font-medium">标签</a>
          <a href="/about" class="text-gray-300 hover:text-gray-100 transition-colors">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- 面包屑导航 -->
      <nav class="mb-6" aria-label="Breadcrumb">
        <ol class="flex items-center text-sm text-gray-400">
          <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <a href="/tags" class="hover:text-gray-200 transition-colors">标签</a>
          </li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span class="text-gray-200">#${escapeHtml(tag.name)}</span>
          </li>
        </ol>
      </nav>

      <!-- 标签标题 -->
      <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8">
        <div class="flex items-center gap-4">
          <span class="px-4 py-2 rounded-full text-lg font-semibold" style="background-color: ${tag.color}20; color: ${tag.color}">
            #${escapeHtml(tag.name)}
          </span>
          <div class="flex-1">
            ${tag.description ? `<p class="text-gray-400">${escapeHtml(tag.description)}</p>` : ''}
          </div>
          <span class="text-gray-400">${postsResult.pagination.total} 篇文章</span>
        </div>
      </div>

      ${
				postsResult.data.length > 0
					? `
        <div class="space-y-4">
          ${postsResult.data
						.map(
							(post: any) => `
            <article class="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-primary transition-colors">
              <div class="flex items-start gap-4">
                ${
									post.featured_image
										? `
                  <img src="${escapeHtml(post.featured_image)}" alt="" class="w-24 h-24 object-cover rounded-lg flex-shrink-0 hidden sm:block">
                `
										: ''
								}
                <div class="flex-1">
                  <h2 class="text-xl font-bold mb-2">
                    <a href="/posts/${escapeHtml(post.slug)}" class="text-gray-100 hover:text-primary transition-colors">
                      ${escapeHtml(post.title)}
                    </a>
                  </h2>
                  <p class="text-gray-400 mb-3 line-clamp-2">${escapeHtml(post.excerpt || '')}</p>
                  <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span>${new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>${post.view_count} 阅读</span>
                    <span>${post.comment_count} 评论</span>
                    ${
											post.category
												? `
                      <span class="px-2 py-0.5 rounded text-xs" style="background-color: ${post.category.color}20; color: ${post.category.color}">
                        ${escapeHtml(post.category.name)}
                      </span>
                    `
												: ''
										}
                  </div>
                </div>
              </div>
            </article>
          `,
						)
						.join('')}
        </div>
      `
					: `
        <div class="text-center py-16">
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-200 mb-2">暂无文章</h3>
          <p class="text-gray-400">该标签下还没有文章</p>
        </div>
      `
			}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}

// 搜索页面模板
function renderSearchPage(query: string, postsResult: any, settings: Record<string, any>): string {
	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>搜索${query ? ` "${query}"` : ''} - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-gray-300 hover:text-gray-100 transition-colors">标签</a>
          <a href="/about" class="text-gray-300 hover:text-gray-100 transition-colors">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- 面包屑导航 -->
      <nav class="mb-6" aria-label="Breadcrumb">
        <ol class="flex items-center text-sm text-gray-400">
          <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span class="text-gray-200">搜索</span>
          </li>
        </ol>
      </nav>

      <h1 class="text-3xl font-bold text-gray-100 mb-8">搜索文章</h1>

      <!-- 搜索框 -->
      <form method="GET" action="/search" class="mb-8">
        <div class="relative">
          <input type="text" name="q" value="${escapeHtml(query)}"
                 placeholder="输入关键词搜索..."
                 class="w-full px-5 py-4 pl-12 bg-slate-800 border border-slate-700 rounded-xl text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                 autofocus>
          <svg class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <button type="submit"
                  class="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            搜索
          </button>
        </div>
      </form>

      ${
				query
					? `
        <div class="mb-6">
          <p class="text-gray-400">
            搜索 "<span class="text-gray-200">${escapeHtml(query)}</span>" 共找到
            <span class="text-primary font-semibold">${postsResult.pagination.total}</span> 篇文章
          </p>
        </div>

        ${
					postsResult.data.length > 0
						? `
          <div class="space-y-4">
            ${postsResult.data
							.map(
								(post: any) => `
              <article class="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-primary transition-colors">
                <div class="flex items-start gap-4">
                  ${
										post.featured_image
											? `
                    <img src="${escapeHtml(post.featured_image)}" alt="" class="w-24 h-24 object-cover rounded-lg flex-shrink-0 hidden sm:block">
                  `
											: ''
									}
                  <div class="flex-1 min-w-0">
                    <h2 class="text-xl font-bold mb-2">
                      <a href="/posts/${escapeHtml(post.slug)}" class="text-gray-100 hover:text-primary transition-colors">
                        ${highlightSearchTerm(escapeHtml(post.title), query)}
                      </a>
                    </h2>
                    <p class="text-gray-400 mb-3 line-clamp-2">${highlightSearchTerm(escapeHtml(post.excerpt || ''), query)}</p>
                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                      <span>${new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN')}</span>
                      <span>${post.view_count} 阅读</span>
                      ${
												post.category
													? `
                        <span class="px-2 py-0.5 rounded text-xs" style="background-color: ${post.category.color}20; color: ${post.category.color}">
                          ${escapeHtml(post.category.name)}
                        </span>
                      `
													: ''
											}
                    </div>
                  </div>
                </div>
              </article>
            `,
							)
							.join('')}
          </div>
        `
						: `
          <div class="text-center py-16">
            <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-200 mb-2">没有找到相关文章</h3>
            <p class="text-gray-400 mb-4">尝试使用其他关键词搜索</p>
            <div class="flex flex-wrap justify-center gap-2">
              <a href="/" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors">浏览首页</a>
              <a href="/categories" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors">查看分类</a>
            </div>
          </div>
        `
				}
      `
					: `
        <div class="text-center py-16">
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-200 mb-2">输入关键词开始搜索</h3>
          <p class="text-gray-400">搜索文章标题、内容或标签</p>
        </div>
      `
			}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}

// 高亮搜索关键词
function highlightSearchTerm(text: string, query: string): string {
	if (!query) return text;
	const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
	return text.replace(regex, '<mark class="bg-primary/30 text-gray-100 px-0.5 rounded">$1</mark>');
}

// 关于页面模板
function renderAboutPage(page: any, settings: Record<string, any>): string {
	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>关于 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>html { background-color: #0f172a; } body { background-color: #0f172a; }</style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-gray-300 hover:text-gray-100 transition-colors">标签</a>
          <a href="/about" class="text-primary font-medium">关于</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- 面包屑导航 -->
      <nav class="mb-6" aria-label="Breadcrumb">
        <ol class="flex items-center text-sm text-gray-400">
          <li><a href="/" class="hover:text-gray-200 transition-colors">首页</a></li>
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span class="text-gray-200">关于</span>
          </li>
        </ol>
      </nav>

      <article class="bg-slate-800 rounded-lg border border-slate-700 p-8">
        <h1 class="text-3xl font-bold text-gray-100 mb-6">${page?.title || '关于我'}</h1>
        <div class="prose prose-invert max-w-none text-gray-300 leading-relaxed">
          ${
						page?.content ||
						`
            <div class="text-center py-8">
              <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <p class="text-gray-400">博主很懒，还没有填写关于页面的内容。</p>
            </div>
          `
					}
        </div>
      </article>

      <!-- 社交链接 -->
      ${
				settings.social_email || settings.social_github || settings.social_twitter
					? `
        <div class="mt-8 bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 class="text-xl font-semibold text-gray-100 mb-4">联系方式</h2>
          <div class="flex flex-wrap gap-4">
            ${
							settings.social_email
								? `
              <a href="mailto:${settings.social_email}" class="inline-flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                邮箱
              </a>
            `
								: ''
						}
            ${
							settings.social_github
								? `
              <a href="${settings.social_github}" target="_blank" class="inline-flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            `
								: ''
						}
            ${
							settings.social_twitter
								? `
              <a href="${settings.social_twitter}" target="_blank" class="inline-flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </a>
            `
								: ''
						}
          </div>
        </div>
      `
					: ''
			}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
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
		"'": '&#39;',
	};

	return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 归档页面模板
function renderArchivesPage(archives: Record<string, any[]>, total: number, settings: Record<string, any>): string {
	const years = Object.keys(archives).sort((a, b) => parseInt(b) - parseInt(a));

	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>归档 - ${settings.site_title || '个人博客'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  <style>
    html { background-color: #0f172a; }
    body { background-color: #0f172a; }
  </style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100">
  <!-- Header -->
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="text-xl font-bold text-gray-100 hover:text-primary transition-colors">${settings.site_title || '个人博客'}</a>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-300 hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-gray-300 hover:text-gray-100 transition-colors">标签</a>
          <a href="/archives" class="text-primary font-medium">归档</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-100">文章归档</h1>
        <span class="text-gray-400">共 ${total} 篇文章</span>
      </div>

      ${years
				.map(
					(year) => `
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-primary mb-4 flex items-center">
            <span class="bg-slate-800 px-3 py-1 rounded-lg">${year}</span>
            <span class="ml-2 text-sm text-gray-500 font-normal">${archives[year].length} 篇</span>
          </h2>
          <div class="space-y-3 ml-4 border-l-2 border-slate-700 pl-4">
            ${archives[year]
							.map((post: any) => {
								const date = new Date(post.published_at || post.created_at);
								const month = (date.getMonth() + 1).toString().padStart(2, '0');
								const day = date.getDate().toString().padStart(2, '0');

								return `
                <article class="group">
                  <a href="/posts/${escapeHtml(post.slug)}" class="flex items-start hover:bg-slate-800 -ml-4 pl-4 py-2 rounded-lg transition-colors">
                    <time class="text-sm text-gray-500 w-20 flex-shrink-0">${month}-${day}</time>
                    <h3 class="text-gray-200 group-hover:text-primary transition-colors flex-1">${escapeHtml(post.title)}</h3>
                    ${
											post.category
												? `
                      <span class="text-xs px-2 py-1 rounded ml-2 flex-shrink-0" style="background-color: ${post.category.color}20; color: ${post.category.color}">
                        ${escapeHtml(post.category.name)}
                      </span>
                    `
												: ''
										}
                  </a>
                </article>
              `;
							})
							.join('')}
          </div>
        </div>
      `,
				)
				.join('')}

      ${
				years.length === 0
					? `
        <div class="text-center py-16">
          <p class="text-gray-400 text-lg">暂无文章</p>
        </div>
      `
					: ''
			}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8 text-center text-gray-300">
      <p>&copy; ${new Date().getFullYear()} ${settings.site_author || '博客作者'}. 基于 Cloudflare Workers 构建.</p>
    </div>
  </footer>
</body>
</html>`;
}
