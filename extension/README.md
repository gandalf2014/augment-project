# Memo 浏览器扩展

一键保存网页内容到 Memo 应用。

## 功能

- ⚡ **快捷键快速记录** - `Ctrl+Shift+M` 打开快速记录窗口
- 📋 **右键菜单保存** - 选中文字右键"保存到 Memo"
- 📄 **保存页面** - 一键保存当前页面 URL 和摘要
- 🔗 **保存链接** - 右键保存任意链接
- ✨ **浮动保存按钮** - 选中文字后显示快速保存按钮
- 📴 **离线支持** - 无网络时暂存，联网后自动同步

## 安装

### Chrome / Edge

1. 下载或克隆此扩展目录
2. 打开浏览器，访问扩展管理页面：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `extension` 目录

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击"临时载入附加组件"
3. 选择 `extension` 目录中的 `manifest.json`

> 注意：Firefox 需要将 `manifest.json` 中的 `service_worker` 改为 `scripts` 数组格式

## 图标生成

1. 在浏览器中打开 `generate-icons.html`
2. 点击"下载所有图标"
3. 将下载的 PNG 文件放入 `icons/` 目录

## 使用方法

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+M` | 打开快速记录窗口 |
| `Ctrl+Shift+S` | 保存选中文字 |

### 右键菜单

- 选中文字 → 右键 → "保存到 Memo"
- 页面空白处 → 右键 → "保存页面到 Memo"
- 链接上 → 右键 → "保存链接到 Memo"

### 浮动按钮

选中网页文字后，会显示蓝色保存按钮，点击即可快速保存。

## 配置

点击扩展图标 → 设置图标 ⚙️

- **自动提取页面信息** - 保存页面时自动提取标题和摘要
- **显示通知** - 保存成功/失败时显示系统通知
- **默认笔记本** - 新备忘录默认保存到的笔记本

## 开发

### 项目结构

```
extension/
├── manifest.json          # 扩展配置
├── background/
│   └── service-worker.js  # 后台脚本（处理右键菜单、快捷键）
├── popup/
│   ├── popup.html         # 弹出窗口 UI
│   ├── popup.js           # 弹出窗口逻辑
│   └── popup.css          # 弹出窗口样式
├── content/
│   ├── content.js         # 内容脚本（页面注入）
│   └── content.css        # 内容脚本样式
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── generate-icons.html    # 图标生成工具
└── generate-icons.js      # Node.js 图标生成脚本
```

### 调试

1. 在扩展管理页面点击"检查视图"查看 Service Worker 日志
2. 在弹窗上右键选择"检查"查看弹窗日志
3. 在页面上打开开发者工具查看内容脚本日志

### API 配置

修改 `background/service-worker.js` 中的 `API_BASE` 变量：

```javascript
const API_BASE = 'https://your-memo-app.pages.dev/api';
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前标签页信息 |
| `contextMenus` | 创建右键菜单 |
| `storage` | 存储登录状态和设置 |
| `alarms` | 定时同步待上传备忘录 |
| `clipboardRead` | 读取剪贴板（可选） |
| `host_permissions` | 访问 Memo API |

## 隐私

- 扩展只在用户主动操作时访问网页内容
- 登录凭证仅存储在本地浏览器
- 不会向第三方发送任何数据

## License

MIT