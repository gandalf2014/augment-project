# 部署指南

本文档详细介绍如何将博客系统部署到 Cloudflare Workers。

## 📋 部署前准备

### 1. 账号要求

- Cloudflare 账号（免费版即可）
- 已验证的域名（可选，用于自定义域名）

### 2. 工具安装

确保已安装以下工具：

```bash
# Node.js (推荐 18+)
node --version

# npm
npm --version

# Wrangler CLI
npm install -g wrangler
```

## 🚀 部署步骤

### 步骤 1: 克隆和安装

```bash
# 克隆项目
git clone <your-repository-url>
cd blog

# 安装依赖
npm install
```

### 步骤 2: 登录 Cloudflare

```bash
# 登录 Cloudflare 账号
npx wrangler login
```

这会打开浏览器，按提示完成登录。

### 步骤 3: 创建生产数据库

```bash
# 创建生产环境的 D1 数据库
npx wrangler d1 create blog-db-production
```

记录输出的数据库 ID，类似：
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 步骤 4: 更新配置

编辑 `wrangler.jsonc`，更新数据库配置：

```json
{
  "name": "blog",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog-db-production",
      "database_id": "你的数据库ID"
    }
  ]
}
```

### 步骤 5: 初始化生产数据库

```bash
# 执行数据库结构迁移
npx wrangler d1 execute blog-db-production --file=database/schema.sql

# 插入初始化数据
npx wrangler d1 execute blog-db-production --file=database/seed.sql
```

### 步骤 6: 设置环境变量

```bash
# 设置 JWT 密钥
npx wrangler secret put JWT_SECRET
```

输入一个强密码，例如：`your-super-secret-jwt-key-here-make-it-long-and-random`

### 步骤 7: 部署应用

```bash
# 部署到 Cloudflare Workers
npm run deploy
```

部署成功后，你会看到类似输出：
```
Published blog (1.23s)
  https://blog.your-subdomain.workers.dev
```

## 🔧 生产环境配置

### 自定义域名

1. 在 Cloudflare Dashboard 中添加你的域名
2. 在 Workers 页面绑定自定义域名：
   ```bash
   npx wrangler custom-domains add your-domain.com
   ```

### 环境变量管理

查看已设置的密钥：
```bash
npx wrangler secret list
```

更新密钥：
```bash
npx wrangler secret put JWT_SECRET
```

删除密钥：
```bash
npx wrangler secret delete JWT_SECRET
```

### 数据库管理

查看生产数据库：
```bash
npx wrangler d1 execute blog-db-production --command "SELECT COUNT(*) FROM posts"
```

备份数据库：
```bash
npx wrangler d1 export blog-db-production --output backup.sql
```

## 📊 监控和维护

### 查看日志

```bash
# 实时查看日志
npx wrangler tail

# 查看特定时间段的日志
npx wrangler tail --since 1h
```

### 性能监控

在 Cloudflare Dashboard 中可以查看：
- 请求数量和响应时间
- 错误率
- 带宽使用情况
- 缓存命中率

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
npm run deploy
```

## 🔒 安全配置

### 1. 修改默认密码

部署后立即登录管理后台修改默认密码：

1. 访问 `https://your-domain.com/admin/login`
2. 使用默认账号登录：
   - 邮箱: admin@example.com
   - 密码: password
3. 进入用户管理，修改密码

### 2. JWT 密钥安全

- 使用强随机密钥
- 定期轮换密钥
- 不要在代码中硬编码密钥

### 3. 数据库安全

- 定期备份数据库
- 监控异常访问
- 限制管理员账号数量

## 🚨 故障排除

### 常见问题

#### 1. 部署失败

```bash
# 检查配置
npx wrangler whoami
npx wrangler d1 list

# 重新登录
npx wrangler logout
npx wrangler login
```

#### 2. 数据库连接失败

检查 `wrangler.jsonc` 中的数据库 ID 是否正确：
```bash
npx wrangler d1 list
```

#### 3. 环境变量问题

```bash
# 检查密钥是否设置
npx wrangler secret list

# 重新设置
npx wrangler secret put JWT_SECRET
```

#### 4. 404 错误

确保路由配置正确，检查 `src/index.ts` 中的路由注册顺序。

### 调试技巧

1. **本地测试**：
   ```bash
   npm run dev
   ```

2. **查看实时日志**：
   ```bash
   npx wrangler tail
   ```

3. **数据库查询**：
   ```bash
   npx wrangler d1 execute blog-db-production --command "SELECT * FROM users LIMIT 5"
   ```

## 📈 性能优化

### 1. 缓存策略

- 静态资源使用 CDN 缓存
- API 响应适当设置缓存头
- 数据库查询结果缓存

### 2. 数据库优化

- 为常用查询添加索引
- 定期清理无用数据
- 优化查询语句

### 3. 代码优化

- 减少不必要的数据库查询
- 使用分页避免大量数据传输
- 压缩响应内容

## 🔄 CI/CD 集成

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

需要在 GitHub 仓库设置中添加 `CLOUDFLARE_API_TOKEN` 密钥。

## 📞 支持

如果遇到问题：

1. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 检查项目的 Issues 页面
3. 查看 Cloudflare Dashboard 中的错误日志

## 🎉 部署完成

恭喜！你的博客系统现在已经成功部署到 Cloudflare Workers。

访问你的博客地址，开始使用吧！
