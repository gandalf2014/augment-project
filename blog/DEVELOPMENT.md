# 开发指南

本文档为开发者提供详细的开发指南和最佳实践。

## 🛠️ 开发环境设置

### 系统要求

- Node.js 18+ 
- npm 或 yarn
- Git

### 初始化开发环境

```bash
# 克隆项目
git clone <repository-url>
cd blog

# 安装依赖
npm install

# 初始化本地数据库
npm run db:init

# 启动开发服务器
npm run dev
```

访问 http://localhost:8787 查看应用。

## 📁 项目架构

### 目录结构说明

```
src/
├── index.ts              # 应用入口，注册路由和中间件
├── types/
│   └── database.ts       # TypeScript 类型定义
├── utils/
│   ├── router.ts         # 自定义路由系统
│   ├── auth.ts           # JWT 认证和密码哈希
│   ├── database.ts       # 数据库工具函数
│   └── templates.ts      # HTML 模板渲染
├── middleware/
│   └── index.ts          # 中间件集合
├── services/
│   ├── postService.ts    # 文章业务逻辑
│   ├── categoryService.ts # 分类业务逻辑
│   ├── tagService.ts     # 标签业务逻辑
│   ├── commentService.ts # 评论业务逻辑
│   ├── userService.ts    # 用户业务逻辑
│   └── settingService.ts # 设置业务逻辑
└── routes/
    ├── posts.ts          # 文章 API 路由
    ├── categories.ts     # 分类 API 路由
    ├── tags.ts           # 标签 API 路由
    ├── comments.ts       # 评论 API 路由
    ├── auth.ts           # 认证 API 路由
    ├── pages.ts          # 前端页面路由
    └── admin.ts          # 管理后台路由
```

### 架构设计原则

1. **分层架构**: 路由 → 服务 → 数据库
2. **单一职责**: 每个模块只负责一个功能
3. **依赖注入**: 服务层接收数据库实例
4. **类型安全**: 全面使用 TypeScript

## 🔧 核心组件

### 路由系统

自定义路由系统支持：
- 路径参数 (`/posts/:id`)
- 查询参数
- 中间件链
- HTTP 方法匹配

```typescript
// 注册路由
router.get('/api/posts/:id', async (request, env, ctx, params) => {
  const id = params!.id;
  // 处理逻辑
}, [authMiddleware]);
```

### 中间件系统

支持多个中间件链式调用：

```typescript
export const authMiddleware: Middleware = async (request, env, ctx, next) => {
  // 认证逻辑
  const user = await verifyToken(token);
  (request as any).user = user;
  return await next();
};
```

### 服务层

业务逻辑封装在服务类中：

```typescript
export class PostService {
  constructor(private db: D1Database) {}
  
  async getPosts(params: PostQueryParams): Promise<PaginatedResponse<Post>> {
    // 业务逻辑
  }
}
```

## 🗄️ 数据库操作

### 查询示例

```typescript
// 简单查询
const posts = await db.prepare('SELECT * FROM posts WHERE status = ?')
  .bind('published')
  .all<Post>();

// 复杂查询
const result = await db.prepare(`
  SELECT p.*, c.name as category_name, u.display_name as author_name
  FROM posts p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN users u ON p.author_id = u.id
  WHERE p.status = ? AND p.published_at <= ?
  ORDER BY p.published_at DESC
  LIMIT ? OFFSET ?
`).bind('published', new Date().toISOString(), limit, offset).all();
```

### 事务处理

```typescript
// D1 目前不支持显式事务，但可以为将来做准备
async function withTransaction<T>(
  db: D1Database,
  callback: (db: D1Database) => Promise<T>
): Promise<T> {
  return await callback(db);
}
```

## 🔐 认证系统

### JWT 实现

```typescript
// 生成 JWT
const token = await generateJWT(user, env.JWT_SECRET);

// 验证 JWT
const user = await verifyJWT(token, env.JWT_SECRET);
```

### 密码哈希

使用 PBKDF2 进行密码哈希：

```typescript
// 哈希密码
const hashedPassword = await hashPassword(plainPassword);

// 验证密码
const isValid = await verifyPassword(plainPassword, hashedPassword);
```

## 🎨 前端模板

### 模板系统

使用服务端渲染，模板函数返回 HTML 字符串：

```typescript
export function renderHomePage(
  posts: Post[], 
  categories: Category[], 
  settings: Record<string, any>
): string {
  return renderLayout({
    title: settings.site_title,
    content: `<div>...</div>`,
    settings
  });
}
```

### 样式系统

使用 Tailwind CSS CDN：
- 响应式设计
- 组件化样式
- 动画效果

## 🧪 测试

### 手动测试

```bash
# 启动开发服务器
npm run dev

# 测试 API
curl http://localhost:8787/api/posts
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### 数据库测试

```bash
# 查看数据
npx wrangler d1 execute blog-db --local --command "SELECT * FROM posts"

# 重置数据库
npm run db:reset
```

## 📝 开发最佳实践

### 代码规范

1. **命名约定**:
   - 文件名: kebab-case (`post-service.ts`)
   - 类名: PascalCase (`PostService`)
   - 函数名: camelCase (`getPosts`)
   - 常量: UPPER_SNAKE_CASE (`JWT_SECRET`)

2. **类型定义**:
   - 所有 API 参数和响应都要有类型定义
   - 使用接口而不是类型别名
   - 导出所有公共类型

3. **错误处理**:
   ```typescript
   try {
     const result = await someOperation();
     return jsonResponse({ success: true, data: result });
   } catch (error) {
     console.error('Operation failed:', error);
     return jsonResponse({ success: false, error: 'Operation failed' }, 500);
   }
   ```

### 性能优化

1. **数据库查询**:
   - 使用索引
   - 避免 N+1 查询
   - 合理使用分页

2. **缓存策略**:
   - 静态资源缓存
   - API 响应缓存
   - 数据库查询缓存

3. **代码分割**:
   - 按功能模块分割
   - 懒加载非关键代码

### 安全考虑

1. **输入验证**:
   ```typescript
   if (!data.title || !data.content) {
     return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
   }
   ```

2. **SQL 注入防护**:
   ```typescript
   // 使用参数绑定
   const result = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
   ```

3. **XSS 防护**:
   ```typescript
   function escapeHtml(text: string): string {
     return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
   }
   ```

## 🔄 开发工作流

### 功能开发流程

1. **创建分支**:
   ```bash
   git checkout -b feature/new-feature
   ```

2. **开发功能**:
   - 更新类型定义
   - 实现服务层逻辑
   - 添加路由处理
   - 更新前端模板

3. **测试功能**:
   ```bash
   npm run dev
   # 手动测试功能
   ```

4. **提交代码**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

### 数据库迁移

1. **修改 schema.sql**
2. **更新类型定义**
3. **测试迁移**:
   ```bash
   npm run db:reset
   npm run db:init
   ```

## 🐛 调试技巧

### 日志调试

```typescript
console.log('Debug info:', { user, params, data });
console.error('Error occurred:', error);
```

### 数据库调试

```bash
# 查看表结构
npx wrangler d1 execute blog-db --local --command ".schema posts"

# 查看数据
npx wrangler d1 execute blog-db --local --command "SELECT * FROM posts LIMIT 5"
```

### 网络调试

使用浏览器开发者工具或 curl：

```bash
# 查看响应头
curl -I http://localhost:8787/api/posts

# 查看完整响应
curl -v http://localhost:8787/api/posts
```

## 📚 扩展开发

### 添加新功能

1. **定义类型** (`types/database.ts`)
2. **创建服务** (`services/newService.ts`)
3. **添加路由** (`routes/new.ts`)
4. **注册路由** (`index.ts`)
5. **更新模板** (`utils/templates.ts`)

### 自定义中间件

```typescript
export const customMiddleware: Middleware = async (request, env, ctx, next) => {
  // 前置处理
  const response = await next();
  // 后置处理
  return response;
};
```

### 扩展模板系统

```typescript
export function renderCustomPage(data: any, settings: any): string {
  const content = `
    <div class="custom-page">
      <!-- 自定义内容 -->
    </div>
  `;
  
  return renderLayout({
    title: 'Custom Page',
    content,
    settings
  });
}
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

### 提交信息规范

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式化
- `refactor:` 代码重构
- `test:` 添加测试
- `chore:` 构建过程或辅助工具的变动
