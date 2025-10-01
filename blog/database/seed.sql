-- 博客初始化数据
-- 创建时间: 2025-07-25

-- 插入默认管理员用户
INSERT OR IGNORE INTO users (username, email, password_hash, display_name, bio, role) VALUES 
('gandalf', 'jiayouilin@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '博客管理员', '欢迎来到我的个人博客！', 'admin');

-- 插入默认分类
INSERT OR IGNORE INTO categories (name, slug, description, color, sort_order) VALUES 
('技术分享', 'tech', '分享技术相关的文章和心得', '#3B82F6', 1),
('生活随笔', 'life', '记录生活中的点点滴滴', '#10B981', 2),
('学习笔记', 'study', '学习过程中的笔记和总结', '#F59E0B', 3),
('项目展示', 'projects', '个人项目的展示和介绍', '#EF4444', 4);

-- 插入默认标签
INSERT OR IGNORE INTO tags (name, slug, description, color) VALUES 
('JavaScript', 'javascript', 'JavaScript 相关内容', '#F7DF1E'),
('TypeScript', 'typescript', 'TypeScript 相关内容', '#3178C6'),
('React', 'react', 'React 框架相关', '#61DAFB'),
('Node.js', 'nodejs', 'Node.js 后端开发', '#339933'),
('CSS', 'css', 'CSS 样式和布局', '#1572B6'),
('HTML', 'html', 'HTML 标记语言', '#E34F26'),
('Vue.js', 'vuejs', 'Vue.js 框架相关', '#4FC08D'),
('Python', 'python', 'Python 编程语言', '#3776AB'),
('数据库', 'database', '数据库相关技术', '#336791'),
('算法', 'algorithm', '算法和数据结构', '#FF6B6B'),
('前端', 'frontend', '前端开发技术', '#61DAFB'),
('后端', 'backend', '后端开发技术', '#68217A'),
('全栈', 'fullstack', '全栈开发', '#FF6B35'),
('开源', 'opensource', '开源项目和贡献', '#28A745'),
('教程', 'tutorial', '技术教程和指南', '#17A2B8');

-- 插入示例文章
INSERT OR IGNORE INTO posts (title, slug, excerpt, content, category_id, author_id, status, is_featured, published_at) VALUES 
(
    '欢迎来到我的博客',
    'welcome-to-my-blog',
    '这是我的第一篇博客文章，欢迎大家来到我的个人博客！',
    '# 欢迎来到我的博客

欢迎来到我的个人博客！这里我会分享一些技术文章、生活感悟和学习笔记。

## 关于这个博客

这个博客是使用 Cloudflare Workers 和 D1 数据库构建的，具有以下特点：

- 🚀 基于 Cloudflare Workers 的无服务器架构
- 💾 使用 D1 数据库存储数据
- 🎨 简洁美观的界面设计
- 📱 完全响应式设计
- 🔍 支持文章搜索
- 💬 支持评论系统
- 🏷️ 支持分类和标签

## 技术栈

- **后端**: Cloudflare Workers + TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: 服务端渲染 + Tailwind CSS
- **部署**: Cloudflare Workers

希望你能在这里找到有用的内容！

如果你有任何问题或建议，欢迎在评论区留言。',
    2,
    1,
    'published',
    1,
    CURRENT_TIMESTAMP
),
(
    'Cloudflare Workers 入门指南',
    'cloudflare-workers-guide',
    '详细介绍如何使用 Cloudflare Workers 构建现代 Web 应用',
    '# Cloudflare Workers 入门指南

Cloudflare Workers 是一个强大的无服务器平台，让你可以在全球边缘网络上运行 JavaScript 代码。

## 什么是 Cloudflare Workers？

Cloudflare Workers 基于 V8 JavaScript 引擎，提供了一个轻量级的运行时环境。它具有以下优势：

- ⚡ 极快的冷启动时间
- 🌍 全球边缘网络部署
- 💰 按使用量付费
- 🔧 丰富的 API 支持

## 基本用法

```javascript
export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  },
};
```

## 与 D1 数据库集成

```javascript
export default {
  async fetch(request, env, ctx) {
    const result = await env.DB.prepare("SELECT * FROM posts").all();
    return Response.json(result);
  },
};
```

这只是一个简单的介绍，更多内容请关注后续文章！',
    1,
    1,
    'published',
    0,
    CURRENT_TIMESTAMP
);

-- 为示例文章添加标签
INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES 
(1, 14), -- 欢迎文章 + 开源
(1, 13), -- 欢迎文章 + 全栈
(2, 1),  -- Workers指南 + JavaScript
(2, 2),  -- Workers指南 + TypeScript
(2, 9),  -- Workers指南 + 数据库
(2, 12), -- Workers指南 + 后端
(2, 15); -- Workers指南 + 教程

-- 插入示例评论
INSERT OR IGNORE INTO comments (post_id, author_name, author_email, content, status) VALUES 
(1, '张三', 'zhangsan@example.com', '欢迎开通博客！期待更多精彩内容。', 'approved'),
(1, '李四', 'lisi@example.com', '界面很简洁，喜欢这种风格！', 'approved'),
(2, '王五', 'wangwu@example.com', 'Cloudflare Workers 确实很强大，感谢分享！', 'approved');

-- 插入博客基本设置
INSERT OR IGNORE INTO settings (key, value, type, description) VALUES 
('site_title', '我的个人博客', 'string', '网站标题'),
('site_description', '分享技术、记录生活的个人博客', 'string', '网站描述'),
('site_keywords', '博客,技术,编程,生活', 'string', '网站关键词'),
('site_author', '博客管理员', 'string', '网站作者'),
('posts_per_page', '10', 'number', '每页文章数量'),
('allow_comments', 'true', 'boolean', '是否允许评论'),
('comment_moderation', 'true', 'boolean', '评论是否需要审核'),
('site_logo', '', 'string', '网站Logo URL'),
('site_favicon', '', 'string', '网站Favicon URL'),
('analytics_code', '', 'string', '统计代码'),
('social_github', '', 'string', 'GitHub 链接'),
('social_twitter', '', 'string', 'Twitter 链接'),
('social_email', 'admin@example.com', 'string', '联系邮箱');

-- 插入示例页面
INSERT OR IGNORE INTO pages (title, slug, content, meta_description, sort_order) VALUES 
(
    '关于我',
    'about',
    '# 关于我

你好！我是这个博客的作者。

## 个人简介

我是一名热爱技术的开发者，专注于 Web 开发和云计算技术。

## 技能栈

- **前端**: HTML, CSS, JavaScript, TypeScript, React, Vue.js
- **后端**: Node.js, Python, Go
- **数据库**: MySQL, PostgreSQL, MongoDB, SQLite
- **云服务**: Cloudflare, AWS, Vercel

## 联系方式

- 📧 Email: admin@example.com
- 🐙 GitHub: [github.com/username](https://github.com/username)
- 🐦 Twitter: [@username](https://twitter.com/username)

欢迎与我交流技术话题！',
    '了解博客作者的个人信息和技术背景',
    1
);
