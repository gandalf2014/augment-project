/**
 * HTML 模板工具
 */

import type { PostWithDetails, Category, Tag, Setting } from '../types/database';

// 基础布局模板
export function renderLayout(options: {
  title: string;
  description?: string;
  keywords?: string;
  content: string;
  settings?: Record<string, any>;
}): string {
  const { title, description, keywords, content, settings = {} } = options;
  
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
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
  </script>
  <style>
    /* Markdown 内容样式 */
    .markdown-content {
      line-height: 1.7;
    }

    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4,
    .markdown-content h5,
    .markdown-content h6 {
      scroll-margin-top: 2rem;
    }

    .markdown-content pre {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    }

    .markdown-content code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    }

    .markdown-content blockquote {
      position: relative;
    }

    .markdown-content blockquote::before {
      content: '"';
      position: absolute;
      left: -0.5rem;
      top: -0.5rem;
      font-size: 2rem;
      color: #60A5FA;
      opacity: 0.5;
    }

    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    .markdown-content th,
    .markdown-content td {
      border: 1px solid #374151;
      padding: 0.75rem;
      text-align: left;
    }

    .markdown-content th {
      background-color: #1F2937;
      font-weight: 600;
      color: #F3F4F6;
    }

    .markdown-content td {
      color: #D1D5DB;
    }

    /* 代码高亮样式 */
    .markdown-content pre code {
      display: block;
      padding: 0;
      background: transparent;
      border: none;
    }

    /* 滚动条样式 */
    .markdown-content pre::-webkit-scrollbar {
      height: 8px;
    }

    .markdown-content pre::-webkit-scrollbar-track {
      background: #1F2937;
      border-radius: 4px;
    }

    .markdown-content pre::-webkit-scrollbar-thumb {
      background: #4B5563;
      border-radius: 4px;
    }

    .markdown-content pre::-webkit-scrollbar-thumb:hover {
      background: #6B7280;
    }
  </style>
  <style>
    .prose { max-width: none; }
    .prose h1 { @apply text-3xl font-bold mb-4 text-gray-100 dark:text-gray-100; }
    .prose h2 { @apply text-2xl font-bold mb-3 text-gray-200 dark:text-gray-200; }
    .prose h3 { @apply text-xl font-bold mb-2 text-gray-300 dark:text-gray-300; }
    .prose p { @apply mb-4 text-gray-300 dark:text-gray-300 leading-relaxed; }
    .prose ul { @apply mb-4 pl-6 list-disc; }
    .prose ol { @apply mb-4 pl-6 list-decimal; }
    .prose li { @apply mb-1 text-gray-300 dark:text-gray-300; }
    .prose blockquote { @apply border-l-4 border-gray-600 dark:border-gray-600 pl-4 italic text-gray-400 dark:text-gray-400 mb-4; }
    .prose code { @apply bg-gray-800 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono text-gray-200 dark:text-gray-200; }
    .prose pre { @apply bg-gray-800 dark:bg-gray-800 p-4 rounded overflow-x-auto mb-4; }
    .prose a { @apply text-primary hover:text-primary/80 underline; }

    /* 动画效果 */
    .fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card-hover {
      transition: all 0.3s ease;
    }

    .card-hover:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    /* 加载动画 */
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 响应式优化 */
    @media (max-width: 768px) {
      .mobile-padding { padding: 1rem; }
      .mobile-text-sm { font-size: 0.875rem; }
    }
  </style>
</head>
<body class="bg-slate-900 dark:bg-slate-900 min-h-screen text-gray-100 dark:text-gray-100">
  ${renderHeader(settings)}
  <main class="container mx-auto px-4 py-8">
    ${content}
  </main>
  ${renderFooter(settings)}
  <!-- 返回顶部按钮 -->
  <button id="back-to-top"
          class="fixed bottom-8 right-8 bg-primary text-white p-3 rounded-full shadow-lg opacity-0 invisible transition-all duration-300 hover:bg-primary/90 hover:scale-110 z-50">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
    </svg>
  </button>

  <script>
    // 增强的交互功能
    document.addEventListener('DOMContentLoaded', function() {
      // 移动端菜单切换
      const menuButton = document.getElementById('mobile-menu-button');
      const mobileMenu = document.getElementById('mobile-menu');

      if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', function() {
          mobileMenu.classList.toggle('hidden');
        });

        // 点击外部关闭菜单
        document.addEventListener('click', function(e) {
          if (!menuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
          }
        });
      }

      // 返回顶部按钮
      const backToTopButton = document.getElementById('back-to-top');
      if (backToTopButton) {
        window.addEventListener('scroll', function() {
          if (window.pageYOffset > 300) {
            backToTopButton.classList.remove('opacity-0', 'invisible');
            backToTopButton.classList.add('opacity-100', 'visible');
          } else {
            backToTopButton.classList.add('opacity-0', 'invisible');
            backToTopButton.classList.remove('opacity-100', 'visible');
          }
        });

        backToTopButton.addEventListener('click', function() {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        });
      }

      // 图片懒加载
      const images = document.querySelectorAll('img[data-src]');
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('opacity-0');
            img.classList.add('opacity-100');
            observer.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));

      // 评论表单提交
      const commentForm = document.getElementById('comment-form');
      if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
      }

      // 主题切换功能
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        // 初始化主题
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        updateThemeIcon(savedTheme === 'dark');

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
            // 月亮图标 (深色模式)
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
          } else {
            // 太阳图标 (浅色模式)
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
          }
        }
      }

      // 添加页面加载动画
      const fadeElements = document.querySelectorAll('.fade-in');
      const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.animationDelay = Math.random() * 0.3 + 's';
            entry.target.classList.add('animate-fade-in');
          }
        });
      });

      fadeElements.forEach(el => fadeObserver.observe(el));
    });

    async function handleCommentSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;

      // 显示加载状态
      submitButton.disabled = true;
      submitButton.innerHTML = '<div class="loading mr-2"></div>提交中...';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        // 恢复按钮状态
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }

    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = \`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full \${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
      }\`;
      notification.textContent = message;

      document.body.appendChild(notification);

      // 显示动画
      setTimeout(() => {
        notification.classList.remove('translate-x-full');
      }, 100);

      // 自动隐藏
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
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

        ${posts.length > 0 ? `
          <div class="space-y-6 lg:space-y-8">
            ${posts.map((post: any) => renderPostCard(post)).join('')}
          </div>

          ${renderPagination(pagination, '/')}
        ` : `
          <div class="text-center py-16">
            <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-gray-500 text-lg mb-2">暂无文章</p>
            <p class="text-gray-400 text-sm">管理员还没有发布任何文章</p>
          </div>
        `}
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
    settings
  });
}

// 文章卡片
function renderPostCard(post: PostWithDetails): string {
  const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN');

  return `
    <article class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-6 card-hover fade-in">
      ${post.featured_image ? `
        <div class="overflow-hidden rounded-lg mb-4">
          <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}"
               class="w-full h-48 object-cover transition-transform duration-300 hover:scale-105">
        </div>
      ` : ''}

      <div class="flex items-center space-x-4 text-sm text-gray-400 dark:text-gray-400 mb-3 mobile-text-sm">
        <time datetime="${post.published_at || post.created_at}">${publishedDate}</time>
        ${post.category ? `
          <span class="px-2 py-1 rounded text-xs transition-colors hover:opacity-80"
                style="background-color: ${post.category.color}20; color: ${post.category.color}">
            ${escapeHtml(post.category.name)}
          </span>
        ` : ''}
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

      ${post.tags && post.tags.length > 0 ? `
        <div class="flex flex-wrap gap-2 mb-4">
          ${post.tags.slice(0, 3).map(tag => `
            <a href="/tags/${escapeHtml(tag.slug)}"
               class="px-2 py-1 text-xs rounded transition-all duration-200 hover:scale-105"
               style="background-color: ${tag.color}20; color: ${tag.color}">
              #${escapeHtml(tag.name)}
            </a>
          `).join('')}
          ${post.tags.length > 3 ? `<span class="text-xs text-gray-400">+${post.tags.length - 3}</span>` : ''}
        </div>
      ` : ''}

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
        ${categories.slice(0, 8).map(category => `
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
        `).join('')}
        ${categories.length > 8 ? `
          <li class="pt-2">
            <a href="/categories" class="text-sm text-primary hover:text-primary/80 transition-colors">
              查看全部分类 →
            </a>
          </li>
        ` : ''}
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
        ${tags.filter(tag => tag.usage_count > 0).slice(0, 15).map(tag => `
          <a href="/tags/${escapeHtml(tag.slug)}"
             class="px-3 py-1 text-sm rounded-full border transition-all duration-200 hover:shadow-md hover:scale-105"
             style="border-color: ${tag.color}; color: ${tag.color}"
             title="${escapeHtml(tag.description || tag.name)} (${tag.usage_count} 篇文章)">
            ${escapeHtml(tag.name)}
          </a>
        `).join('')}
        ${tags.filter(tag => tag.usage_count > 0).length > 15 ? `
          <a href="/tags"
             class="px-3 py-1 text-sm rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
            更多...
          </a>
        ` : ''}
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
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 文章详情页模板
export function renderPostPage(post: PostWithDetails, comments: any[], settings: Record<string, any>): string {
  const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString('zh-CN');
  const content = `
    <div class="max-w-4xl mx-auto">
      <article class="bg-slate-800 dark:bg-slate-800 rounded-lg shadow-sm border border-slate-700 dark:border-slate-700 p-8 mb-8">
        <!-- 文章头部 -->
        <header class="mb-8">
          <h1 class="text-4xl font-bold text-gray-100 dark:text-gray-100 mb-4">${escapeHtml(post.title)}</h1>

          <div class="flex items-center space-x-6 text-sm text-gray-400 dark:text-gray-400 mb-6">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <time datetime="${post.published_at || post.created_at}">${publishedDate}</time>
            </div>

            <div class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              ${post.view_count} 阅读
            </div>

            <div class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              ${post.comment_count} 评论
            </div>

            ${post.category ? `
              <span class="px-3 py-1 rounded-full text-xs" style="background-color: ${post.category.color}20; color: ${post.category.color}">
                ${escapeHtml(post.category.name)}
              </span>
            ` : ''}
          </div>

          ${post.tags && post.tags.length > 0 ? `
            <div class="flex flex-wrap gap-2">
              ${post.tags.map(tag => `
                <a href="/tags/${escapeHtml(tag.slug)}"
                   class="px-3 py-1 text-sm rounded-full border hover:shadow-sm transition-shadow"
                   style="border-color: ${tag.color}; color: ${tag.color}">
                  #${escapeHtml(tag.name)}
                </a>
              `).join('')}
            </div>
          ` : ''}
        </header>

        <!-- 特色图片 -->
        ${post.featured_image ? `
          <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}"
               class="w-full h-64 object-cover rounded-lg mb-8">
        ` : ''}

        <!-- 文章内容 -->
        <div class="prose prose-invert max-w-none">
          <div class="markdown-content">
            ${markdownToHtml(post.content)}
          </div>
        </div>
      </article>

      <!-- 评论区 -->
      ${renderCommentSection(post.id, comments)}
    </div>
  `;

  return renderLayout({
    title: `${post.title} - ${settings.site_title || '个人博客'}`,
    description: post.excerpt,
    keywords: post.tags?.map(tag => tag.name).join(','),
    content,
    settings
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
      ${comments.length > 0 ? `
        <div class="space-y-6">
          ${comments.map(comment => renderComment(comment)).join('')}
        </div>
      ` : `
        <p class="text-gray-400 dark:text-gray-400 text-center py-8">暂无评论，快来抢沙发吧！</p>
      `}
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
              ${comment.author_website ?
                `<a href="${escapeHtml(comment.author_website)}" class="hover:text-primary transition-colors">${escapeHtml(comment.author_name)}</a>` :
                escapeHtml(comment.author_name)
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
      ${comment.replies && comment.replies.length > 0 ? `
        <div class="ml-8 mt-4 space-y-4">
          ${comment.replies.map((reply: any) => renderComment(reply)).join('')}
        </div>
      ` : ''}
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
      ${hasPrev ? `
        <a href="${buildUrl(1)}"
           class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          首页
        </a>
        <a href="${buildUrl(page - 1)}"
           class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          上一页
        </a>
      ` : ''}

      ${pages.map(pageNum => `
        <a href="${buildUrl(pageNum)}"
           class="px-3 py-2 text-sm font-medium ${
             pageNum === page
               ? 'text-white bg-primary border border-primary'
               : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
           } rounded-md">
          ${pageNum}
        </a>
      `).join('')}

      ${hasNext ? `
        <a href="${buildUrl(page + 1)}"
           class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          下一页
        </a>
        <a href="${buildUrl(totalPages)}"
           class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          末页
        </a>
      ` : ''}
    </nav>
  `;
}

// Markdown 转 HTML（增强实现）
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // 预处理：保护代码块内容
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(code);
    return `__CODE_BLOCK_${index}__`;
  });

  // 预处理：保护行内代码
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(code);
    return `__INLINE_CODE_${index}__`;
  });

  html = html
    // 标题（支持 h1-h6）
    .replace(/^###### (.*$)/gim, '<h6 class="text-lg font-semibold text-gray-100 mt-6 mb-3">$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5 class="text-xl font-semibold text-gray-100 mt-6 mb-3">$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-2xl font-semibold text-gray-100 mt-8 mb-4">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-3xl font-bold text-gray-100 mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-4xl font-bold text-gray-100 mt-10 mb-6">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-5xl font-bold text-gray-100 mt-12 mb-8">$1</h1>')

    // 水平分割线
    .replace(/^---$/gm, '<hr class="border-gray-600 my-8">')
    .replace(/^\*\*\*$/gm, '<hr class="border-gray-600 my-8">')

    // 引用块
    .replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 bg-slate-700 text-gray-300 italic">$1</blockquote>')

    // 无序列表
    .replace(/^\* (.*)$/gm, '<li class="text-gray-300 mb-1">$1</li>')
    .replace(/^- (.*)$/gm, '<li class="text-gray-300 mb-1">$1</li>')
    .replace(/^\+ (.*)$/gm, '<li class="text-gray-300 mb-1">$1</li>')

    // 有序列表
    .replace(/^\d+\. (.*)$/gm, '<li class="text-gray-300 mb-1">$1</li>')

    // 粗体和斜体
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold text-gray-100"><em class="italic">$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-100">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>')

    // 删除线
    .replace(/~~(.*?)~~/g, '<del class="line-through text-gray-500">$1</del>')

    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:text-primary/80 underline transition-colors" target="_blank" rel="noopener noreferrer">$1</a>')

    // 图片
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 mx-auto block">')

    // 段落处理
    .replace(/\n\n/g, '</p><p class="text-gray-300 mb-4">')
    .replace(/^(.+)$/gm, '<p class="text-gray-300 mb-4">$1</p>');

  // 包装列表项
  html = html.replace(/(<li[^>]*>.*<\/li>)/gs, (match) => {
    return `<ul class="list-disc list-inside space-y-1 my-4 ml-4">${match}</ul>`;
  });

  // 恢复代码块
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
    const code = escapeHtml(codeBlocks[parseInt(index)]);
    return `<pre class="bg-slate-900 border border-slate-600 rounded-lg p-4 my-6 overflow-x-auto"><code class="text-gray-300 text-sm">${code}</code></pre>`;
  });

  // 恢复行内代码
  html = html.replace(/__INLINE_CODE_(\d+)__/g, (match, index) => {
    const code = escapeHtml(inlineCodes[parseInt(index)]);
    return `<code class="bg-slate-700 text-primary px-2 py-1 rounded text-sm">${code}</code>`;
  });

  // 清理多余的段落标签
  html = html
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<pre[^>]*>.*<\/pre>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<blockquote[^>]*>.*<\/blockquote>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*<\/ul>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<hr[^>]*>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<img[^>]*>)<\/p>/g, '$1');

  return html;
}
