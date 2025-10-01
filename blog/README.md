# 个人博客系统

基于 Cloudflare Workers + D1 数据库构建的现代化个人博客系统。

## ✨ 特性

- 🚀 **无服务器架构** - 基于 Cloudflare Workers，全球边缘部署
- 💾 **D1 数据库** - 使用 Cloudflare D1 SQLite 数据库
- 🎨 **现代化界面** - 使用 Tailwind CSS，响应式设计
- 📝 **完整的博客功能** - 文章管理、分类标签、评论系统
- 🔐 **用户认证** - JWT 认证，角色权限管理
- 🔍 **搜索功能** - 全文搜索，分页导航
- 📱 **移动端优化** - 完全响应式，移动端友好
- ⚡ **高性能** - 边缘计算，极快的加载速度

## 🏗️ 技术栈

- **后端**: Cloudflare Workers + TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: 服务端渲染 + Tailwind CSS
- **认证**: JWT + PBKDF2 密码哈希
- **部署**: Cloudflare Workers

## 📦 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd blog
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

```bash
npm run db:init
```

这个命令会：
- 创建 D1 数据库
- 执行数据库迁移
- 插入初始化数据
- 更新 wrangler.jsonc 配置

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:8787 查看博客。

### 5. 管理后台

访问 http://localhost:8787/admin 进入管理后台。

默认管理员账号：
- 邮箱: admin@example.com
- 密码: password

⚠️ **重要**: 请在生产环境中修改默认密码！

## 📚 API 文档

### 认证 API

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password"
}
```

#### 获取当前用户信息
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 文章 API

#### 获取文章列表
```http
GET /api/posts?page=1&limit=10&category=tech&tag=javascript&search=关键词
```

#### 获取单篇文章
```http
GET /api/posts/1
GET /api/posts/slug/article-slug
```

#### 创建文章 (需要认证)
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "文章标题",
  "content": "文章内容",
  "excerpt": "文章摘要",
  "category_id": 1,
  "tag_ids": [1, 2, 3],
  "status": "published"
}
```

### 评论 API

#### 获取文章评论
```http
GET /api/posts/1/comments
```

#### 提交评论
```http
POST /api/posts/1/comments
Content-Type: application/json

{
  "author_name": "评论者",
  "author_email": "email@example.com",
  "content": "评论内容"
}
```

## 🗂️ 项目结构

```
blog/
├── src/
│   ├── index.ts              # 主入口文件
│   ├── types/
│   │   └── database.ts       # 数据库类型定义
│   ├── utils/
│   │   ├── router.ts         # 路由系统
│   │   ├── auth.ts           # 认证工具
│   │   ├── database.ts       # 数据库工具
│   │   └── templates.ts      # HTML 模板
│   ├── middleware/
│   │   └── index.ts          # 中间件
│   ├── services/
│   │   ├── postService.ts    # 文章服务
│   │   ├── categoryService.ts # 分类服务
│   │   ├── tagService.ts     # 标签服务
│   │   ├── commentService.ts # 评论服务
│   │   ├── userService.ts    # 用户服务
│   │   └── settingService.ts # 设置服务
│   └── routes/
│       ├── posts.ts          # 文章路由
│       ├── categories.ts     # 分类路由
│       ├── tags.ts           # 标签路由
│       ├── comments.ts       # 评论路由
│       ├── auth.ts           # 认证路由
│       ├── pages.ts          # 前端页面路由
│       └── admin.ts          # 管理后台路由
├── database/
│   ├── schema.sql            # 数据库结构
│   └── seed.sql              # 初始化数据
├── scripts/
│   ├── init-db.js            # 数据库初始化脚本
│   └── hash-password.js      # 密码哈希工具
├── wrangler.jsonc            # Cloudflare Workers 配置
└── package.json
```

## 🚀 部署

### 1. 配置 Cloudflare

确保你有 Cloudflare 账号并安装了 Wrangler CLI。

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建生产数据库

```bash
npx wrangler d1 create blog-db-prod
```

更新 wrangler.jsonc 中的生产数据库 ID。

### 4. 执行生产数据库迁移

```bash
npx wrangler d1 execute blog-db-prod --file=database/schema.sql
npx wrangler d1 execute blog-db-prod --file=database/seed.sql
```

### 5. 设置环境变量

```bash
npx wrangler secret put JWT_SECRET
```

输入一个强密码作为 JWT 密钥。

### 6. 部署

```bash
npm run deploy
```

## 🔧 配置

### 环境变量

- `JWT_SECRET`: JWT 签名密钥（必需）

### 数据库配置

在 `wrangler.jsonc` 中配置 D1 数据库：

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog-db",
      "database_id": "your-database-id"
    }
  ]
}
```

## 📝 使用说明

### 管理后台功能

1. **文章管理** - 创建、编辑、删除文章
2. **分类管理** - 管理文章分类
3. **标签管理** - 管理文章标签
4. **评论管理** - 审核、删除评论
5. **用户管理** - 管理用户账号（仅管理员）

### 前台功能

1. **文章浏览** - 按分类、标签浏览文章
2. **搜索功能** - 全文搜索文章
3. **评论系统** - 发表和查看评论
4. **响应式设计** - 支持各种设备

## 🛠️ 开发

### 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run deploy` - 部署到 Cloudflare Workers
- `npm run db:init` - 初始化数据库
- `npm run db:migrate` - 执行数据库迁移
- `npm run db:seed` - 插入初始化数据
- `npm run db:reset` - 重置数据库

### 数据库操作

```bash
# 查看数据库
npx wrangler d1 execute blog-db --local --command "SELECT * FROM posts"

# 执行 SQL 文件
npx wrangler d1 execute blog-db --local --file=database/schema.sql
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Tailwind CSS](https://tailwindcss.com/)
