/**
 * Markdown 渲染工具
 * 支持 GitHub Flavored Markdown 和代码高亮
 */

import { marked } from 'marked';
import hljs from 'highlight.js';

// 配置 marked 选项
marked.setOptions({
  gfm: true,        // GitHub Flavored Markdown
  breaks: true,     // 支持换行
});

// 自定义渲染器 - 使用类型断言避免类型检查问题
const renderer: any = new marked.Renderer();

// 代码块渲染（带语法高亮）
renderer.code = function(code: any): string {
  const text = typeof code === 'object' ? code.text : code;
  const lang = typeof code === 'object' ? code.lang : undefined;

  let highlighted: string;
  let language = lang || '';

  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(text, { language: lang }).value;
      language = lang;
    } catch {
      highlighted = escapeHtml(text);
    }
  } else {
    // 自动检测语言
    try {
      const result = hljs.highlightAuto(text);
      highlighted = result.value;
      language = result.language || '';
    } catch {
      highlighted = escapeHtml(text);
    }
  }

  // 添加语言标签和复制按钮
  const langLabel = language ? `<div class="code-lang">${language}</div>` : '';
  const copyBtn = `<button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">复制</button>`;

  return `<div class="code-block">${langLabel}${copyBtn}<pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
};

// 行内代码
renderer.codespan = function(code: any): string {
  const text = typeof code === 'object' ? code.text : code;
  return `<code class="inline-code">${escapeHtml(text)}</code>`;
};

// 链接（新窗口打开外部链接；过滤危险协议；文本先转义再内联解析防 XSS）
renderer.link = function(link: any): string {
  const { href, title, text } = link;
  const safeHref = sanitizeUrl(href);
  const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
  const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  const safeText = marked.parseInline(escapeHtml(text));
  return `<a href="${escapeHtml(safeHref)}"${titleAttr}${externalAttrs}>${safeText}</a>`;
};

// 图片（支持懒加载；过滤危险协议）
renderer.image = function(image: any): string {
  const { href, title, text } = image;
  const safeHref = sanitizeUrl(href);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  const alt = text || '';
  return `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" class="markdown-image">`;
};

// 标题（添加锚点；文本先转义再内联解析防 XSS，同时保留 **加粗** 等内联语法）
renderer.heading = function(heading: any): string {
  const { text, depth } = heading;
  const safeText = marked.parseInline(escapeHtml(text));
  const slug = generateHeadingSlug(text);
  const anchor = `<a class="heading-anchor" href="#${slug}" aria-hidden="true">#</a>`;
  return `<h${depth} id="${slug}">${safeText}${anchor}</h${depth}>`;
};

// 引用块（文本先转义再内联解析防 XSS）
renderer.blockquote = function(bq: any): string {
  const text = typeof bq === 'object' ? bq.text : bq;
  const safeText = marked.parseInline(escapeHtml(text));
  return `<blockquote class="markdown-quote">${safeText}</blockquote>`;
};

// 表格
renderer.table = function(table: any): string {
  const { header, body } = table;
  return `<div class="table-wrapper"><table class="markdown-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

// 应用自定义渲染器
marked.use({ renderer });

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return `<p>${escapeHtml(content)}</p>`;
  }
}

/**
 * 渲染 Markdown 摘要（纯文本，限制长度）
 */
export function renderExcerpt(content: string, maxLength: number = 200): string {
  // 移除 Markdown 语法
  const plainText = content
    .replace(/```[\s\S]*?```/g, '')           // 移除代码块
    .replace(/`[^`]+`/g, '')                  // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '')          // 移除图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 提取链接文本
    .replace(/#{1,6}\s+/g, '')                // 移除标题标记
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // 移除强调
    .replace(/>\s+/g, '')                     // 移除引用
    .replace(/[-*+]\s+/g, '')                 // 移除列表
    .replace(/\d+\.\s+/g, '')                 // 移除有序列表
    .replace(/\n+/g, ' ')                     // 换行转空格
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.slice(0, maxLength).trim() + '...';
}

/**
 * 提取目录结构
 */
export function extractToc(content: string): Array<{ level: number; text: string; slug: string }> {
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = generateHeadingSlug(text);
    headings.push({ level, text, slug });
  }

  return headings;
}

/**
 * 估计阅读时间（分钟）
 */
export function estimateReadTime(content: string): number {
  const wordCount = content.length;
  const wordsPerMinute = 400; // 中文阅读速度
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// 辅助函数
// 过滤危险 URL 协议（javascript: / data: / vbscript: 等），防止 Markdown 链接/图片注入
function sanitizeUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '#';
  }
  return trimmed;
}

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char]);
}

function generateHeadingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 导出代码高亮样式 CSS
export const highlightStyles = `
/* 代码块样式 */
.code-block {
  position: relative;
  margin: 1rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: #1e1e1e;
}

.code-lang {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  color: #888;
  background: rgba(255,255,255,0.1);
  border-bottom-right-radius: 0.25rem;
}

.copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: #888;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.copy-btn:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.code-block pre {
  margin: 0;
  padding: 2rem 1rem 1rem;
  overflow-x: auto;
}

.code-block code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* 行内代码 */
.inline-code {
  padding: 0.125rem 0.375rem;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.875em;
  background-color: rgba(110, 118, 129, 0.2);
  border-radius: 0.25rem;
}

/* 标题锚点 */
.heading-anchor {
  margin-left: 0.5rem;
  color: #60A5FA;
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.2s;
}

h1:hover .heading-anchor,
h2:hover .heading-anchor,
h3:hover .heading-anchor,
h4:hover .heading-anchor,
h5:hover .heading-anchor,
h6:hover .heading-anchor {
  opacity: 1;
}

/* 引用块 */
.markdown-quote {
  padding-left: 1rem;
  border-left: 4px solid #60A5FA;
  color: #9CA3AF;
  margin: 1rem 0;
}

/* 表格 */
.table-wrapper {
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-table {
  width: 100%;
  border-collapse: collapse;
}

.markdown-table th,
.markdown-table td {
  padding: 0.75rem;
  border: 1px solid #374151;
  text-align: left;
}

.markdown-table th {
  background-color: #1F2937;
  font-weight: 600;
}

/* 图片 */
.markdown-image {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}
`;