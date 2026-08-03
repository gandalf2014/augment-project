/**
 * SEO 路由
 * 包括 sitemap.xml, rss.xml, robots.txt
 */

import type { Router } from '../utils/router';
import type { Env } from '../types/database';
import { PostService } from '../services/postService';
import { CategoryService } from '../services/categoryService';
import { TagService } from '../services/tagService';
import { SettingService } from '../services/settingService';

export function registerSeoRoutes(router: Router) {

  // Sitemap XML
  router.get('/sitemap.xml', async (request, env: Env, ctx, params) => {
    try {
      const postService = new PostService(env.DB);
      const categoryService = new CategoryService(env.DB);
      const tagService = new TagService(env.DB);
      const settingService = new SettingService(env.DB);

      // 获取设置
      const settings = await settingService.getSettings();
      const siteUrl = settings.site_url || 'https://blog.jiayouilin.workers.dev';

      // 获取所有已发布的文章
      const postsResult = await postService.getPosts({
        status: 'published',
        limit: 1000
      });

      // 获取所有分类和标签
      const [categories, tags] = await Promise.all([
        categoryService.getCategories(),
        tagService.getTags()
      ]);

      const sitemap = generateSitemap(siteUrl, postsResult.data, categories, tags);

      return new Response(sitemap, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      console.error('Sitemap error:', error);
      return new Response('Error generating sitemap', { status: 500 });
    }
  });

  // RSS Feed
  router.get('/rss.xml', async (request, env: Env, ctx, params) => {
    try {
      const postService = new PostService(env.DB);
      const settingService = new SettingService(env.DB);

      // 获取设置
      const settings = await settingService.getSettings();
      const siteUrl = settings.site_url || 'https://blog.jiayouilin.workers.dev';
      const siteTitle = settings.site_title || '个人博客';
      const siteDescription = settings.site_description || '分享技术、记录生活的个人博客';

      // 获取最新文章
      const postsResult = await postService.getPosts({
        status: 'published',
        limit: 20
      });

      const rss = generateRss(siteUrl, siteTitle, siteDescription, postsResult.data);

      return new Response(rss, {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800'
        }
      });
    } catch (error) {
      console.error('RSS error:', error);
      return new Response('Error generating RSS feed', { status: 500 });
    }
  });

  // Robots.txt
  router.get('/robots.txt', async (request, env: Env, ctx, params) => {
    try {
      const settingService = new SettingService(env.DB);
      const settings = await settingService.getSettings();
      const siteUrl = settings.site_url || 'https://blog.jiayouilin.workers.dev';

      const robots = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml

# Disallow admin paths
Disallow: /admin/
Disallow: /api/

# Crawl delay (optional)
Crawl-delay: 1`;

      return new Response(robots, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    } catch (error) {
      console.error('Robots.txt error:', error);
      return new Response('Error generating robots.txt', { status: 500 });
    }
  });
}

// 生成 Sitemap XML
function generateSitemap(
  siteUrl: string,
  posts: any[],
  categories: any[],
  tags: any[]
): string {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 首页 -->
  <url>
    <loc>${escapeXml(siteUrl)}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- 分类页面 -->
  <url>
    <loc>${escapeXml(siteUrl)}/categories</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- 标签页面 -->
  <url>
    <loc>${escapeXml(siteUrl)}/tags</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- 关于页面 -->
  <url>
    <loc>${escapeXml(siteUrl)}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;

  // 添加文章页面
  for (const post of posts) {
    const lastmod = post.updated_at || post.published_at || post.created_at;
    xml += `
  <url>
    <loc>${escapeXml(siteUrl)}/posts/${escapeXml(post.slug)}</loc>
    <lastmod>${lastmod ? new Date(lastmod).toISOString() : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  // 添加分类页面
  for (const category of categories) {
    xml += `
  <url>
    <loc>${escapeXml(siteUrl)}/categories/${escapeXml(category.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  // 添加标签页面
  for (const tag of tags) {
    if (tag.usage_count > 0) {
      xml += `
  <url>
    <loc>${escapeXml(siteUrl)}/tags/${escapeXml(tag.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }
  }

  xml += `
</urlset>`;

  return xml;
}

// 生成 RSS Feed
function generateRss(
  siteUrl: string,
  siteTitle: string,
  siteDescription: string,
  posts: any[]
): string {
  const now = new Date().toUTCString();

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(siteTitle)}</title>
  <link>${escapeXml(siteUrl)}</link>
  <description>${escapeXml(siteDescription)}</description>
  <language>zh-CN</language>
  <lastBuildDate>${now}</lastBuildDate>
  <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
`;

  for (const post of posts) {
    const pubDate = post.published_at
      ? new Date(post.published_at).toUTCString()
      : new Date(post.created_at).toUTCString();

    // 清理内容中的 HTML 标签，只保留纯文本
    const plainExcerpt = post.excerpt
      ? post.excerpt.replace(/<[^>]*>/g, '').substring(0, 300)
      : '';

    rss += `
  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(siteUrl)}/posts/${escapeXml(post.slug)}</link>
    <guid isPermaLink="true">${escapeXml(siteUrl)}/posts/${escapeXml(post.slug)}</guid>
    <description>${escapeXml(plainExcerpt)}</description>
    <pubDate>${pubDate}</pubDate>
    ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ''}
    ${post.tags?.map((tag: any) => `<category>${escapeXml(tag.name)}</category>`).join('') || ''}
  </item>`;
  }

  rss += `
</channel>
</rss>`;

  return rss;
}

// XML 转义
function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}