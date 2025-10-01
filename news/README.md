# 🚀 新闻重写系统

一个专业的科技新闻自动获取和重写系统，将IT和AI领域的新闻转换为吸引人的自媒体内容。

## ✨ 功能特点

- 🔄 **多源新闻获取**: 支持NewsAPI、HackerNews、RSS源
- ✍️ **智能内容重写**: 自动重写为自媒体风格的markdown文章
- 🖼️ **图片建议**: 为每篇文章生成详细的图片描述
- 🏷️ **自动标签**: 智能提取关键词和分类标签
- 📊 **质量过滤**: 自动过滤低质量内容
- 🎨 **美观输出**: Rich库提供的精美命令行界面

## 🛠️ 安装配置

### 1. 克隆项目
```bash
git clone <repository-url>
cd news
```

### 2. 安装依赖
```bash
pip install -r requirements.txt
```

### 3. 配置API密钥
复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的API密钥：
```env
NEWSAPI_KEY=your_newsapi_key_here
OPENAI_API_KEY=your_openai_key_here  # 可选，用于高级内容重写
```

### 4. 获取API密钥

#### NewsAPI (免费)
1. 访问 [NewsAPI.org](https://newsapi.org/)
2. 注册账号并获取免费API密钥
3. 免费版每天100次请求

#### OpenAI API (可选)
1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 创建API密钥
3. 用于更高质量的内容重写

## 🚀 使用方法

### 基本使用
```bash
cd src
python main.py
```

### 高级选项
```bash
# 获取3篇AI相关新闻
python main.py -n 3 -t AI

# 获取10篇科技新闻
python main.py --max-articles 10

# 指定主题过滤
python main.py -t "人工智能" -n 5
```

### 命令行参数
- `-n, --max-articles`: 最大文章数量 (默认: 5)
- `-t, --topic`: 主题过滤关键词
- `-c, --config`: 配置文件路径 (默认: config/config.yaml)

## 📁 项目结构

```
news/
├── src/                    # 源代码
│   ├── main.py            # 主程序入口
│   ├── news_fetcher.py    # 新闻获取模块
│   └── content_rewriter.py # 内容重写模块
├── config/                # 配置文件
│   └── config.yaml        # 主配置文件
├── output/                # 输出目录
├── requirements.txt       # Python依赖
├── .env.example          # 环境变量模板
└── README.md             # 说明文档
```

## ⚙️ 配置说明

### 新闻源配置
在 `config/config.yaml` 中可以配置：

- **NewsAPI**: 主流科技新闻
- **HackerNews**: 深度技术讨论
- **RSS源**: TechCrunch、MIT Technology Review等

### 内容过滤
支持关键词包含/排除过滤：
```yaml
filters:
  keywords_include:
    - "AI"
    - "人工智能"
    - "机器学习"
  keywords_exclude:
    - "广告"
    - "推广"
```

## 📝 输出格式

每篇重写后的文章包含：

1. **吸引人的标题** (带emoji)
2. **封面图建议**
3. **引言Hook** (快速抓住读者)
4. **核心内容** (重新组织的新闻内容)
5. **深度分析** (个人观点和行业洞察)
6. **未来展望** (总结和思考)
7. **相关标签** (自动生成)
8. **图片建议** (3-5张配图描述)

### 示例输出
```markdown
# 🚀 AI再次突破！OpenAI最新GPT技术震撼发布

![封面图：科技新闻配图](cover_image_placeholder)

人工智能领域又有重大突破！OpenAI最新发布的技术让整个行业为之震动...

## 📰 事件回顾
...

## 🔍 深度分析
...

## 🚀 未来展望
...

---
**标签：** #AI #OpenAI #人工智能 #科技
**原文来源：** [NewsAPI - TechCrunch](原文链接)
```

## 🔧 自定义配置

### 添加新的RSS源
```yaml
rss_feeds:
  - name: "Your Tech Blog"
    url: "https://yourblog.com/feed/"
```

### 修改重写风格
```yaml
rewriter:
  style: "自媒体"
  tone: "专业但通俗"
  target_reading_time: "3-5分钟"
```

## 🐛 故障排除

### 常见问题

1. **API密钥错误**
   - 检查 `.env` 文件中的密钥是否正确
   - 确认API密钥有效且未过期

2. **网络连接问题**
   - 检查网络连接
   - 某些API可能需要代理

3. **依赖安装失败**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **编码问题**
   - 确保系统支持UTF-8编码
   - Windows用户可能需要设置环境变量

## 📈 扩展功能

### 计划中的功能
- [ ] 支持更多新闻源
- [ ] 图片自动生成集成
- [ ] 多语言支持
- [ ] Web界面
- [ ] 定时任务
- [ ] 内容质量评分

### 贡献指南
欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🤝 支持

如有问题，请：
1. 查看本README文档
2. 检查Issue列表
3. 提交新的Issue

---

**享受自动化的新闻重写体验！** 🎉
