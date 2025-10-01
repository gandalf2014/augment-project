# API 文档

本文档描述了博客系统的所有 API 接口。

## 🔐 认证

大部分 API 需要 JWT 认证。在请求头中包含：

```
Authorization: Bearer <your-jwt-token>
```

## 📝 响应格式

所有 API 响应都使用统一的 JSON 格式：

### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 分页响应
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🔑 认证 API

### 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "display_name": "管理员",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 获取当前用户信息

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 更新用户资料

```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "新的显示名称",
  "bio": "个人简介"
}
```

### 修改密码

```http
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "旧密码",
  "newPassword": "新密码"
}
```

## 📄 文章 API

### 获取文章列表

```http
GET /api/posts?page=1&limit=10&category=tech&tag=javascript&search=关键词&status=published
```

**查询参数:**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 10, 最大: 50)
- `category`: 分类 slug
- `tag`: 标签 slug
- `search`: 搜索关键词
- `status`: 文章状态 (published/draft/archived)
- `featured`: 是否精选 (true/false)
- `author`: 作者 ID

### 获取单篇文章

```http
GET /api/posts/:id
GET /api/posts/slug/:slug
```

### 创建文章

```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "文章标题",
  "slug": "article-slug",
  "content": "文章内容 (Markdown)",
  "excerpt": "文章摘要",
  "featured_image": "https://example.com/image.jpg",
  "category_id": 1,
  "tag_ids": [1, 2, 3],
  "status": "published",
  "is_featured": false,
  "published_at": "2024-01-01T00:00:00Z"
}
```

### 更新文章

```http
PUT /api/posts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新的标题",
  "content": "更新的内容"
}
```

### 删除文章

```http
DELETE /api/posts/:id
Authorization: Bearer <token>
```

### 管理员文章列表

```http
GET /api/admin/posts?page=1&limit=20&status=draft
Authorization: Bearer <token>
```

### 批量操作文章

```http
PATCH /api/admin/posts/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": [1, 2, 3],
  "action": "publish" // publish/draft/archive/delete
}
```

## 🏷️ 分类 API

### 获取分类列表

```http
GET /api/categories?include_inactive=false
```

### 获取单个分类

```http
GET /api/categories/:id
GET /api/categories/slug/:slug
```

### 创建分类

```http
POST /api/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "分类名称",
  "slug": "category-slug",
  "description": "分类描述",
  "color": "#3B82F6",
  "sort_order": 1
}
```

### 更新分类

```http
PUT /api/categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新的名称",
  "description": "更新的描述"
}
```

### 删除分类

```http
DELETE /api/categories/:id
Authorization: Bearer <token>
```

### 切换分类状态

```http
PATCH /api/categories/:id/toggle
Authorization: Bearer <token>
```

### 重新排序分类

```http
PATCH /api/categories/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryIds": [3, 1, 2]
}
```

## 🔖 标签 API

### 获取标签列表

```http
GET /api/tags?limit=50&min_usage=1
```

### 搜索标签

```http
GET /api/tags/search?q=javascript&limit=10
```

### 获取热门标签

```http
GET /api/tags/popular?limit=20
```

### 获取单个标签

```http
GET /api/tags/:id
GET /api/tags/slug/:slug
```

### 获取相关标签

```http
GET /api/tags/:id/related?limit=10
```

### 创建标签

```http
POST /api/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "标签名称",
  "slug": "tag-slug",
  "description": "标签描述",
  "color": "#10B981"
}
```

### 批量创建标签

```http
POST /api/tags/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "names": ["JavaScript", "TypeScript", "React"]
}
```

### 更新标签

```http
PUT /api/tags/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新的名称"
}
```

### 删除标签

```http
DELETE /api/tags/:id
Authorization: Bearer <token>
```

### 合并标签

```http
POST /api/tags/:sourceId/merge
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetId": 2
}
```

## 💬 评论 API

### 获取文章评论

```http
GET /api/posts/:postId/comments
```

### 提交评论

```http
POST /api/posts/:postId/comments
Content-Type: application/json

{
  "author_name": "评论者姓名",
  "author_email": "email@example.com",
  "author_website": "https://example.com",
  "content": "评论内容",
  "parent_id": 1
}
```

### 管理员评论列表

```http
GET /api/admin/comments?page=1&limit=20&status=pending&post_id=1
Authorization: Bearer <token>
```

### 更新评论状态

```http
PATCH /api/admin/comments/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "approved" // pending/approved/rejected/spam
}
```

### 批量更新评论状态

```http
PATCH /api/admin/comments/batch/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": [1, 2, 3],
  "status": "approved"
}
```

### 删除评论

```http
DELETE /api/admin/comments/:id
Authorization: Bearer <token>
```

### 批量删除评论

```http
DELETE /api/admin/comments/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

## 👥 用户管理 API (仅管理员)

### 获取用户列表

```http
GET /api/admin/users?include_inactive=false
Authorization: Bearer <token>
```

### 创建用户

```http
POST /api/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "display_name": "新用户",
  "role": "editor"
}
```

### 更新用户

```http
PUT /api/admin/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "更新的名称",
  "role": "admin"
}
```

### 重置用户密码

```http
PUT /api/admin/users/:id/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

### 切换用户状态

```http
PATCH /api/admin/users/:id/toggle
Authorization: Bearer <token>
```

### 删除用户

```http
DELETE /api/admin/users/:id
Authorization: Bearer <token>
```

## 📊 统计 API

### 分类统计

```http
GET /api/admin/categories/stats
Authorization: Bearer <token>
```

### 标签统计

```http
GET /api/admin/tags/stats
Authorization: Bearer <token>
```

### 评论统计

```http
GET /api/admin/comments/stats
Authorization: Bearer <token>
```

### 用户统计

```http
GET /api/admin/users/stats
Authorization: Bearer <token>
```

## 🔧 工具 API

### 清理未使用标签

```http
DELETE /api/admin/tags/cleanup
Authorization: Bearer <token>
```

### 获取最新评论

```http
GET /api/admin/comments/recent?limit=10&status=approved
Authorization: Bearer <token>
```

### 获取用户评论历史

```http
GET /api/admin/comments/user/:email?limit=20
Authorization: Bearer <token>
```

## ❌ 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 📝 注意事项

1. **认证令牌**: JWT 令牌默认有效期为 24 小时
2. **请求限制**: 单次请求最大数据量限制为 50 条
3. **文件上传**: 目前不支持文件上传，图片需使用外部链接
4. **内容格式**: 文章内容支持 Markdown 格式
5. **权限控制**: 
   - `admin` 角色可以管理所有内容
   - `editor` 角色只能管理自己的文章
