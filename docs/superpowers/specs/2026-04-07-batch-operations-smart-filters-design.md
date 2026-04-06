# M2 Design: 批量操作 + 智能筛选

## 概述

为 Memo 应用添加批量操作和智能筛选功能，提升效率。

## 功能一：批量操作

### 1.1 进入选择模式

**触发方式：**
- 卡片悬停时左上角显示空心圆圈 `○`
- 点击圆圈进入选择模式，圆圈变为勾选 `☑`
- 再次点击取消选择

**选择模式 UI：**
- 顶部显示操作栏：「已选择 N 个」 | 「全选」 | 「取消选择」
- 选中的卡片添加 `.selected` 类（边框高亮）
- 其他卡片仍可点击选择
- **点击已选中的卡片会取消选择**（toggle 行为）

### 1.2 右键上下文菜单

选中状态下右键显示批量操作菜单：

```
┌─────────────────────┐
│ 移动到笔记本...      │
│ 归档所选            │
│ 修改标签...          │
│ 删除所选            │
├─────────────────────┤
│ 取消选择            │
└─────────────────────┘
```

### 1.3 批量操作实现

| 操作 | 实现 |
|------|------|
| 移动到笔记本 | 弹出笔记本选择器，确认后批量更新 notebook_id |
| 归档 | 直接调用批量归档 API，更新 is_archived=true |
| 修改标签 | 弹出标签编辑器：追加标签 / 替换标签 / 移除标签 |
| 删除 | 二次确认后批量删除 |

### 1.4 后端 API

**POST /api/memos/batch**

```json
{
  "action": "archive" | "restore" | "delete" | "move" | "tags",
  "memo_ids": [1, 2, 3],
  "params": {
    // move: { "notebook_id": 2 }
    // tags: { "mode": "add" | "replace" | "remove", "tags": "tag1,tag2" }
  }
}
```

响应：
```json
{
  "success": true,
  "data": { "affected": 3 }
}
```

---

## 功能二：智能筛选

### 2.1 侧边栏「已保存的筛选」区域

位置：笔记本区域下方，标签区域上方

```
笔记本
  📁 全部笔记
  📁 工作
  📁 生活

已保存的筛选
  ⭐ 工作待办
  ⭐ 本周重要
  + 保存当前筛选

标签
  Ideas
  Important
  ...
```

### 2.2 创建筛选预设

**流程：**
1. 用户设置筛选条件（笔记本、标签、收藏、搜索词）
2. 点击「+ 保存当前筛选」
3. 弹出模态框，输入名称、选择图标
4. 保存到数据库

**筛选预设模态框：**
```
┌─────────────────────────┐
│ 保存筛选预设         × │
├─────────────────────────┤
│ 名称 *                  │
│ ┌─────────────────────┐ │
│ │ 工作待办            │ │
│ └─────────────────────┘ │
│                         │
│ 图标                    │
│ ⭐ 📋 🔔 📌 💼 🎯       │
│                         │
│ 当前条件                │
│ • 笔记本: 工作          │
│ • 标签: Todo            │
├─────────────────────────┤
│         [取消] [保存]   │
└─────────────────────────┘
```

### 2.3 筛选条件配置

筛选预设保存的配置：

```json
{
  "notebook": "all" | notebook_id,
  "tags": ["Todo", "Important"],
  "favorite": true | false | null,
  "archived": true | false | null,
  "search": "关键词"
}
```

`null` 表示该条件未启用。

### 2.4 使用筛选预设

- 点击侧边栏中的筛选预设，立即应用筛选条件
- 当前激活的筛选预设高亮显示
- 点击「全部笔记」或刷新页面清除筛选预设

### 2.5 管理筛选预设

- 右键筛选预设：重命名、删除
- 侧边栏最多显示 10 个预设，超出需删除

---

## 数据结构

### 新增表: saved_filters

```sql
CREATE TABLE saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  filter_config TEXT NOT NULL,  -- JSON
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_saved_filters_sort_order ON saved_filters(sort_order);
```

### 新增迁移文件

`migrations/0003_saved_filters.sql`

---

## API 端点

### 筛选预设 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/filters | 获取筛选预设列表 |
| POST | /api/filters | 创建筛选预设 |
| PUT | /api/filters/:id | 更新筛选预设 |
| DELETE | /api/filters/:id | 删除筛选预设 |

### 批量操作 API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/memos/batch | 批量操作备忘录 |

---

## 验证 Schemas

### 批量操作 Schema

```javascript
export const BatchSchema = z.object({
  action: z.enum(['archive', 'restore', 'delete', 'move', 'tags']),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    notebook_id: z.number().int().positive().optional(),
    mode: z.enum(['add', 'replace', 'remove']).optional(),
    tags: z.string().optional()
  }).optional()
});

// 根据 action 校验 params
export const BatchMoveSchema = z.object({
  action: z.literal('move'),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    notebook_id: z.number().int().positive()
  })
});

export const BatchTagsSchema = z.object({
  action: z.literal('tags'),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    mode: z.enum(['add', 'replace', 'remove']),
    tags: z.string().min(1)
  })
});
```

### 筛选预设 Schema

```javascript
export const SavedFilterSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default('⭐'),
  filter_config: z.object({
    notebook: z.union([z.literal('all'), z.number().int().positive()]).nullable(),
    tags: z.array(z.string()).nullable(),
    favorite: z.boolean().nullable(),
    archived: z.boolean().nullable(),
    search: z.string().max(100).nullable()
  })
});
```

---

## 错误处理

### 批量操作错误处理

**策略：部分成功 + 错误列表**

```json
{
  "success": true,
  "data": {
    "affected": 2,
    "failed": [
      { "id": 3, "reason": "备忘录不存在" }
    ]
  }
}
```

**验证规则：**
- `memo_ids` 超过 100 个返回 400 错误
- `notebook_id` 不存在返回部分成功 + 错误列表
- 无效标签名自动过滤，不返回错误

---

## 前端实现

### 新增状态变量

```javascript
let selectionMode = false;
let selectedMemoIds = new Set();
let savedFilters = [];
let currentFilterPreset = null;
```

### 新增函数

```javascript
// 批量选择
function toggleSelectionMode() {}
function toggleMemoSelection(id) {}
function selectAllMemos() {}
function clearSelection() {}

// 批量操作
function showBatchContextMenu(event) {}
function batchArchive() {}
function batchMoveToNotebook() {}
function batchModifyTags() {}
function batchDelete() {}

// 智能筛选
function renderSavedFilters() {}
function openSaveFilterModal() {}
function saveFilterPreset() {}
function applyFilterPreset(id) {}
function deleteFilterPreset(id) {}
```

### 新增 DOM 元素

```html
<!-- 批量操作栏 -->
<div class="batch-bar" id="batchBar" style="display: none;">
  <span id="batchCount">已选择 0 个</span>
  <button onclick="selectAllMemos()">全选</button>
  <button onclick="clearSelection()">取消</button>
</div>

<!-- 批量操作上下文菜单 -->
<div class="context-menu" id="batchContextMenu">
  <div class="context-item" onclick="batchMoveToNotebook()">移动到笔记本...</div>
  <div class="context-item" onclick="batchArchive()">归档所选</div>
  <div class="context-item" onclick="batchModifyTags()">修改标签...</div>
  <div class="context-item danger" onclick="batchDelete()">删除所选</div>
  <div class="context-divider"></div>
  <div class="context-item" onclick="clearSelection()">取消选择</div>
</div>

<!-- 已保存的筛选区域 -->
<div class="saved-filters-section">
  <h2>已保存的筛选</h2>
  <div class="saved-filters-list" id="savedFiltersList"></div>
  <button class="btn btn-outline btn-small" id="saveFilterBtn">+ 保存当前筛选</button>
</div>

<!-- 保存筛选模态框 -->
<div class="modal" id="saveFilterModal">
  <div class="modal-content modal-small">
    <div class="modal-header">
      <h2>保存筛选预设</h2>
      <button class="modal-close" onclick="closeSaveFilterModal()" aria-label="关闭">×</button>
    </div>
    <form id="saveFilterForm" class="modal-body">
      <div class="form-group">
        <label for="filterName">名称 <span class="required">*</span></label>
        <input type="text" id="filterName" required placeholder="输入预设名称..." maxlength="50">
      </div>
      <div class="form-group">
        <label for="filterIcon">图标</label>
        <input type="text" id="filterIcon" value="⭐" maxlength="10" class="icon-input">
        <div class="icon-presets">
          <button type="button" class="icon-preset" data-icon="⭐">⭐</button>
          <button type="button" class="icon-preset" data-icon="📋">📋</button>
          <button type="button" class="icon-preset" data-icon="🔔">🔔</button>
          <button type="button" class="icon-preset" data-icon="📌">📌</button>
          <button type="button" class="icon-preset" data-icon="💼">💼</button>
          <button type="button" class="icon-preset" data-icon="🎯">🎯</button>
        </div>
      </div>
      <div class="form-group">
        <label>当前条件</label>
        <div id="filterConditions" class="filter-conditions-preview"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeSaveFilterModal()">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  </div>
</div>

<!-- 批量修改标签模态框 -->
<div class="modal" id="batchTagsModal">
  <div class="modal-content modal-small">
    <div class="modal-header">
      <h2>批量修改标签</h2>
      <button class="modal-close" onclick="closeBatchTagsModal()" aria-label="关闭">×</button>
    </div>
    <form id="batchTagsForm" class="modal-body">
      <div class="form-group">
        <label>修改方式</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="tagMode" value="add" checked>
            <span>追加标签</span>
            <small class="radio-hint">在现有标签后添加新标签</small>
          </label>
          <label class="radio-label">
            <input type="radio" name="tagMode" value="replace">
            <span>替换标签</span>
            <small class="radio-hint">清除现有标签，只保留新标签</small>
          </label>
          <label class="radio-label">
            <input type="radio" name="tagMode" value="remove">
            <span>移除标签</span>
            <small class="radio-hint">从现有标签中删除指定标签</small>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label for="batchTags">标签</label>
        <input type="text" id="batchTags" placeholder="输入标签，逗号分隔..." maxlength="200">
        <small class="form-hint">已选择 <span id="batchAffectedCount">0</span> 个备忘录</small>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeBatchTagsModal()">取消</button>
        <button type="submit" class="btn btn-primary">确认修改</button>
      </div>
    </form>
  </div>
</div>
```

---

## 样式

### 批量操作栏

```css
.batch-bar {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-lg);
  z-index: 100;
}

.memo-card.selected {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.memo-card .select-circle {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  background: var(--bg-primary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.memo-card:hover .select-circle {
  opacity: 1;
}

.memo-card.selected .select-circle {
  opacity: 1;
  background: var(--primary-color);
  border-color: var(--primary-color);
}
```

### 右键菜单

```css
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  min-width: 160px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.context-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.context-item:hover {
  background: var(--bg-tertiary);
}

.context-item.danger {
  color: var(--error-color);
}

.context-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.25rem 0;
}
```

---

## 任务分解

### Chunk 1: 数据库 + 后端 API (3 tasks)
- T1.1: 创建 saved_filters 表迁移
- T1.2: 创建批量操作 API
- T1.3: 创建筛选预设 API

### Chunk 2: 批量操作前端 (4 tasks)
- T2.1: 添加选择模式状态和 UI
- T2.2: 实现右键上下文菜单
- T2.3: 实现批量操作逻辑
- T2.4: 添加批量操作样式

### Chunk 3: 智能筛选前端 (4 tasks)
- T3.1: 添加筛选预设状态和 API 函数
- T3.2: 实现侧边栏筛选预设列表
- T3.3: 实现保存筛选模态框
- T3.4: 实现应用筛选预设

### Chunk 4: E2E 测试 (2 tasks)
- T4.1: 批量操作 E2E 测试
- T4.2: 智能筛选 E2E 测试

**测试框架：Playwright**（项目已有配置，位于 `e2e/` 目录）

---

## 验收标准

### 批量操作

- [ ] 悬停卡片显示选择圆圈
- [ ] 点击圆圈进入选择模式
- [ ] 选中多个卡片后右键显示批量菜单
- [ ] 移动到笔记本功能正常
- [ ] 归档功能正常
- [ ] 修改标签功能正常
- [ ] 删除功能正常（有确认）

### 智能筛选

- [ ] 侧边栏显示已保存筛选区域
- [ ] 保存当前筛选功能正常
- [ ] 点击筛选预设应用条件
- [ ] 删除筛选预设功能正常
- [ ] 最多显示 10 个预设