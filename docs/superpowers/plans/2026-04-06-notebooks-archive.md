# M1: 文件夹 + 归档 — 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为备忘录应用添加笔记本（文件夹）和归档功能，实现按主题分组和归档隐藏已完成项目。

**Architecture:** 单层笔记本结构，笔记本与标签分离显示。归档作为特殊笔记本在侧边栏显示。后端使用 Cloudflare Pages Functions，前端保持原生 JS 架构。

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), Zod validation, Playwright E2E

---

## File Structure

**新增文件：**
- `migrations/0002_notebooks.sql` — 数据库迁移
- `functions/api/notebooks.js` — 笔记本 CRUD API
- `functions/api/notebooks/[id].js` — 单个笔记本操作
- `functions/api/memos/[id]/archive.js` — 归档接口
- `functions/api/memos/[id]/restore.js` — 恢复接口
- `e2e/notebook.spec.ts` — 笔记本 E2E 测试
- `e2e/archive.spec.ts` — 归档 E2E 测试

**修改文件：**
- `functions/_shared/validation.js` — 新增 NotebookSchema
- `functions/api/memos.js` — 支持 notebook 筛选和 notebook_id
- `functions/api/memos/[id].js` — 支持 notebook_id
- `public/script.js` — 笔记本状态、侧边栏、归档功能
- `public/style.css` — 笔记本和归档样式
- `public/index.html` — 笔记本弹窗 HTML

---

## Chunk 1: Database Migration

### Task 1.1: 创建数据库迁移文件

**Files:**
- Create: `migrations/0002_notebooks.sql`

- [ ] **Step 1: 编写迁移 SQL**

```sql
-- Create notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add notebook_id and is_archived to memos
ALTER TABLE memos ADD COLUMN notebook_id INTEGER REFERENCES notebooks(id) DEFAULT 1;
ALTER TABLE memos ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_memos_notebook_id ON memos(notebook_id);
CREATE INDEX IF NOT EXISTS idx_memos_is_archived ON memos(is_archived);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON notebooks(updated_at DESC);

-- Insert default notebook
INSERT INTO notebooks (id, name, icon, sort_order) VALUES
    (1, '未分类', '📁', 0);

-- Update existing memos to belong to default notebook
UPDATE memos SET notebook_id = 1 WHERE notebook_id IS NULL;
```

- [ ] **Step 2: 验证迁移文件语法**

Run: `cat migrations/0002_notebooks.sql`
Expected: SQL 内容正确显示

- [ ] **Step 3: 提交**

```bash
git add migrations/0002_notebooks.sql
git commit -m "feat(db): add notebooks table and archive fields"
```

---

## Chunk 2: Backend — Validation & Notebooks API

### Task 2.1: 添加 NotebookSchema 验证

**Files:**
- Modify: `functions/_shared/validation.js`

- [ ] **Step 1: 添加 NotebookSchema**

在 `TagSchema` 之后添加：

```javascript
/**
 * Notebook validation schema
 */
export const NotebookSchema = z.object({
  name: z.string()
    .min(1, 'Notebook name is required')
    .max(50, 'Notebook name must be 50 characters or less')
    .transform(val => val.trim()),

  icon: z.string()
    .max(10, 'Icon must be 10 characters or less')
    .optional()
    .default('📁')
});
```

- [ ] **Step 2: 验证语法**

Run: `node -e "import('./functions/_shared/validation.js').then(m => console.log(m.NotebookSchema))"`
Expected: Schema 对象正确输出

- [ ] **Step 3: 提交**

```bash
git add functions/_shared/validation.js
git commit -m "feat(validation): add NotebookSchema"
```

### Task 2.2: 创建笔记本列表 API

**Files:**
- Create: `functions/api/notebooks.js`

- [ ] **Step 1: 编写 GET /api/notebooks**

```javascript
import { ApiResponse } from '../_shared/utils.js';
import { NotebookSchema, validateBody } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get notebooks with memo counts (excluding archived)
    const { results } = await env.DB.prepare(`
      SELECT 
        n.id, 
        n.name, 
        n.icon, 
        n.created_at, 
        n.updated_at,
        COUNT(CASE WHEN m.is_archived = 0 THEN 1 END) as memo_count
      FROM notebooks n
      LEFT JOIN memos m ON n.id = m.notebook_id
      GROUP BY n.id
      ORDER BY n.id = 1 DESC, n.updated_at DESC
    `).all();

    // Mark default notebook
    const notebooks = results.map(n => ({
      ...n,
      is_default: n.id === 1,
      memo_count: n.memo_count || 0
    }));

    return ApiResponse.success(notebooks);
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    const result = await env.DB.prepare(`
      INSERT INTO notebooks (name, icon, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(name, icon).run();

    if (!result.success) {
      throw new Error('Failed to create notebook');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, name, icon, created_at, updated_at FROM notebooks WHERE id = ?
    `).bind(result.meta.last_row_id).all();

    return ApiResponse.success({ ...results[0], memo_count: 0, is_default: false }, 201);
  } catch (error) {
    console.error('Error creating notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add functions/api/notebooks.js
git commit -m "feat(api): add notebooks list and create endpoints"
```

### Task 2.3: 创建单个笔记本操作 API

**Files:**
- Create: `functions/api/notebooks/[id].js`

- [ ] **Step 1: 编写 PUT/DELETE /api/notebooks/:id**

```javascript
import { ApiResponse } from '../../_shared/utils.js';
import { NotebookSchema, validateBody } from '../../_shared/validation.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  // Prevent modifying default notebook
  if (id === 1) {
    return ApiResponse.error('Cannot modify default notebook', 403, 'FORBIDDEN');
  }

  const validation = await validateBody(request, NotebookSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }

  const { name, icon } = validation.data;

  try {
    const result = await env.DB.prepare(`
      UPDATE notebooks SET name = ?, icon = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(name, icon, id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, name, icon, created_at, updated_at FROM notebooks WHERE id = ?
    `).bind(id).all();

    return ApiResponse.success(results[0]);
  } catch (error) {
    console.error('Error updating notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid notebook ID', 400, 'VALIDATION_ERROR');
  }

  // Prevent deleting default notebook
  if (id === 1) {
    return ApiResponse.error('Cannot delete default notebook', 403, 'FORBIDDEN');
  }

  try {
    // Move all memos to default notebook
    await env.DB.prepare(`
      UPDATE memos SET notebook_id = 1 WHERE notebook_id = ?
    `).bind(id).run();

    // Delete the notebook
    const result = await env.DB.prepare(`
      DELETE FROM notebooks WHERE id = ?
    `).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Notebook not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ message: 'Notebook deleted', id });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add functions/api/notebooks/[id].js
git commit -m "feat(api): add notebook update and delete endpoints"
```

---

## Chunk 3: Backend — Memos API Updates

### Task 3.1: 更新 memos API 支持笔记本筛选

**Files:**
- Modify: `functions/api/memos.js`

- [ ] **Step 1: 更新 onRequestGet 支持 notebook 和 archived 参数**

修改 `onRequestGet` 函数，在现有筛选逻辑后添加：

```javascript
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const tag = url.searchParams.get('tag') || '';
  const favorite = url.searchParams.get('favorite') === 'true';
  const notebook = url.searchParams.get('notebook') || 'all';
  const archived = url.searchParams.get('archived') === 'true';

  // Validate pagination parameters
  const paginationResult = validateQuery(url.searchParams, PaginationSchema);
  if (!paginationResult.success) {
    return ApiResponse.error(paginationResult.error, 400, 'VALIDATION_ERROR');
  }
  const { page, limit } = paginationResult.data;
  const offset = (page - 1) * limit;

  try {
    // Count query for pagination
    let countQuery = `SELECT COUNT(*) as total FROM memos WHERE 1=1`;
    const countParams = [];

    // Data query with pagination
    let dataQuery = `
      SELECT id, title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at
      FROM memos
      WHERE 1=1
    `;
    const dataParams = [];

    if (search) {
      countQuery += ` AND (title LIKE ? OR content LIKE ?)`;
      dataQuery += ` AND (title LIKE ? OR content LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
      dataParams.push(`%${search}%`, `%${search}%`);
    }

    if (tag) {
      countQuery += ` AND tags LIKE ?`;
      dataQuery += ` AND tags LIKE ?`;
      countParams.push(`%${tag}%`);
      dataParams.push(`%${tag}%`);
    }

    if (favorite) {
      countQuery += ` AND is_favorite = 1`;
      dataQuery += ` AND is_favorite = 1`;
    }

    // Notebook filter
    if (notebook && notebook !== 'all') {
      countQuery += ` AND notebook_id = ?`;
      dataQuery += ` AND notebook_id = ?`;
      countParams.push(parseInt(notebook));
      dataParams.push(parseInt(notebook));
    }

    // Archive filter (default: exclude archived)
    if (!archived) {
      countQuery += ` AND is_archived = 0`;
      dataQuery += ` AND is_archived = 0`;
    }

    // Get total count
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total || 0;

    // Get paginated data
    dataQuery += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    dataParams.push(limit, offset);

    const { results } = await env.DB.prepare(dataQuery).bind(...dataParams).all();

    return ApiResponse.success({
      memos: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + results.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching memos:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}
```

- [ ] **Step 2: 更新 onRequestPost 支持 notebook_id**

修改 `MemoSchema` 的使用，并在 `onRequestPost` 中处理 notebook_id：

在 `onRequestPost` 的 validation 后添加：

```javascript
const { title, content, tags, is_favorite } = validation.data;
const notebook_id = parseInt(url.searchParams.get('notebook_id')) || 1;

// In the INSERT statement:
INSERT INTO memos (title, content, tags, is_favorite, notebook_id, is_archived, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
`).bind(finalTitle, content, tags, is_favorite, notebook_id).run();
```

- [ ] **Step 3: 提交**

```bash
git add functions/api/memos.js
git commit -m "feat(api): add notebook filter and notebook_id support to memos"
```

### Task 3.2: 创建归档 API

**Files:**
- Create: `functions/api/memos/[id]/archive.js`

- [ ] **Step 1: 编写归档接口**

```javascript
import { ApiResponse } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE memos SET is_archived = 1, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    return ApiResponse.success({ id, is_archived: true });
  } catch (error) {
    console.error('Error archiving memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add functions/api/memos/[id]/archive.js
git commit -m "feat(api): add memo archive endpoint"
```

### Task 3.3: 创建恢复 API

**Files:**
- Create: `functions/api/memos/[id]/restore.js`

- [ ] **Step 1: 编写恢复接口**

```javascript
import { ApiResponse } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const id = parseInt(params.id);

  if (!id || isNaN(id)) {
    return ApiResponse.error('Invalid memo ID', 400, 'VALIDATION_ERROR');
  }

  let notebook_id = 1;
  try {
    const body = await request.json();
    if (body.notebook_id) {
      notebook_id = parseInt(body.notebook_id);
    }
  } catch {
    // Use default notebook
  }

  try {
    const result = await env.DB.prepare(`
      UPDATE memos 
      SET is_archived = 0, notebook_id = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).bind(notebook_id, id).run();

    if (!result.success || result.meta.changes === 0) {
      return ApiResponse.error('Memo not found', 404, 'NOT_FOUND');
    }

    // Update notebook's updated_at
    await env.DB.prepare(`
      UPDATE notebooks SET updated_at = datetime('now') WHERE id = ?
    `).bind(notebook_id).run();

    return ApiResponse.success({ id, is_archived: false, notebook_id });
  } catch (error) {
    console.error('Error restoring memo:', error);
    return ApiResponse.error(error.message, 500, 'DATABASE_ERROR');
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add functions/api/memos/[id]/restore.js
git commit -m "feat(api): add memo restore endpoint"
```

---

## Chunk 4: Frontend — State & API Layer

### Task 4.1: 添加笔记本状态管理

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: 在文件顶部添加笔记本状态**

在现有状态声明后添加：

```javascript
// State
let memos = [];
let tags = [];
let notebooks = [];  // NEW
let currentMemo = null;
let currentFilter = { search: '', tag: '', notebook: 'all', archived: false, favorite: false };  // UPDATED
let isPreviewMode = false;
let currentNotebook = 'all';  // NEW: 'all' | notebook_id | 'archived'
```

- [ ] **Step 2: 更新 DOM cache**

在 `dom` 对象中添加：

```javascript
const dom = {
  // ... existing
  notebooksList: null,  // NEW
  notebookModal: null,  // NEW
  notebookSelect: null, // NEW (in memo form)
  restoreModal: null,   // NEW
  includeArchived: null // NEW
};
```

- [ ] **Step 3: 更新 initDomCache**

```javascript
function initDomCache() {
  // ... existing
  dom.notebooksList = $('notebooksList');
  dom.notebookModal = $('notebookModal');
  dom.notebookSelect = $('notebookSelect');
  dom.restoreModal = $('restoreModal');
  dom.includeArchived = $('includeArchived');
}
```

- [ ] **Step 4: 提交**

```bash
git add public/script.js
git commit -m "feat(frontend): add notebook state variables"
```

### Task 4.2: 添加笔记本 API 调用函数

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: 添加笔记本 API 函数**

在 `loadTags()` 函数后添加：

```javascript
// Notebook API
async function loadNotebooks() {
  const res = await fetch('/api/notebooks');
  const data = await res.json();
  notebooks = res.ok ? data.data : [];
  return notebooks;
}

async function createNotebook(data) {
  const res = await fetch('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);
  
  notebooks.push(result.data);
  renderNotebooks();
  showToast('笔记本已创建', 'success');
  return result.data;
}

async function updateNotebook(id, data) {
  const res = await fetch(`/api/notebooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);
  
  const idx = notebooks.findIndex(n => n.id === id);
  if (idx !== -1) {
    notebooks[idx] = { ...notebooks[idx], ...result.data };
    renderNotebooks();
  }
  showToast('笔记本已更新', 'success');
  return result.data;
}

async function deleteNotebook(id) {
  const confirmed = await showConfirm('删除笔记本？其中的备忘录将移至未分类。');
  if (!confirmed) return;
  
  const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
  
  notebooks = notebooks.filter(n => n.id !== id);
  renderNotebooks();
  showToast('笔记本已删除', 'success');
}
```

- [ ] **Step 2: 添加归档 API 函数**

```javascript
async function archiveMemo(id) {
  const res = await fetch(`/api/memos/${id}/archive`, { method: 'POST' });
  if (!res.ok) throw new Error('归档失败');
  
  // Update local state
  const idx = memos.findIndex(m => m.id === id);
  if (idx !== -1) {
    memos[idx].is_archived = true;
  }
  
  // Re-render
  renderMemos();
  updateNotebookCounts();
  showToast('已归档', 'success');
}

async function restoreMemo(id, notebook_id) {
  const res = await fetch(`/api/memos/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notebook_id })
  });
  if (!res.ok) throw new Error('恢复失败');
  
  // Update local state
  const idx = memos.findIndex(m => m.id === id);
  if (idx !== -1) {
    memos[idx].is_archived = false;
    memos[idx].notebook_id = notebook_id;
  }
  
  renderMemos();
  updateNotebookCounts();
  showToast('已恢复', 'success');
}
```

- [ ] **Step 3: 提交**

```bash
git add public/script.js
git commit -m "feat(frontend): add notebook and archive API functions"
```

---

## Chunk 5: Frontend — UI Components

### Task 5.1: 添加笔记本列表渲染

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: 添加 renderNotebooks 函数**

```javascript
function renderNotebooks() {
  // Calculate archived count
  const archivedCount = memos.filter(m => m.is_archived).length;
  
  // Build notebooks HTML
  let html = `
    <div class="notebook-section">
      <div class="sidebar-label">笔记本</div>
      <div class="notebook-item ${currentNotebook === 'all' ? 'active' : ''}" 
           onclick="selectNotebook('all')" tabindex="0">
        <span class="notebook-icon">📁</span>
        <span class="notebook-name">全部笔记</span>
        <span class="notebook-count">${pagination.total}</span>
      </div>
      ${notebooks.filter(n => n.id !== 1).map(n => `
        <div class="notebook-item ${currentNotebook === n.id ? 'active' : ''}" 
             data-id="${n.id}" onclick="selectNotebook(${n.id})" tabindex="0"
             oncontextmenu="showNotebookMenu(event, ${n.id})">
          <span class="notebook-icon">${escapeHtml(n.icon)}</span>
          <span class="notebook-name">${escapeHtml(n.name)}</span>
          <span class="notebook-count">${n.memo_count || 0}</span>
        </div>
      `).join('')}
      <button class="btn btn-outline btn-small notebook-new" onclick="openNotebookModal()">
        + 新建笔记本
      </button>
    </div>
  `;
  
  // Add archived section
  if (archivedCount > 0 || currentNotebook === 'archived') {
    html += `
      <div class="notebook-section archived-section">
        <div class="notebook-item ${currentNotebook === 'archived' ? 'active' : ''}" 
             onclick="selectNotebook('archived')" tabindex="0">
          <span class="notebook-icon">📦</span>
          <span class="notebook-name">已归档</span>
          <span class="notebook-count">${archivedCount}</span>
        </div>
      </div>
    `;
  }
  
  dom.notebooksList.innerHTML = html;
}

function selectNotebook(notebook) {
  currentNotebook = notebook;
  currentFilter.notebook = notebook;
  currentFilter.archived = notebook === 'archived';
  
  resetAndLoad();
  renderNotebooks();
}

function updateNotebookCounts() {
  loadNotebooks().then(() => renderNotebooks());
}

function showNotebookMenu(event, id) {
  event.preventDefault();
  // Simple context menu - for now, just prompt for actions
  const notebook = notebooks.find(n => n.id === id);
  if (!notebook || notebook.is_default) return;
  
  const action = prompt('输入操作: rename 或 delete');
  if (action === 'rename') {
    const newName = prompt('新名称:', notebook.name);
    if (newName && newName !== notebook.name) {
      updateNotebook(id, { name: newName });
    }
  } else if (action === 'delete') {
    deleteNotebook(id);
  }
}
```

- [ ] **Step 2: 更新 loadData 函数**

```javascript
async function loadData() {
  showLoading(true);
  try {
    await Promise.all([loadMemos(), loadTags(), loadNotebooks()]);
    updateStats();
    renderMemos();
    renderTags();
    renderNotebooks();  // NEW
  } catch (e) {
    showToast('加载失败', 'error');
  } finally {
    showLoading(false);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add public/script.js
git commit -m "feat(frontend): add notebook list rendering"
```

### Task 5.2: 添加笔记本弹窗 HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: 在 tagModal 之后添加 notebookModal**

```html
<!-- Notebook Modal -->
<div class="modal" id="notebookModal">
  <div class="modal-content modal-small">
    <div class="modal-header">
      <h2 id="notebookModalTitle">新建笔记本</h2>
      <button class="modal-close" onclick="closeNotebookModal()" aria-label="关闭">×</button>
    </div>
    <form id="notebookForm" class="modal-body">
      <div class="form-group">
        <label for="notebookName">笔记本名称 <span class="required">*</span></label>
        <input type="text" id="notebookName" required placeholder="输入笔记本名称..." maxlength="50">
      </div>
      <div class="form-group">
        <label for="notebookIcon">图标</label>
        <input type="text" id="notebookIcon" value="📁" maxlength="10" class="icon-input">
        <div class="icon-presets">
          <button type="button" class="icon-preset" data-icon="📁">📁</button>
          <button type="button" class="icon-preset" data-icon="💼">💼</button>
          <button type="button" class="icon-preset" data-icon="📚">📚</button>
          <button type="button" class="icon-preset" data-icon="🏠">🏠</button>
          <button type="button" class="icon-preset" data-icon="💡">💡</button>
          <button type="button" class="icon-preset" data-icon="🎯">🎯</button>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeNotebookModal()">取消</button>
        <button type="submit" class="btn btn-primary">创建</button>
      </div>
    </form>
  </div>
</div>

<!-- Restore Modal -->
<div class="modal" id="restoreModal">
  <div class="modal-content modal-small">
    <div class="modal-header">
      <h2>恢复到笔记本</h2>
      <button class="modal-close" onclick="closeRestoreModal()" aria-label="关闭">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="restoreNotebook">选择目标笔记本</label>
        <select id="restoreNotebook" class="restore-select">
          <!-- Options populated by JS -->
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeRestoreModal()">取消</button>
        <button type="button" class="btn btn-primary" onclick="confirmRestore()">恢复</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 在 memoForm 中添加笔记本选择**

在 `memoTags` form-group 之后添加：

```html
<div class="form-group">
  <label for="memoNotebook">笔记本</label>
  <select id="memoNotebook" class="notebook-select">
    <!-- Options populated by JS -->
  </select>
</div>
```

- [ ] **Step 3: 更新侧边栏 HTML**

替换现有 sidebar 内容：

```html
<!-- Sidebar -->
<aside class="sidebar">
  <div class="stats">
    <div class="stat-item">
      <span class="stat-number" id="totalMemos">0</span>
      <span class="stat-label">备忘录</span>
    </div>
    <div class="stat-item">
      <span class="stat-number" id="totalTags">0</span>
      <span class="stat-label">标签</span>
    </div>
  </div>

  <div id="notebooksList" class="notebooks-list"></div>

  <div class="tags-section">
    <h2>标签</h2>
    <div class="tags-list" id="tagsList"></div>
    <button class="btn btn-outline btn-small" id="newTagBtn">+ 新标签</button>
  </div>
</aside>
```

- [ ] **Step 4: 提交**

```bash
git add public/index.html
git commit -m "feat(frontend): add notebook and restore modal HTML"
```

### Task 5.3: 添加笔记本弹窗逻辑

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: 添加弹窗控制函数**

```javascript
let editingNotebookId = null;

function openNotebookModal(id = null) {
  editingNotebookId = id;
  const modal = dom.notebookModal;
  const title = $('notebookModalTitle');
  const nameInput = $('notebookName');
  const iconInput = $('notebookIcon');
  
  if (id) {
    const notebook = notebooks.find(n => n.id === id);
    title.textContent = '重命名笔记本';
    nameInput.value = notebook?.name || '';
    iconInput.value = notebook?.icon || '📁';
  } else {
    title.textContent = '新建笔记本';
    nameInput.value = '';
    iconInput.value = '📁';
  }
  
  modal.classList.add('active');
  nameInput.focus();
}

function closeNotebookModal() {
  dom.notebookModal.classList.remove('active');
  editingNotebookId = null;
}

async function handleNotebookSubmit(e) {
  e.preventDefault();
  
  const name = $('notebookName').value.trim();
  const icon = $('notebookIcon').value || '📁';
  
  if (!name) {
    showToast('请输入名称', 'error');
    return;
  }
  
  showLoading(true);
  try {
    if (editingNotebookId) {
      await updateNotebook(editingNotebookId, { name, icon });
    } else {
      await createNotebook({ name, icon });
    }
    closeNotebookModal();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// Icon preset buttons
document.querySelectorAll('.icon-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    $('notebookIcon').value = btn.dataset.icon;
  });
});
```

- [ ] **Step 2: 添加恢复弹窗逻辑**

```javascript
let restoreMemoId = null;

function openRestoreModal(memoId) {
  restoreMemoId = memoId;
  const select = $('restoreNotebook');
  
  select.innerHTML = notebooks.map(n => 
    `<option value="${n.id}">${escapeHtml(n.icon)} ${escapeHtml(n.name)}</option>`
  ).join('');
  
  // Default to first notebook (usually 未分类)
  select.value = '1';
  
  dom.restoreModal.classList.add('active');
}

function closeRestoreModal() {
  dom.restoreModal.classList.remove('active');
  restoreMemoId = null;
}

async function confirmRestore() {
  if (!restoreMemoId) return;
  
  const notebook_id = parseInt($('restoreNotebook').value);
  
  showLoading(true);
  try {
    await restoreMemo(restoreMemoId, notebook_id);
    closeRestoreModal();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    showLoading(false);
  }
}
```

- [ ] **Step 3: 更新 setupEvents**

```javascript
// Add to setupEvents()
$('notebookForm').addEventListener('submit', handleNotebookSubmit);

dom.notebookModal.addEventListener('click', e => {
  if (e.target === dom.notebookModal) closeNotebookModal();
});

dom.restoreModal.addEventListener('click', e => {
  if (e.target === dom.restoreModal) closeRestoreModal();
});
```

- [ ] **Step 4: 提交**

```bash
git add public/script.js
git commit -m "feat(frontend): add notebook and restore modal logic"
```

### Task 5.4: 更新备忘录卡片和表单

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: 更新 createMemoCard 支持归档按钮**

在 memo-actions 中添加归档按钮：

```javascript
function createMemoCard(memo) {
  const memoTags = (memo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const tagHtml = memoTags.map(name => {
    const tag = tags.find(t => t.name === name);
    return `<span class="memo-tag" style="background:${tag?.color || '#64748b'}">${escapeHtml(name)}</span>`;
  }).join('');

  const date = new Date(memo.created_at).toLocaleDateString('zh-CN');
  const content = parseMarkdown(memo.content);
  const borderColor = getRandomMemoColor();
  
  // Archive or restore button based on state
  const archiveBtn = memo.is_archived 
    ? `<button class="memo-action" onclick="openRestoreModal(${memo.id})" title="恢复">
         <svg class="icon small"><use href="#icon-upload"/></svg>
       </button>`
    : `<button class="memo-action" onclick="archiveMemo(${memo.id})" title="归档">
         <svg class="icon small"><use href="#icon-archive"/></svg>
       </button>`;

  return `
    <article class="memo-card ${memo.is_archived ? 'archived' : ''}" data-memo-id="${memo.id}" tabindex="0" role="listitem" style="border-left: 4px solid ${borderColor}">
      <div class="memo-header">
        <h3 class="memo-title">${escapeHtml(memo.title)}</h3>
        <div class="memo-actions">
          ${!memo.is_archived ? `
          <button class="memo-action" onclick="openMemoModal(${memo.id})" title="编辑">
            <svg class="icon small"><use href="#icon-edit"/></svg>
          </button>
          ` : ''}
          <button class="memo-action ${memo.is_favorite ? 'favorite' : ''}" onclick="toggleFavorite(${memo.id})" title="${memo.is_favorite ? '取消收藏' : '收藏'}">
            <svg class="icon small"><use href="#icon-star${memo.is_favorite ? '' : '-empty'}"/></svg>
          </button>
          ${archiveBtn}
          ${!memo.is_archived ? `
          <button class="memo-action" onclick="deleteMemo(${memo.id})" title="删除">
            <svg class="icon small"><use href="#icon-trash"/></svg>
          </button>
          ` : ''}
        </div>
      </div>
      <div class="memo-content">${content}</div>
      <div class="memo-footer">
        <div class="memo-tags">${tagHtml}</div>
        <time class="memo-date">${date}</time>
      </div>
    </article>
  `;
}
```

- [ ] **Step 2: 更新 openMemoModal 填充笔记本选择**

```javascript
function openMemoModal(id = null) {
  currentMemo = id ? memos.find(m => m.id === id) : null;

  $('modalTitle').textContent = currentMemo ? '编辑备忘录' : '新建备忘录';

  // Populate notebook select
  const notebookSelect = $('memoNotebook');
  notebookSelect.innerHTML = notebooks.map(n => 
    `<option value="${n.id}" ${currentMemo?.notebook_id === n.id ? 'selected' : ''}>${escapeHtml(n.icon)} ${escapeHtml(n.name)}</option>`
  ).join('');
  
  // Default to current filter notebook or first notebook
  if (!currentMemo && currentNotebook !== 'all' && currentNotebook !== 'archived') {
    notebookSelect.value = currentNotebook;
  }

  // ... rest of existing function
}
```

- [ ] **Step 3: 更新 handleMemoSubmit 发送 notebook_id**

```javascript
async function handleMemoSubmit(e) {
  e.preventDefault();

  const data = {
    title: $('memoTitle').value.trim(),
    content: $('memoContent').value.trim(),
    tags: $('memoTags').value.trim(),
    is_favorite: $('memoFavorite').checked,
    notebook_id: parseInt($('memoNotebook').value) || 1  // NEW
  };

  // ... rest of function
}
```

- [ ] **Step 4: 提交**

```bash
git add public/script.js
git commit -m "feat(frontend): update memo card and form for notebooks"
```

### Task 5.5: 添加笔记本样式

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: 添加笔记本相关样式**

在文件末尾添加：

```css
/* Notebooks Section */
.notebooks-list {
  margin-bottom: 1rem;
}

.notebook-section {
  margin-bottom: 0.5rem;
}

.notebook-section.archived-section {
  opacity: 0.6;
  border-top: 1px solid var(--border-color);
  padding-top: 0.5rem;
}

.sidebar-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  padding: 0 0.25rem;
}

.notebook-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 0.125rem;
}

.notebook-item:hover {
  background: var(--bg-tertiary);
}

.notebook-item.active {
  background: var(--primary-color);
  color: white;
}

.notebook-item.active .notebook-count {
  color: rgba(255, 255, 255, 0.8);
}

.notebook-icon {
  margin-right: 0.5rem;
  font-size: 1rem;
}

.notebook-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notebook-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.notebook-new {
  width: 100%;
  margin-top: 0.5rem;
}

/* Notebook Modal */
.icon-input {
  width: 4rem;
  text-align: center;
  font-size: 1.5rem;
}

.icon-presets {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.icon-preset {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-preset:hover {
  background: var(--bg-secondary);
  border-color: var(--primary-color);
}

/* Notebook Select in Memo Form */
.notebook-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
}

/* Archived Memo Card */
.memo-card.archived {
  opacity: 0.7;
  background: var(--bg-tertiary);
}

/* Restore Modal */
.restore-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
}
```

- [ ] **Step 2: 添加归档图标到 SVG symbols**

在 `index.html` 的 SVG symbols 中添加：

```html
<symbol id="icon-archive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="21 8 21 21 3 21 3 8"/>
  <rect x="1" y="3" width="22" height="5"/>
  <line x1="10" y1="12" x2="14" y2="12"/>
</symbol>
```

- [ ] **Step 3: 提交**

```bash
git add public/style.css public/index.html
git commit -m "feat(frontend): add notebook and archive styles"
```

---

## Chunk 6: E2E Tests

### Task 6.1: 创建笔记本 E2E 测试

**Files:**
- Create: `e2e/notebook.spec.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Notebook Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.notebook-item', { timeout: 10000 });
  });

  test('应该显示笔记本列表', async ({ page }) => {
    await expect(page.locator('.notebook-item').first()).toContainText('全部笔记');
  });

  test('创建笔记本', async ({ page }) => {
    // Click new notebook button
    await page.click('.notebook-new');
    
    // Fill form
    await page.fill('#notebookName', '测试笔记本');
    await page.click('#notebookForm .btn-primary');
    
    // Wait for notebook to appear
    await expect(page.locator('.notebook-item', { hasText: '测试笔记本' })).toBeVisible();
  });

  test('切换笔记本', async ({ page }) => {
    // Click on a notebook
    const notebookItem = page.locator('.notebook-item').nth(1);
    const notebookName = await notebookItem.textContent();
    await notebookItem.click();
    
    // Verify active state
    await expect(notebookItem).toHaveClass(/active/);
  });

  test('创建备忘录时选择笔记本', async ({ page }) => {
    // Open new memo modal
    await page.click('#newMemoBtn');
    
    // Verify notebook select exists
    await expect(page.locator('#memoNotebook')).toBeVisible();
    
    // Create memo with notebook
    await page.fill('#memoContent', '测试内容选择笔记本');
    await page.click('#memoForm .btn-primary');
    
    // Verify memo created
    await expect(page.locator('.memo-card', { hasText: '测试内容选择笔记本' })).toBeVisible();
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add e2e/notebook.spec.ts
git commit -m "test(e2e): add notebook feature tests"
```

### Task 6.2: 创建归档 E2E 测试

**Files:**
- Create: `e2e/archive.spec.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Archive Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 10000 });
  });

  test('归档备忘录', async ({ page }) => {
    // Find first memo
    const firstMemo = page.locator('.memo-card').first();
    await expect(firstMemo).toBeVisible();
    
    // Click archive button
    await firstMemo.locator('.memo-action[title="归档"]').click();
    
    // Wait for toast
    await expect(page.locator('.toast', { hasText: '已归档' })).toBeVisible();
    
    // Memo should no longer be visible
    await expect(firstMemo).not.toBeVisible();
  });

  test('查看已归档备忘录', async ({ page }) => {
    // First archive a memo
    const firstMemo = page.locator('.memo-card').first();
    if (await firstMemo.isVisible()) {
      await firstMemo.locator('.memo-action[title="归档"]').click();
      await page.waitForSelector('.toast', { timeout: 3000 });
    }
    
    // Click archived notebook
    await page.click('.notebook-item:has-text("已归档")');
    
    // Verify archived memos show
    await expect(page.locator('.memo-card.archived').first()).toBeVisible();
  });

  test('恢复已归档备忘录', async ({ page }) => {
    // Go to archived
    await page.click('.notebook-item:has-text("已归档")');
    
    // Find archived memo
    const archivedMemo = page.locator('.memo-card.archived').first();
    if (await archivedMemo.isVisible()) {
      // Click restore button
      await archivedMemo.locator('.memo-action[title="恢复"]').click();
      
      // Select notebook and confirm
      await page.click('#restoreModal .btn-primary');
      
      // Wait for toast
      await expect(page.locator('.toast', { hasText: '已恢复' })).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add e2e/archive.spec.ts
git commit -m "test(e2e): add archive feature tests"
```

---

## Verification Checklist

完成所有任务后，验证以下内容：

### API 验证
- [ ] `GET /api/notebooks` 返回笔记本列表含 memo_count
- [ ] `POST /api/notebooks` 创建笔记本成功
- [ ] `PUT /api/notebooks/:id` 更新笔记本成功（非默认笔记本）
- [ ] `DELETE /api/notebooks/:id` 删除笔记本并将备忘录移至默认
- [ ] `GET /api/memos?notebook=X` 按笔记本筛选
- [ ] `GET /api/memos?archived=true` 包含归档备忘录
- [ ] `POST /api/memos/:id/archive` 归档成功
- [ ] `POST /api/memos/:id/restore` 恢复成功

### UI 验证
- [ ] 侧边栏显示笔记本列表
- [ ] 点击笔记本切换筛选
- [ ] 创建备忘录可选择笔记本
- [ ] 备忘录卡片显示归档按钮
- [ ] 点击归档后备忘录消失
- [ ] 已归档笔记本显示归档列表
- [ ] 恢复弹窗可选择目标笔记本

### 测试验证
- [ ] `npx playwright test e2e/notebook.spec.ts` 通过
- [ ] `npx playwright test e2e/archive.spec.ts` 通过
- [ ] `npx playwright test` 全部通过

---

## 完成标记

所有任务完成后：

```bash
git add -A
git commit -m "feat(m1): complete notebooks and archive feature"
```