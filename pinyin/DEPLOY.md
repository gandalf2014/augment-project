# 飞书机器人 Cloudflare Workers 部署指南

## 特点

- ✅ 免费部署（Cloudflare Workers 免费额度足够个人使用）
- ✅ 无需维护服务器
- ✅ 全球 CDN 加速，响应速度快
- ✅ 支持 AI 集成（OpenAI、Claude 等）

## 部署步骤

### 1. 准备飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/app)
2. 创建「企业自建应用」
3. 添加「机器人」能力
4. 记录以下信息：
   - **App ID**（在「凭证与基础信息」页面）
   - **App Secret**（在「凭证与基础信息」页面）
   - **Encrypt Key**（在「事件与回调」页面，如果启用了加密）

### 2. 部署到 Cloudflare Workers

#### 方式一：使用 Cloudflare Dashboard（推荐新手）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单「Workers & Pages」
3. 点击「创建服务」
4. 服务名称：随意填写（如 `feishu-bot`）
5. 点击「部署」
6. 点击「编辑代码」
7. **删除默认代码**，将 `feishu_bot_worker.js` 的内容**完整复制**进去
8. 点击「保存并部署」
9. 记录 Workers URL（如 `https://feishu-bot.xxx.workers.dev`）

#### 方式二：使用 Wrangler CLI（适合开发者）

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建项目
mkdir feishu-bot && cd feishu-bot

# 复制代码到 index.js
cp ../feishu_bot_worker.js index.js

# 部署
wrangler deploy
```

### 3. 配置环境变量

在 Cloudflare Workers 页面：

1. 点击你的 Workers 服务
2. 点击「设置」标签页
3. 点击「变量和机密」
4. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `APP_ID` | cli_xxxxxx | 飞书 App ID |
| `APP_SECRET` | xxxxxx | 飞书 App Secret |
| `ENCRYPT_KEY` | xxxxxx | 飞书加密密钥（可选） |
| `OPENAI_API_KEY` | sk-xxx | OpenAI API 密钥（可选） |
| `CLAUDE_API_KEY` | xxx | Claude API 密钥（可选） |

**注意**：`OPENAI_API_KEY` 和 `CLAUDE_API_KEY` 至少配置一个，否则只能回复固定内容。

### 4. 配置飞书事件订阅

1. 在飞书开放平台，进入你的应用
2. 点击「事件与回调」
3. 选择订阅方式：「将事件发送至开发者服务器」
4. **请求地址**：填入你的 Workers URL + `/`
   - 例如：`https://feishu-bot.xxx.workers.dev/`
5. 点击「保存」，验证应该能通过
6. 点击「添加事件」→ 搜索并添加「接收消息」事件
7. 在「权限管理」页面，添加以下权限：
   - `im:chat:readonly`
   - `im:message.group_msg`
   - `im:message:send`

### 5. 发布应用

1. 点击「版本管理与发布」
2. 点击「创建版本」
3. 填写版本号（如 1.0.0）和更新说明
4. 设置可用范围
5. 点击「保存并发布」

### 6. 测试机器人

1. 在飞书搜索你的机器人名称
2. 添加机器人到群组，或直接与机器人单聊
3. 发送消息测试

## 自定义 AI 逻辑

如果你想使用其他 AI 服务，修改 `processAIRequest` 函数：

```javascript
async function processAIRequest(userText, env) {
  // 示例：调用你自己的 API
  const response = await fetch('https://your-api.com/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText })
  });
  
  const data = await response.json();
  return data.reply;
}
```

## 常见问题

### 1. 验证回调地址失败

- 检查 Workers URL 是否正确（注意末尾的 `/`）
- 检查 `APP_ID` 和 `APP_SECRET` 是否正确
- 查看 Workers 日志排查错误

### 2. 收不到消息

- 确认已添加「接收消息」事件
- 确认已开通相关权限
- 确认应用已发布
- 确认机器人已被添加到群组

### 3. AI 回复失败

- 检查 `OPENAI_API_KEY` 或 `CLAUDE_API_KEY` 是否正确
- 查看 Workers 日志中的错误信息
- 确认 API Key 有余额

## 查看日志

在 Cloudflare Dashboard：
1. 进入 Workers 服务
2. 点击「日志」标签页
3. 可以实时查看请求日志和错误信息

## 费用说明

Cloudflare Workers 免费版包含：
- 每天 100,000 次请求
- 每次请求最多 50ms CPU 时间

对于普通使用的飞书机器人完全够用。如果超出免费额度，按使用量付费，价格很低。

## 安全建议

1. **不要**将 API 密钥直接写在代码中
2. 使用环境变量存储敏感信息
3. 在飞书后台启用加密策略（设置 Encrypt Key）
4. 定期轮换 App Secret

## 技术支持

如有问题，可以：
- 查看 [飞书开放平台文档](https://open.feishu.cn/document)
- 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
