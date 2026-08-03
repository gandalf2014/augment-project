/**
 * HTML 模板工具
 */

import type { PostWithDetails, Category, Tag, Setting } from '../types/database';
import { renderMarkdown, highlightStyles, extractToc, estimateReadTime } from './markdown';

// 基础布局模板
export function renderLayout(options: {
	title: string;
	description?: string;
	keywords?: string;
	content: string;
	settings?: Record<string, any>;
	image?: string;
	url?: string;
	type?: string;
}): string {
	const { title, description, keywords, content, settings = {}, image, url, type = 'website' } = options;

	const siteUrl = settings.site_url || 'https://blog.jiayouilin.workers.dev';
	const siteTitle = settings.site_title || '个人博客';
	const ogImage = image || settings.site_image || `${siteUrl}/og-image.png`;
	const pageUrl = url || siteUrl;
	const fullTitle = title === siteTitle ? title : `${title} - ${siteTitle}`;

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fullTitle)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}

  <!-- 性能优化：DNS 预取和预连接 -->
  <link rel="dns-prefetch" href="https://cdn.tailwindcss.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(pageUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description || '')}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:site_name" content="${escapeHtml(siteTitle)}">
  <meta property="og:locale" content="zh_CN">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description || '')}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  ${settings.social_twitter ? `<meta name="twitter:site" content="${escapeHtml(settings.social_twitter)}">` : ''}

  <!-- 关键 CSS 内联（首屏渲染必需） -->
  <style>
    :root{--primary:#60A5FA;--secondary:#34D399;--bg-dark:#0f172a;--bg-card:#1e293b}
    html{background-color:var(--bg-dark)}
    body{margin:0;font-family:system-ui,-apple-system,sans-serif;background-color:var(--bg-dark);color:#f1f5f9}
    .dark{color-scheme:dark}
    .invisible{visibility:hidden}
    .opacity-0{opacity:0}
    *,:after,:before{box-sizing:border-box;border:0 solid #e2e8f0}
    html{line-height:1.5;-webkit-text-size-adjust:100%;font-feature-settings:normal}
    body{margin:0;line-height:inherit}
    h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit;line-height:1.25}
    a{color:inherit;text-decoration:inherit}
    img,svg{display:block;vertical-align:middle}
    img,video{max-width:100%;height:auto}
    .container{margin-left:auto;margin-right:auto;max-width:1280px}
    .mx-auto{margin-left:auto;margin-right:auto}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
    @media(max-width:768px){.mobile-padding{padding:1rem}.mobile-text-sm{font-size:.875rem}}
  </style>

  <script>
    // 尽早设置主题，避免闪烁
    (function() {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
  <script src="https://cdn.tailwindcss.com" defer></script>
  <script>
    // Tailwind 配置提前执行
    window.tailwind = {
      config: {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: '#60A5FA',
              secondary: '#34D399',
            }
          }
        }
      }
    };
  </script>
  <style>
    /* 代码高亮样式 */
    ${highlightStyles}

    /* Markdown 内容样式 */
    .markdown-content { line-height: 1.7; }
    .markdown-content h1, .markdown-content h2, .markdown-content h3,
    .markdown-content h4, .markdown-content h5, .markdown-content h6 { scroll-margin-top: 2rem; }
    .markdown-content pre, .markdown-content code { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; }
    .markdown-content blockquote { position: relative; }
    .markdown-content blockquote::before { content: '"'; position: absolute; left: -0.5rem; top: -0.5rem; font-size: 2rem; color: #60A5FA; opacity: 0.5; }
    .markdown-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    .markdown-content th { background-color: #1F2937; font-weight: 600; color: #F3F4F6; }
    .markdown-content td { color: #D1D5DB; border: 1px solid #374151; padding: 0.75rem; text-align: left; }
    .markdown-content pre code { display: block; padding: 0; background: transparent; border: none; }
    .markdown-content pre::-webkit-scrollbar { height: 8px; }
    .markdown-content pre::-webkit-scrollbar-track { background: #1F2937; border-radius: 4px; }
    .markdown-content pre::-webkit-scrollbar-thumb { background: #4B5563; border-radius: 4px; }
    .markdown-content pre::-webkit-scrollbar-thumb:hover { background: #6B7280; }

    /* 动画效果 */
    .fade-in { animation: fadeIn 0.5s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .card-hover { transition: all 0.3s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); }
    /* 加载动画 */
    .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* 响应式优化 */
    @media (max-width: 768px) { .mobile-padding { padding: 1rem; } .mobile-text-sm { font-size: 0.875rem; } }
  </style>

  <!-- JSON-LD 结构化数据（延迟到 body 后加载） -->
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100 dark:text-gray-100 transition-colors duration-300">
  ${renderHeader(settings)}
  <main class="container mx-auto px-4 py-8">
    ${content}
  </main>
  ${renderFooter(settings)}

  <!-- 结构化数据（延迟加载） -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${type === 'article' ? 'BlogPosting' : 'WebSite'}",
    "name": "${escapeHtml(title)}",
    "description": "${escapeHtml(description || '')}",
    "url": "${escapeHtml(pageUrl)}",
    "image": "${escapeHtml(ogImage)}"
    ${
			type === 'article'
				? `,
    "publisher": {
      "@type": "Organization",
      "name": "${escapeHtml(siteTitle)}"
    }`
				: ''
		}
  }
  </script>

  <!-- 返回顶部按钮 -->
  <button id="back-to-top"
          class="fixed bottom-8 right-8 bg-primary text-white p-3 rounded-full shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-primary/90 hover:scale-110 z-50"
          aria-label="返回顶部">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
    </svg>
  </button>

  <!-- 关键交互脚本（立即执行） -->
  <script>
    !function(){function e(e){e.target.classList.remove("opacity-0"),e.target.classList.add("opacity-100")}var t=document.querySelectorAll("img[data-src]");if(t.length){var n=new IntersectionObserver((function(t,n){t.forEach((function(t){t.isIntersecting&&(t.target.src=t.target.dataset.src,e(t.target),n.unobserve(t.target))}))}));t.forEach((function(e){n.observe(e)}))}}();
  </script>

  <!-- 非关键脚本（延迟执行） -->
  <script defer>
    // 等待 DOM 和 Tailwind 加载完成后执行
    document.addEventListener('DOMContentLoaded', function() {
      // 移动端菜单切换
      const menuButton = document.getElementById('mobile-menu-button');
      const mobileMenu = document.getElementById('mobile-menu');

      if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', function() {
          mobileMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', function(e) {
          if (!menuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
          }
        });
      }

      // 返回顶部按钮（节流优化）
      const backToTopButton = document.getElementById('back-to-top');
      if (backToTopButton) {
        let ticking = false;
        window.addEventListener('scroll', function() {
          if (!ticking) {
            window.requestAnimationFrame(function() {
              if (window.pageYOffset > 300) {
                backToTopButton.classList.remove('opacity-0', 'invisible');
                backToTopButton.classList.add('opacity-100', 'visible');
              } else {
                backToTopButton.classList.add('opacity-0', 'invisible');
                backToTopButton.classList.remove('opacity-100', 'visible');
              }
              ticking = false;
            });
            ticking = true;
          }
        });

        backToTopButton.addEventListener('click', function() {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      // 评论表单提交
      const commentForm = document.getElementById('comment-form');
      if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
      }

      // 主题切换功能
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        const isDark = document.documentElement.classList.contains('dark');
        updateThemeIcon(isDark);

        themeToggle.addEventListener('click', function() {
          const isDark = document.documentElement.classList.contains('dark');
          const newTheme = isDark ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
          localStorage.setItem('theme', newTheme);
          updateThemeIcon(newTheme === 'dark');
        });
      }

      function updateThemeIcon(isDark) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
          const icon = themeToggle.querySelector('svg');
          if (isDark) {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
          } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
          }
        }
      }
    });

    async function handleCommentSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;

      submitButton.disabled = true;
      submitButton.innerHTML = '<div class="loading mr-2"></div>提交中...';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          showNotification('评论提交成功，等待审核！', 'success');
          form.reset();
        } else {
          showNotification('评论提交失败：' + result.error, 'error');
        }
      } catch (error) {
        showNotification('评论提交失败，请稍后重试', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }

    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      const bgClass = type === 'success' ? 'bg-green-500 text-white' :
                      type === 'error' ? 'bg-red-500 text-white' :
                      'bg-blue-500 text-white';
      notification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full ' + bgClass;
      notification.textContent = message;

      document.body.appendChild(notification);

      setTimeout(() => notification.classList.remove('translate-x-full'), 10);
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  </script>
</body>
</html>`;
}

// 头部导航
function renderHeader(settings: Record<string, any>): string {
	const siteTitle = settings.site_title || '个人博客';

	return `
  <header class="bg-slate-800 dark:bg-slate-800 shadow-sm border-b border-slate-700 dark:border-slate-700">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <a href="/" class="text-xl font-bold text-gray-100 dark:text-gray-100 hover:text-primary transition-colors">${escapeHtml(siteTitle)}</a>
        </div>
        
        <nav class="hidden md:flex space-x-8">
          <a href="/" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-colors">首页</a>
          <a href="/categories" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-colors">分类</a>
          <a href="/tags" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-colors">标签</a>
          <a href="/about" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-colors">关于</a>
          <a href="/admin/login" class="text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-colors flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            管理
          </a>
        </nav>
        
        <div class="hidden md:flex items-center space-x-4">
          <button id="theme-toggle" class="p-2 rounded-lg bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 text-gray-300 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors" title="切换主题">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
            </svg>
          </button>
          <form action="/search" method="GET" class="relative">
            <input type="text" name="q" placeholder="搜索文章..."
                   class="w-64 px-4 py-2 pr-10 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            <button type="submit" class="absolute right-2 top-2 text-gray-400 dark:text-gray-400 hover:text-gray-200 dark:hover:text-gray-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
          </form>
        </div>
        
        <button id="mobile-menu-button" class="md:hidden p-2 rounded-md text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 hover:bg-slate-700 dark:hover:bg-slate-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>
      
      <div id="mobile-menu" class="hidden md:hidden pb-4">
        <div class="space-y-2">
          <a href="/" class="block px-3 py-2 text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">首页</a>
          <a href="/categories" class="block px-3 py-2 text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">分类</a>
          <a href="/tags" class="block px-3 py-2 text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">标签</a>
          <a href="/about" class="block px-3 py-2 text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100">关于</a>
          <a href="/admin/login" class="block px-3 py-2 text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            管理
          </a>
        </div>
        <div class="mt-4 px-3">
          <form action="/search" method="GET">
            <input type="text" name="q" placeholder="搜索文章..."
                   class="w-full px-4 py-2 bg-slate-700 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          </form>
        </div>
      </div>
    </div>
  </header>`;
}

// 页脚
function renderFooter(settings: Record<string, any>): string {
	const siteAuthor = settings.site_author || '博客作者';
	const currentYear = new Date().getFullYear();

	return `
  <footer class="bg-gray-800 text-white mt-16">
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="text-lg font-semibold mb-4">关于博客</h3>
          <p class="text-gray-300">${escapeHtml(settings.site_description || '分享技术、记录生活的个人博客')}</p>
        </div>
        
        <div>
          <h3 class="text-lg font-semibold mb-4">快速链接</h3>
          <div class="flex flex-wrap gap-4 text-gray-300">
            <a href="/" class="hover:text-white transition-colors">首页</a>
            <a href="/categories" class="hover:text-white transition-colors">分类</a>
            <a href="/tags" class="hover:text-white transition-colors">标签</a>
            <a href="/about" class="hover:text-white transition-colors">关于</a>
          </div>
        </div>
        
        <div>
          <h3 class="text-lg font-semibold mb-4">联系方式</h3>
          <ul class="space-y-2 text-gray-300">
            ${settings.social_email ? `<li><a href="mailto:${settings.social_email}" class="hover:text-white transition-colors">邮箱</a></li>` : ''}
            ${settings.social_github ? `<li><a href="${settings.social_github}" class="hover:text-white transition-colors">GitHub</a></li>` : ''}
            ${settings.social_twitter ? `<li><a href="${settings.social_twitter}" class="hover:text-white transition-colors">Twitter</a></li>` : ''}
          </ul>
        </div>
      </div>
      
      <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-300">
        <p>&copy; ${currentYear} ${escapeHtml(siteAuthor)}. 基于 Cloudflare Workers 构建.</p>
      </div>
    </div>
  </footer>`;
}

// 首页模板
export function renderHomePage(postsResult: any, categories: Category[], tags: Tag[], settings: Record<string, any>): string {
	const { data: posts, pagination } = postsResult;

	const content = `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div class="lg:col-span-3 order-2 lg:order-1">
        <div class="flex items-center justify-between mb-8">
          <h1 class="text-3xl font-bold text-gray-100 dark:text-gray-100">最新文章</h1>
          <div class="hidden sm:flex items-center text-sm text-gray-400 dark:text-gray-400">
            共 ${pagination.total} 篇文章
          </div>
        </div>

        ${
					posts.length > 0
						? `
          <div class="space-y-6 lg:space-y-8">
            ${posts.map((post: any) => renderPostCard(post)).join('')}
          </div>

          ${renderPagination(pagination, '/')}
        `
						: `
          ${renderEmptyState({
						icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>',
						title: '暂无文章',
						description: '管理员还没有发布任何文章，请稍后再来',
					})}
        `
				}
      </div>

      <div class="lg:col-span-1 order-1 lg:order-2">
        <div class="lg:sticky lg:top-8 space-y-6 lg:space-y-8">
          ${renderSidebar(categories, tags)}
        </div>
      </div>
    </div>
  `;

	return renderLayout({
		title: settings.site_title || '个人博客',
		description: settings.site_description,
		keywords: settings.site_keywords,
		content,
		settings,
	});
}

// 文章卡片
function renderPostCard(post: PostWithDetails): string {
	const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN');
	const readTime = estimateReadTime(post.content);

	return `
    <article class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-6 card-hover fade-in">
      ${
				post.featured_image
					? `
        <div class="overflow-hidden rounded-lg mb-4">
          <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}"
               loading="lazy" decoding="async" fetchpriority="low"
               class="w-full h-48 object-cover transition-transform duration-300 hover:scale-105"
               width="600" height="200">
        </div>
      `
					: ''
			}

      <div class="flex items-center space-x-4 text-sm text-gray-400 dark:text-gray-400 mb-3 mobile-text-sm">
        <time datetime="${post.published_at || post.created_at}">${publishedDate}</time>
        ${
					post.category
						? `
          <span class="px-2 py-1 rounded text-xs transition-colors hover:opacity-80"
                style="background-color: ${post.category.color}20; color: ${post.category.color}">
            ${escapeHtml(post.category.name)}
          </span>
        `
						: ''
				}
        <span class="hidden sm:inline flex items-center">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          ${readTime} 分钟
        </span>
        <span class="hidden sm:inline">${post.view_count} 阅读</span>
        <span class="hidden sm:inline">${post.comment_count} 评论</span>
      </div>

      <h2 class="text-xl font-bold text-gray-100 dark:text-gray-100 mb-3 leading-tight">
        <a href="/posts/${escapeHtml(post.slug)}"
           class="hover:text-primary transition-colors duration-200 block">
          ${escapeHtml(post.title)}
        </a>
      </h2>

      <p class="text-gray-300 dark:text-gray-300 mb-4 line-clamp-3 leading-relaxed">${escapeHtml(post.excerpt || '')}</p>

      ${
				post.tags && post.tags.length > 0
					? `
        <div class="flex flex-wrap gap-2 mb-4">
          ${post.tags
						.slice(0, 3)
						.map(
							(tag) => `
            <a href="/tags/${escapeHtml(tag.slug)}"
               class="px-2 py-1 text-xs rounded transition-all duration-200 hover:scale-105"
               style="background-color: ${tag.color}20; color: ${tag.color}">
              #${escapeHtml(tag.name)}
            </a>
          `,
						)
						.join('')}
          ${post.tags.length > 3 ? `<span class="text-xs text-gray-400">+${post.tags.length - 3}</span>` : ''}
        </div>
      `
					: ''
			}

      <div class="flex items-center justify-between">
        <a href="/posts/${escapeHtml(post.slug)}"
           class="inline-flex items-center text-primary hover:text-primary/80 font-medium transition-colors duration-200 group">
          阅读全文
          <svg class="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </a>

        <div class="flex items-center space-x-3 text-sm text-gray-400 sm:hidden">
          <span>${post.view_count}</span>
          <span>${post.comment_count}</span>
        </div>
      </div>
    </article>
  `;
}

// 侧边栏
function renderSidebar(categories: Category[], tags: Tag[]): string {
	return `
    <!-- 分类 -->
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-6 fade-in">
      <h3 class="text-lg font-semibold text-gray-100 dark:text-gray-100 mb-4 flex items-center">
        <svg class="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
        </svg>
        分类
      </h3>
      <ul class="space-y-2">
        ${categories
					.slice(0, 8)
					.map(
						(category) => `
          <li>
            <a href="/categories/${escapeHtml(category.slug)}"
               class="flex items-center justify-between text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 transition-all duration-200 p-2 rounded hover:bg-slate-700 dark:hover:bg-slate-700 group">
              <span class="flex items-center">
                <span class="w-3 h-3 rounded-full mr-3 transition-transform duration-200 group-hover:scale-110"
                      style="background-color: ${category.color}"></span>
                <span class="truncate">${escapeHtml(category.name)}</span>
              </span>
              <span class="text-sm text-gray-400 dark:text-gray-400 bg-slate-700 dark:bg-slate-700 px-2 py-1 rounded-full">
                ${(category as any).post_count || 0}
              </span>
            </a>
          </li>
        `,
					)
					.join('')}
        ${
					categories.length > 8
						? `
          <li class="pt-2">
            <a href="/categories" class="text-sm text-primary hover:text-primary/80 transition-colors">
              查看全部分类 →
            </a>
          </li>
        `
						: ''
				}
      </ul>
    </div>

    <!-- 热门标签 -->
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-6 fade-in">
      <h3 class="text-lg font-semibold text-gray-100 dark:text-gray-100 mb-4 flex items-center">
        <svg class="w-5 h-5 mr-2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
        </svg>
        热门标签
      </h3>
      <div class="flex flex-wrap gap-2">
        ${tags
					.filter((tag) => tag.usage_count > 0)
					.slice(0, 15)
					.map(
						(tag) => `
          <a href="/tags/${escapeHtml(tag.slug)}"
             class="px-3 py-1 text-sm rounded-full border transition-all duration-200 hover:shadow-md hover:scale-105"
             style="border-color: ${tag.color}; color: ${tag.color}"
             title="${escapeHtml(tag.description || tag.name)} (${tag.usage_count} 篇文章)">
            ${escapeHtml(tag.name)}
          </a>
        `,
					)
					.join('')}
        ${
					tags.filter((tag) => tag.usage_count > 0).length > 15
						? `
          <a href="/tags"
             class="px-3 py-1 text-sm rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
            更多...
          </a>
        `
						: ''
				}
      </div>
    </div>
  `;
}

// 转义 HTML 特殊字符
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

// 面包屑导航组件
function renderBreadcrumb(items: { label: string; href?: string }[]): string {
	return `
    <nav class="mb-6" aria-label="Breadcrumb">
      <ol class="flex items-center flex-wrap text-sm text-gray-400">
        <li>
          <a href="/" class="hover:text-gray-200 transition-colors flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            首页
          </a>
        </li>
        ${items
					.map(
						(item, index) => `
          <li class="flex items-center">
            <svg class="w-4 h-4 mx-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            ${
							item.href && index < items.length - 1
								? `
              <a href="${escapeHtml(item.href)}" class="hover:text-gray-200 transition-colors">${escapeHtml(item.label)}</a>
            `
								: `
              <span class="${index === items.length - 1 ? 'text-gray-200' : ''}">${escapeHtml(item.label)}</span>
            `
						}
          </li>
        `,
					)
					.join('')}
      </ol>
    </nav>
  `;
}

// 空状态组件
function renderEmptyState(options: {
	icon?: string;
	title: string;
	description?: string;
	actionText?: string;
	actionHref?: string;
}): string {
	const { icon, title, description, actionText, actionHref } = options;

	return `
    <div class="text-center py-16 px-4">
      <div class="max-w-sm mx-auto">
        ${
					icon
						? `
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${icon}
            </svg>
          </div>
        `
						: `
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
        `
				}
        <h3 class="text-xl font-semibold text-gray-200 mb-2">${escapeHtml(title)}</h3>
        ${description ? `<p class="text-gray-400 mb-6">${escapeHtml(description)}</p>` : ''}
        ${
					actionText && actionHref
						? `
          <a href="${escapeHtml(actionHref)}" class="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors">
            ${escapeHtml(actionText)}
            <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </a>
        `
						: ''
				}
      </div>
    </div>
  `;
}

// 文章详情页模板
export function renderPostPage(
	post: PostWithDetails,
	comments: any[],
	settings: Record<string, any>,
	adjacentPosts?: { prev: any | null; next: any | null },
	relatedPosts?: any[],
): string {
	const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN');
	const readTime = estimateReadTime(post.content);
	const toc = extractToc(post.content);

	// 构建面包屑导航项
	const breadcrumbItems = [];
	if (post.category) {
		breadcrumbItems.push({ label: post.category.name, href: `/categories/${post.category.slug}` });
	}
	breadcrumbItems.push({ label: post.title });

	const content = `
    <div class="max-w-5xl mx-auto">
      <!-- 面包屑导航 -->
      ${renderBreadcrumb(breadcrumbItems)}

      <!-- 文章主体区域 -->
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- 左侧目录（桌面端） -->
        ${
					toc.length > 3
						? `
          <aside class="hidden lg:block lg:w-64 flex-shrink-0">
            <div class="sticky top-24">
              <nav class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
                <h3 class="text-sm font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-3">目录</h3>
                <ul class="space-y-2 text-sm">
                  ${toc
										.map(
											(item) => `
                    <li style="padding-left: ${(item.level - 1) * 0.75}rem">
                      <a href="#${item.slug}"
                         class="text-gray-300 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors block py-1 truncate">
                        ${escapeHtml(item.text)}
                      </a>
                    </li>
                  `,
										)
										.join('')}
                </ul>
              </nav>
            </div>
          </aside>
        `
						: ''
				}

        <!-- 文章内容区域 -->
        <div class="flex-1 min-w-0">
          <article class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-6 md:p-8 mb-8">
            <!-- 文章头部 -->
            <header class="mb-8">
              <h1 class="text-3xl md:text-4xl font-bold text-gray-100 dark:text-gray-100 mb-4">${escapeHtml(post.title)}</h1>

              <div class="flex flex-wrap items-center gap-4 text-sm text-gray-400 dark:text-gray-400 mb-6">
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <time datetime="${post.published_at || post.created_at}">${publishedDate}</time>
                </div>

                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  ${readTime} 分钟阅读
                </div>

                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  ${post.view_count + 1} 阅读
                </div>

                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                  ${post.comment_count} 评论
                </div>

                ${
									post.category
										? `
                  <span class="px-3 py-1 rounded-full text-xs" style="background-color: ${post.category.color}20; color: ${post.category.color}">
                    ${escapeHtml(post.category.name)}
                  </span>
                `
										: ''
								}
              </div>

              ${
								post.tags && post.tags.length > 0
									? `
                <div class="flex flex-wrap gap-2">
                  ${post.tags
										.map(
											(tag) => `
                    <a href="/tags/${escapeHtml(tag.slug)}"
                       class="px-3 py-1 text-sm rounded-full border hover:shadow-sm transition-shadow"
                       style="border-color: ${tag.color}; color: ${tag.color}">
                      #${escapeHtml(tag.name)}
                    </a>
                  `,
										)
										.join('')}
                </div>
              `
									: ''
							}
            </header>

            <!-- 特色图片 -->
            ${
							post.featured_image
								? `
              <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}"
                   loading="lazy" decoding="async" fetchpriority="high"
                   class="w-full h-64 object-cover rounded-lg mb-8"
                   width="800" height="400">
            `
								: ''
						}

            <!-- 移动端目录 -->
            ${
							toc.length > 3
								? `
              <div class="lg:hidden mb-8">
                <details class="bg-slate-700 dark:bg-slate-700 rounded-lg p-4">
                  <summary class="cursor-pointer text-sm font-semibold text-gray-300 dark:text-gray-300">目录</summary>
                  <ul class="mt-3 space-y-2 text-sm">
                    ${toc
											.map(
												(item) => `
                      <li style="padding-left: ${(item.level - 1) * 0.75}rem">
                        <a href="#${item.slug}"
                           class="text-gray-300 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors block py-1">
                          ${escapeHtml(item.text)}
                        </a>
                      </li>
                    `,
											)
											.join('')}
                  </ul>
                </details>
              </div>
            `
								: ''
						}

            <!-- 文章内容 -->
            <div class="prose prose-invert max-w-none">
              <div class="markdown-content">
                ${markdownToHtml(post.content)}
              </div>
            </div>

            <!-- 分享按钮 -->
            <div class="mt-8 pt-6 border-t border-slate-700 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400 dark:text-gray-400">分享到：</span>
                <div class="flex items-center space-x-3">
                  <button onclick="shareToTwitter()" class="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors" title="分享到 Twitter">
                    <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                  <button onclick="shareToWeibo()" class="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors" title="分享到微博">
                    <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.739 5.443zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.194.573zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.649.361-1.024.399-1.905.001-2.533-.748-1.181-2.793-1.119-5.129-.034 0 0-.736.322-.548-.26.358-1.186.305-2.18-.254-2.755-1.268-1.303-4.635.048-7.522 3.021-2.166 2.228-3.418 4.59-3.418 6.628 0 3.902 4.998 6.276 9.883 6.276 6.405 0 10.671-3.727 10.671-6.687 0-1.789-1.508-2.807-3.279-3.007zm2.002-5.625c-.808-.902-1.997-1.226-3.063-.912l.001-.001c-.303.088-.48.404-.392.707.088.303.404.479.707.391.636-.183 1.354.014 1.833.55.479.536.594 1.269.342 1.883-.095.233.016.5.25.595.233.095.5-.016.595-.25.401-.981.206-2.132-.773-2.963zm2.002-2.241c-1.407-1.573-3.481-2.136-5.344-1.601-.32.093-.507.426-.414.746.093.32.426.507.746.414 1.457-.418 3.088.029 4.193 1.263 1.105 1.235 1.38 2.9.853 4.32-.109.295.042.623.337.732.295.109.623-.042.732-.337.672-1.813.317-3.945-1.103-5.537z"/></svg>
                  </button>
                  <button onclick="copyLink()" class="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors" title="复制链接">
                    <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </article>

          <!-- 上一篇/下一篇导航 -->
          ${
						adjacentPosts
							? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              ${
								adjacentPosts.prev
									? `
                <a href="/posts/${adjacentPosts.prev.slug}"
                   class="group bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-4 hover:border-primary transition-colors">
                  <span class="text-sm text-gray-400 dark:text-gray-400 flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    上一篇
                  </span>
                  <span class="text-gray-200 dark:text-gray-200 group-hover:text-primary transition-colors line-clamp-2 mt-1">${escapeHtml(adjacentPosts.prev.title)}</span>
                </a>
              `
									: '<div></div>'
							}
              ${
								adjacentPosts.next
									? `
                <a href="/posts/${adjacentPosts.next.slug}"
                   class="group bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-4 hover:border-primary transition-colors text-right">
                  <span class="text-sm text-gray-400 dark:text-gray-400 flex items-center justify-end">
                    下一篇
                    <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </span>
                  <span class="text-gray-200 dark:text-gray-200 group-hover:text-primary transition-colors line-clamp-2 mt-1">${escapeHtml(adjacentPosts.next.title)}</span>
                </a>
              `
									: ''
							}
            </div>
          `
							: ''
					}

          <!-- 相关文章推荐 -->
          ${
						relatedPosts && relatedPosts.length > 0
							? `
            <div class="bg-slate-800 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-6 mb-8">
              <h3 class="text-xl font-bold text-gray-100 dark:text-gray-100 mb-4">相关文章</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${relatedPosts
									.map(
										(relatedPost) => `
                  <a href="/posts/${relatedPost.slug}"
                     class="group flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors">
                    ${
											relatedPost.featured_image
												? `
                      <img src="${escapeHtml(relatedPost.featured_image)}" alt=""
                           loading="lazy" decoding="async" fetchpriority="low"
                           class="w-20 h-16 object-cover rounded flex-shrink-0"
                           width="80" height="64">
                    `
												: ''
										}
                    <div class="flex-1 min-w-0">
                      <h4 class="text-gray-200 dark:text-gray-200 group-hover:text-primary transition-colors line-clamp-2 font-medium">${escapeHtml(relatedPost.title)}</h4>
                      <div class="flex items-center space-x-3 text-xs text-gray-400 dark:text-gray-400 mt-1">
                        <span>${relatedPost.view_count} 阅读</span>
                        <span>${relatedPost.comment_count} 评论</span>
                      </div>
                    </div>
                  </a>
                `,
									)
									.join('')}
              </div>
            </div>
          `
							: ''
					}

          <!-- 评论区 -->
          ${renderCommentSection(post.id, comments)}
        </div>
      </div>
    </div>

    <script>
      function shareToTwitter() {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent('${escapeHtml(post.title)}');
        window.open('https://twitter.com/intent/tweet?url=' + url + '&text=' + text, '_blank');
      }

      function shareToWeibo() {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent('${escapeHtml(post.title)}');
        window.open('https://service.weibo.com/share/share.php?url=' + url + '&title=' + title, '_blank');
      }

      function copyLink() {
        navigator.clipboard.writeText(window.location.href).then(() => {
          showNotification('链接已复制到剪贴板', 'success');
        });
      }
    </script>
  `;

	return renderLayout({
		title: post.title,
		description: post.excerpt,
		keywords: post.tags?.map((tag) => tag.name).join(','),
		content,
		settings,
		image: post.featured_image,
		type: 'article',
	});
}

// 评论区模板
function renderCommentSection(postId: number, comments: any[]): string {
	return `
    <div class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-8">
      <h3 class="text-2xl font-bold text-gray-100 dark:text-gray-100 mb-6">评论 (${comments.length})</h3>

      <!-- 评论表单 -->
      <form id="comment-form" action="/api/posts/${postId}/comments" class="mb-8 p-6 bg-slate-700 dark:bg-slate-700 rounded-lg">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label for="author_name" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">姓名 *</label>
            <input type="text" id="author_name" name="author_name" required
                   class="w-full px-3 py-2 bg-slate-600 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-md text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          </div>
          <div>
            <label for="author_email" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">邮箱 *</label>
            <input type="email" id="author_email" name="author_email" required
                   class="w-full px-3 py-2 bg-slate-600 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-md text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          </div>
        </div>
        <div class="mb-4">
          <label for="author_website" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">网站</label>
          <input type="url" id="author_website" name="author_website"
                 class="w-full px-3 py-2 bg-slate-600 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-md text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
        </div>
        <div class="mb-4">
          <label for="content" class="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-1">评论内容 *</label>
          <textarea id="content" name="content" rows="4" required
                    class="w-full px-3 py-2 bg-slate-600 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-md text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="请输入您的评论..."></textarea>
        </div>
        <button type="submit"
                class="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
          提交评论
        </button>
      </form>

      <!-- 评论列表 -->
      ${
				comments.length > 0
					? `
        <div class="space-y-6">
          ${comments.map((comment) => renderComment(comment)).join('')}
        </div>
      `
					: `
        <p class="text-gray-400 dark:text-gray-400 text-center py-8">暂无评论，快来抢沙发吧！</p>
      `
			}
    </div>
  `;
}

// 单个评论模板
function renderComment(comment: any): string {
	const commentDate = new Date(comment.created_at).toLocaleDateString('zh-CN');

	return `
    <div class="border-l-4 border-slate-600 dark:border-slate-600 pl-4">
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 bg-slate-600 dark:bg-slate-600 rounded-full flex items-center justify-center">
            <span class="text-sm font-medium text-gray-200 dark:text-gray-200">
              ${escapeHtml(comment.author_name.charAt(0).toUpperCase())}
            </span>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex items-center space-x-2 mb-1">
            <h4 class="font-medium text-gray-100 dark:text-gray-100">
              ${
								comment.author_website
									? `<a href="${escapeHtml(comment.author_website)}" class="hover:text-primary transition-colors">${escapeHtml(comment.author_name)}</a>`
									: escapeHtml(comment.author_name)
							}
            </h4>
            <span class="text-sm text-gray-400 dark:text-gray-400">${commentDate}</span>
          </div>

          <div class="text-gray-300 dark:text-gray-300 mb-2">
            ${escapeHtml(comment.content)}
          </div>
        </div>
      </div>

      <!-- 回复 -->
      ${
				comment.replies && comment.replies.length > 0
					? `
        <div class="ml-8 mt-4 space-y-4">
          ${comment.replies.map((reply: any) => renderComment(reply)).join('')}
        </div>
      `
					: ''
			}
    </div>
  `;
}

// 分页导航组件
export function renderPagination(pagination: any, baseUrl: string, queryParams: Record<string, string> = {}): string {
	const { page, totalPages, hasNext, hasPrev } = pagination;

	if (totalPages <= 1) return '';

	// 构建查询参数
	const buildUrl = (pageNum: number) => {
		const params = new URLSearchParams(queryParams);
		params.set('page', pageNum.toString());
		return `${baseUrl}?${params.toString()}`;
	};

	// 计算显示的页码范围
	const maxVisible = 5;
	let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
	let endPage = Math.min(totalPages, startPage + maxVisible - 1);

	if (endPage - startPage + 1 < maxVisible) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	const pages = [];
	for (let i = startPage; i <= endPage; i++) {
		pages.push(i);
	}

	return `
    <nav class="flex items-center justify-center space-x-2 mt-8">
      ${
				hasPrev
					? `
        <a href="${buildUrl(1)}"
           class="px-3 py-2 text-sm font-medium text-gray-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          首页
        </a>
        <a href="${buildUrl(page - 1)}"
           class="px-3 py-2 text-sm font-medium text-gray-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          上一页
        </a>
      `
					: ''
			}

      ${pages
				.map(
					(pageNum) => `
        <a href="${buildUrl(pageNum)}"
           class="px-3 py-2 text-sm font-medium ${
							pageNum === page
								? 'text-white bg-primary border border-primary'
								: 'text-gray-300 bg-slate-700 border border-slate-600 hover:bg-slate-600'
						} rounded-md transition-colors">
          ${pageNum}
        </a>
      `,
				)
				.join('')}

      ${
				hasNext
					? `
        <a href="${buildUrl(page + 1)}"
           class="px-3 py-2 text-sm font-medium text-gray-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          下一页
        </a>
        <a href="${buildUrl(totalPages)}"
           class="px-3 py-2 text-sm font-medium text-gray-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          末页
        </a>
      `
					: ''
			}
    </nav>
  `;
}

// Markdown 转 HTML（使用增强的渲染器）
export function markdownToHtml(markdown: string): string {
	return renderMarkdown(markdown);
}

// 404 页面模板
export function render404Page(settings: Record<string, any> = {}): string {
	const siteTitle = settings.site_title || '个人博客';

	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面未找到 - ${siteTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' }
  </script>
  <style>
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }
    .float-animation { animation: float 3s ease-in-out infinite; }
  </style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen flex items-center justify-center text-gray-100">
  <div class="text-center px-4">
    <!-- 404 图形 -->
    <div class="relative mb-8">
      <h1 class="text-[150px] md:text-[200px] font-bold text-slate-800 dark:text-slate-800 select-none leading-none">404</h1>
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="float-animation">
          <svg class="w-32 h-32 md:w-40 md:h-40 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <h2 class="text-2xl md:text-3xl font-bold text-gray-100 mb-4">页面未找到</h2>
    <p class="text-gray-400 mb-8 max-w-md mx-auto">
      抱歉，您访问的页面不存在或已被移除。请检查网址是否正确，或返回首页继续浏览。
    </p>

    <!-- 操作按钮 -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="/" class="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
        返回首页
      </a>
      <button onclick="history.back()" class="inline-flex items-center px-6 py-3 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors font-medium">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        返回上一页
      </button>
    </div>

    <!-- 快捷链接 -->
    <div class="mt-12 pt-8 border-t border-slate-700">
      <p class="text-gray-500 text-sm mb-4">或者尝试以下链接：</p>
      <div class="flex flex-wrap justify-center gap-4 text-sm">
        <a href="/categories" class="text-blue-400 hover:text-blue-300 transition-colors">分类</a>
        <a href="/tags" class="text-blue-400 hover:text-blue-300 transition-colors">标签</a>
        <a href="/archives" class="text-blue-400 hover:text-blue-300 transition-colors">归档</a>
        <a href="/about" class="text-blue-400 hover:text-blue-300 transition-colors">关于</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 500 错误页面模板
export function render500Page(settings: Record<string, any> = {}): string {
	const siteTitle = settings.site_title || '个人博客';

	return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>服务器错误 - ${siteTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' }
  </script>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen flex items-center justify-center text-gray-100">
  <div class="text-center px-4">
    <div class="mb-8">
      <svg class="w-32 h-32 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    </div>
    <h1 class="text-4xl font-bold text-gray-100 mb-4">服务器错误</h1>
    <p class="text-gray-400 mb-8 max-w-md mx-auto">
      抱歉，服务器遇到了问题。请稍后再试，或返回首页继续浏览。
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="/" class="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
        返回首页
      </a>
      <button onclick="location.reload()" class="inline-flex items-center px-6 py-3 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors font-medium">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        重新加载
      </button>
    </div>
  </div>
</body>
</html>`;
}
