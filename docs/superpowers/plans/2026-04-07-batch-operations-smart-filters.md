# M2: Batch Operations & Smart Filters Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch operations (select multiple memos, right-click menu for batch actions) and smart filters (save filter presets, quick switching).

**Architecture:** 
- Backend: New batch API endpoint handles archive/move/delete/tags operations in one call. Saved filters stored in new table as JSON config.
- Frontend: Selection mode toggles per-card checkboxes, context menu for batch actions, sidebar section for filter presets.

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), vanilla JS, Zod validation, Playwright E2E tests.

---

## Files Overview

| File | Action | Purpose |
|------|--------|---------|
| `migrations/0003_saved_filters.sql` | Create | D1 migration for saved_filters table |
| `functions/api/memos/batch.js` | Create | Batch operations endpoint |
| `functions/api/filters.js` | Create | Saved filters CRUD |
| `functions/api/filters/[id].js` | Create | Single filter operations |
| `functions/_shared/validation.js` | Modify | Add BatchSchema, SavedFilterSchema |
| `public/script.js` | Modify | Add selection mode, batch actions, filter presets |
| `public/index.html` | Modify | Add batch bar, context menu, modals, sidebar section |
| `public/style.css` | Modify | Add batch operation and saved filters styles |
| `e2e/batch.spec.ts` | Create | Batch operations E2E tests |
| `e2e/saved-filters.spec.ts` | Create | Saved filters E2E tests |

---

## Chunk 1: Database + Backend API

### Task 1.1: Create saved_filters table migration

**Prerequisite:** `0002_notebooks.sql` must be applied first (adds `is_archived` column used by batch operations).

**Files:**
- Create: `migrations/0003_saved_filters.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/0003_saved_filters.sql

CREATE TABLE IF NOT EXISTS saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  filter_config TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_sort_order ON saved_filters(sort_order);
```

- [ ] **Step 2: Test migration locally**

Run: `npm run db:migrate`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add migrations/0003_saved_filters.sql
git commit -m "feat(db): add saved_filters table"
```

---

### Task 1.2: Add validation schemas

**Files:**
- Modify: `functions/_shared/validation.js`

- [ ] **Step 1: Add BatchSchema**

Add after NotebookSchema (around line 46 in validation.js), before PaginationSchema:

```javascript
// Add after NotebookSchema

export const BatchSchema = z.object({
  action: z.enum(['archive', 'restore', 'delete', 'move', 'tags']),
  memo_ids: z.array(z.number().int().positive()).min(1).max(100),
  params: z.object({
    notebook_id: z.number().int().positive().optional(),
    mode: z.enum(['add', 'replace', 'remove']).optional(),
    tags: z.string().optional()
  }).optional()
});

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

- [ ] **Step 2: Add SavedFilterSchema**

```javascript
// Add after BatchTagsSchema

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

export const SavedFilterUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(10).optional(),
  filter_config: SavedFilterSchema.shape.filter_config.optional()
});
```

- [ ] **Step 3: Commit**

```bash
git add functions/_shared/validation.js
git commit -m "feat(validation): add BatchSchema and SavedFilterSchema"
```

---

### Task 1.3: Create batch operations API

**Files:**
- Create: `functions/api/memos/batch.js`

- [ ] **Step 1: Create batch endpoint**

```javascript
// functions/api/memos/batch.js

import { ApiResponse } from '../_shared/utils.js';
import { validateBody } from '../_shared/validation.js';
import { BatchSchema, BatchMoveSchema, BatchTagsSchema } from '../_shared/validation.js';

export async function onRequestPost(context) {
  const { DB } = context.env;
  
  const validation = await validateBody(context.request, BatchSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { action, memo_ids, params } = validation.data;
  
  // Validate action-specific params structure (not existence)
  if (action === 'move') {
    const moveValidation = BatchMoveSchema.safeParse(validation.data);
    if (!moveValidation.success) {
      return ApiResponse.error(moveValidation.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
  }
  
  if (action === 'tags') {
    const tagsValidation = BatchTagsSchema.safeParse(validation.data);
    if (!tagsValidation.success) {
      return ApiResponse.error(tagsValidation.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
  }
  
  const results = { affected: 0, failed: [] };
  
  for (const memoId of memo_ids) {
    try {
      switch (action) {
        case 'archive':
          await DB.prepare('UPDATE memos SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(memoId).run();
          break;
        case 'restore':
          await DB.prepare('UPDATE memos SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(memoId).run();
          break;
        case 'delete':
          await DB.prepare('DELETE FROM memos WHERE id = ?').bind(memoId).run();
          break;
        case 'move':
          // Check notebook exists inside loop for partial success
          const notebook = await DB.prepare('SELECT id FROM notebooks WHERE id = ?')
            .bind(params.notebook_id).first();
          if (!notebook) {
            results.failed.push({ id: memoId, reason: '笔记本不存在' });
            continue;
          }
          await DB.prepare('UPDATE memos SET notebook_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(params.notebook_id, memoId).run();
          break;
        case 'tags':
          const memo = await DB.prepare('SELECT tags FROM memos WHERE id = ?').bind(memoId).first();
          if (!memo) {
            results.failed.push({ id: memoId, reason: '备忘录不存在' });
            continue;
          }
          let newTags = memo.tags || '';
          const inputTags = params.tags.split(',').map(t => t.trim()).filter(t => t);
          
          if (params.mode === 'add') {
            const existingTags = newTags ? newTags.split(',').map(t => t.trim()) : [];
            const combined = [...existingTags, ...inputTags];
            newTags = [...new Set(combined)].join(',');
          } else if (params.mode === 'replace') {
            newTags = inputTags.join(',');
          } else if (params.mode === 'remove') {
            const existingTags = newTags ? newTags.split(',').map(t => t.trim()) : [];
            newTags = existingTags.filter(t => !inputTags.includes(t)).join(',');
          }
          
          await DB.prepare('UPDATE memos SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(newTags, memoId).run();
          break;
      }
      results.affected++;
    } catch (err) {
      results.failed.push({ id: memoId, reason: err.message });
    }
  }
  
  return ApiResponse.success(results);
}
```

- [ ] **Step 2: Test locally with curl**

Run: 
```bash
curl -X POST http://127.0.0.1:8788/api/memos/batch \
  -H "Content-Type: application/json" \
  -d '{"action":"archive","memo_ids":[1,2]}'
```
Expected: `{ "success": true, "data": { "affected": 2, "failed": [] } }`

Run validation error tests:
```bash
# Invalid action
curl -X POST http://127.0.0.1:8788/api/memos/batch \
  -H "Content-Type: application/json" \
  -d '{"action":"invalid","memo_ids":[1]}'
```
Expected: 400 error

```bash
# Move without notebook_id
curl -X POST http://127.0.0.1:8788/api/memos/batch \
  -H "Content-Type: application/json" \
  -d '{"action":"move","memo_ids":[1]}'
```
Expected: 400 error "笔记本不存在"

- [ ] **Step 3: Commit**

```bash
git add functions/api/memos/batch.js
git commit -m "feat(api): add batch operations endpoint"
```

---

### Task 1.4: Create saved filters API

**Files:**
- Create: `functions/api/filters.js`
- Create: `functions/api/filters/[id].js`

- [ ] **Step 1: Create filters list and create endpoint**

```javascript
// functions/api/filters.js

import { ApiResponse } from '../_shared/utils.js';
import { validateBody } from '../_shared/validation.js';
import { SavedFilterSchema } from '../_shared/validation.js';

export async function onRequestGet(context) {
  const { DB } = context.env;
  
  const filters = await DB.prepare(
    'SELECT * FROM saved_filters ORDER BY sort_order ASC, created_at DESC'
  ).all();
  
  const parsedFilters = filters.results.map(f => ({
    ...f,
    filter_config: JSON.parse(f.filter_config)
  }));
  
  return ApiResponse.success(parsedFilters);
}

export async function onRequestPost(context) {
  const { DB } = context.env;
  
  const validation = await validateBody(context.request, SavedFilterSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const { name, icon, filter_config } = validation.data;
  
  const result = await DB.prepare(
    'INSERT INTO saved_filters (name, icon, filter_config) VALUES (?, ?, ?)'
  ).bind(name, icon || '⭐', JSON.stringify(filter_config)).run();
  
  const newFilter = await DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  
  return ApiResponse.success({
    ...newFilter,
    filter_config: JSON.parse(newFilter.filter_config)
  });
}
```

- [ ] **Step 2: Create single filter endpoint**

```javascript
// functions/api/filters/[id].js

import { ApiResponse } from '../../_shared/utils.js';
import { validateBody } from '../../_shared/validation.js';
import { SavedFilterUpdateSchema } from '../../_shared/validation.js';

export async function onRequestGet(context) {
  const { DB } = context.env;
  const { id } = context.params;
  
  const filter = await DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(parseInt(id)).first();
  
  if (!filter) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  return ApiResponse.success({
    ...filter,
    filter_config: JSON.parse(filter.filter_config)
  });
}

export async function onRequestPut(context) {
  const { DB } = context.env;
  const { id } = context.params;
  
  const validation = await validateBody(context.request, SavedFilterUpdateSchema);
  if (!validation.success) {
    return ApiResponse.error(validation.error, 400, 'VALIDATION_ERROR');
  }
  
  const existing = await DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(parseInt(id)).first();
  
  if (!existing) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  const { name, icon, filter_config } = validation.data;
  const configStr = filter_config ? JSON.stringify(filter_config) : existing.filter_config;
  
  await DB.prepare(
    'UPDATE saved_filters SET name = ?, icon = ?, filter_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(
    name || existing.name,
    icon || existing.icon,
    configStr,
    parseInt(id)
  ).run();
  
  const updated = await DB.prepare('SELECT * FROM saved_filters WHERE id = ?')
    .bind(parseInt(id)).first();
  
  return ApiResponse.success({
    ...updated,
    filter_config: JSON.parse(updated.filter_config)
  });
}

export async function onRequestDelete(context) {
  const { DB } = context.env;
  const { id } = context.params;
  
  const result = await DB.prepare('DELETE FROM saved_filters WHERE id = ?')
    .bind(parseInt(id)).run();
  
  if (result.meta.changes === 0) {
    return ApiResponse.error('筛选预设不存在', 404, 'FILTER_NOT_FOUND');
  }
  
  return ApiResponse.success({ deleted: true });
}
```

- [ ] **Step 3: Test locally**

Run:
```bash
curl http://127.0.0.1:8788/api/filters
```
Expected: `{ "success": true, "data": [] }`

Run:
```bash
curl -X POST http://127.0.0.1:8788/api/filters \
  -H "Content-Type: application/json" \
  -d '{"name":"工作待办","icon":"⭐","filter_config":{"notebook":"all","tags":["Todo"],"favorite":null,"archived":null,"search":null}}'
```
Expected: Created filter with id

Run validation error test:
```bash
# Missing name
curl -X POST http://127.0.0.1:8788/api/filters \
  -H "Content-Type: application/json" \
  -d '{"icon":"⭐","filter_config":{"notebook":"all"}}'
```
Expected: 400 error

- [ ] **Step 4: Commit**

```bash
git add functions/api/filters.js functions/api/filters/
git commit -m "feat(api): add saved filters CRUD endpoints"
```

---

## Chunk 2: Batch Operations Frontend

### Task 2.1: Add selection mode state and UI

**Files:**
- Modify: `public/script.js` (state variables, selection functions)
- Modify: `public/index.html` (batch bar, select circles on cards)

- [ ] **Step 1: Add state variables**

```javascript
// Add after existing state variables in script.js

// Batch selection
let selectionMode = false;
let selectedMemoIds = new Set();
```

- [ ] **Step 2: Add selection functions**

```javascript
// Add before renderMemos function

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  if (!selectionMode) {
    selectedMemoIds.clear();
  }
  updateBatchBar();
  renderMemos();
}

function toggleMemoSelection(id) {
  if (selectedMemoIds.has(id)) {
    selectedMemoIds.delete(id);
  } else {
    selectedMemoIds.add(id);
  }
  if (selectedMemoIds.size > 0 && !selectionMode) {
    selectionMode = true;
  }
  if (selectedMemoIds.size === 0) {
    selectionMode = false;
  }
  updateBatchBar();
  renderMemos();
}

function selectAllMemos() {
  const visibleMemos = getVisibleMemos();
  visibleMemos.forEach(m => selectedMemoIds.add(m.id));
  updateBatchBar();
  renderMemos();
}

function clearSelection() {
  selectedMemoIds.clear();
  selectionMode = false;
  updateBatchBar();
  renderMemos();
  hideContextMenu();
}

function getVisibleMemos() {
  return memos.filter(m => {
    if (currentNotebook === 'archived') return m.is_archived;
    if (currentNotebook === 'all') return !m.is_archived;
    return m.notebook_id === currentNotebook && !m.is_archived;
  });
}

function updateBatchBar() {
  const batchBar = $('batchBar');
  const batchCount = $('batchCount');
  if (!batchBar) return;
  
  if (selectionMode && selectedMemoIds.size > 0) {
    batchBar.style.display = 'flex';
    batchCount.textContent = `已选择 ${selectedMemoIds.size} 个`;
  } else {
    batchBar.style.display = 'none';
  }
}
```

- [ ] **Step 3: Modify renderMemos to add select circles**

Locate the memo card rendering section. Add select circle button:

```javascript
// In renderMemos, inside the memo card HTML generation
// Add after the opening <article class="memo-card"> tag

const selectedClass = selectedMemoIds.has(memo.id) ? 'selected' : '';
const circleStyle = selectionMode || selectedMemoIds.has(memo.id) ? 'opacity:1' : '';

// In the card HTML:
<article class="memo-card ${selectedClass}" data-memo-id="${memo.id}" tabindex="0">
  <div class="select-circle" style="${circleStyle}" onclick="event.stopPropagation(); toggleMemoSelection(${memo.id})"></div>
  ...
</article>
```

- [ ] **Step 4: Add batch bar HTML**

```html
<!-- Add after main-content in index.html -->

<!-- Batch operation bar -->
<div class="batch-bar" id="batchBar" style="display: none;">
  <span id="batchCount">已选择 0 个</span>
  <button class="btn btn-outline btn-small" onclick="selectAllMemos()">全选</button>
  <button class="btn btn-outline btn-small" onclick="clearSelection()">取消</button>
</div>
```

- [ ] **Step 5: Test selection mode**

Run: Start dev server, open app, hover memo cards, verify circles appear
Expected: Circles visible on hover, clicking enters selection mode

- [ ] **Step 6: Commit**

```bash
git add public/script.js public/index.html
git commit -m "feat(frontend): add selection mode state and UI"
```

---

### Task 2.2: Implement right-click context menu

**Files:**
- Modify: `public/script.js` (context menu functions)
- Modify: `public/index.html` (context menu HTML)

- [ ] **Step 1: Add context menu HTML**

```html
<!-- Add after batch bar in index.html -->

<!-- Batch context menu -->
<div class="context-menu" id="batchContextMenu" style="display: none;">
  <div class="context-item" onclick="batchMoveToNotebook()">移动到笔记本...</div>
  <div class="context-item" onclick="batchArchive()">归档所选</div>
  <div class="context-item" onclick="batchModifyTags()">修改标签...</div>
  <div class="context-item danger" onclick="batchDelete()">删除所选</div>
  <div class="context-divider"></div>
  <div class="context-item" onclick="clearSelection()">取消选择</div>
</div>
```

- [ ] **Step 2: Add context menu functions**

```javascript
// Add after selection functions

function showContextMenu(event) {
  event.preventDefault();
  if (selectedMemoIds.size === 0) return;
  
  const menu = $('batchContextMenu');
  menu.style.display = 'block';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  
  // Adjust position if menu goes off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${event.clientX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${event.clientY - rect.height}px`;
  }
}

function hideContextMenu() {
  const menu = $('batchContextMenu');
  if (menu) menu.style.display = 'none';
}

// Add event listener for context menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu')) {
    hideContextMenu();
  }
});

// Add contextmenu listener to memo cards (in renderMemos or setup)
function setupMemoCardContextMenu(card) {
  card.addEventListener('contextmenu', (e) => {
    if (selectionMode && selectedMemoIds.size > 0) {
      showContextMenu(e);
    }
  });
}
```

- [ ] **Step 3: Update renderMemos to add contextmenu listener**

```javascript
// In renderMemos, after creating each card element
// Add contextmenu listener

card.addEventListener('contextmenu', (e) => {
  if (selectionMode && selectedMemoIds.size > 0) {
    showContextMenu(e);
  }
});
```

- [ ] **Step 4: Test context menu**

Run: Select memos, right-click, verify menu appears
Expected: Menu shows at cursor position with correct options

- [ ] **Step 5: Commit**

```bash
git add public/script.js public/index.html
git commit -m "feat(frontend): add batch context menu"
```

---

### Task 2.3: Implement batch operations logic

**Files:**
- Modify: `public/script.js` (batch action functions, API calls)
- Modify: `public/index.html` (batch tags modal, notebook selector modal)

- [ ] **Step 1: Add batch API function**

```javascript
// Add after existing API functions

async function batchOperation(action, params = {}) {
  const ids = Array.from(selectedMemoIds);
  const body = { action, memo_ids: ids };
  if (params.notebook_id) body.params = { notebook_id: params.notebook_id };
  if (params.mode && params.tags) body.params = { mode: params.mode, tags: params.tags };
  
  const res = await fetch('/api/memos/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  return res.json();
}
```

- [ ] **Step 2: Implement batch archive**

```javascript
// Add after batch API function

async function batchArchive() {
  hideContextMenu();
  if (selectedMemoIds.size === 0) return;
  
  const result = await batchOperation('archive');
  if (result.success) {
    showToast(`已归档 ${result.data.affected} 个备忘录`);
    clearSelection();
    await loadMemos();
  } else {
    showToast(result.error?.message || '归档失败', true);
  }
}
```

- [ ] **Step 3: Implement batch delete with confirmation**

```javascript
// Add after batchArchive

async function batchDelete() {
  hideContextMenu();
  if (selectedMemoIds.size === 0) return;
  
  if (!confirm(`确定删除 ${selectedMemoIds.size} 个备忘录？此操作不可撤销。`)) {
    return;
  }
  
  const result = await batchOperation('delete');
  if (result.success) {
    showToast(`已删除 ${result.data.affected} 个备忘录`);
    clearSelection();
    await loadMemos();
    await loadTags();
  } else {
    showToast(result.error?.message || '删除失败', true);
  }
}
```

- [ ] **Step 4: Add batch tags modal HTML**

```html
<!-- Add after existing modals in index.html -->

<!-- Batch tags modal -->
<div class="modal" id="batchTagsModal">
  <div class="modal-content modal-small">
    <div class="modal-header">
      <h2 id="batchTagsModalTitle">批量修改标签</h2>
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
        <label for="batchTagsInput">标签</label>
        <input type="text" id="batchTagsInput" placeholder="输入标签，逗号分隔..." maxlength="200">
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

- [ ] **Step 5: Implement batch tags functions**

```javascript
// Add after batchDelete

function batchModifyTags() {
  hideContextMenu();
  if (selectedMemoIds.size === 0) return;
  
  $('batchAffectedCount').textContent = selectedMemoIds.size;
  $('batchTagsInput').value = '';
  $('batchTagsModal').classList.add('active');
}

function closeBatchTagsModal() {
  $('batchTagsModal').classList.remove('active');
}

document.getElementById('batchTagsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const mode = document.querySelector('input[name="tagMode"]:checked').value;
  const tags = $('batchTagsInput').value.trim();
  
  if (!tags) {
    showToast('请输入标签', true);
    return;
  }
  
  const result = await batchOperation('tags', { mode, tags });
  if (result.success) {
    showToast(`已修改 ${result.data.affected} 个备忘录的标签`);
    closeBatchTagsModal();
    clearSelection();
    await loadMemos();
    await loadTags();
  } else {
    showToast(result.error?.message || '修改失败', true);
  }
});
```

- [ ] **Step 6: Implement batch move to notebook**

```javascript
// Add after batch tags functions

function batchMoveToNotebook() {
  hideContextMenu();
  if (selectedMemoIds.size === 0) return;
  
  // Use existing notebook selector or create inline selector
  const notebookSelect = document.createElement('select');
  notebookSelect.innerHTML = '<option value="">选择笔记本...</option>' +
    notebooks.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
  
  const modal = $('notebookModal');
  const form = $('notebookForm');
  const title = $('notebookModalTitle');
  
  title.textContent = '移动到笔记本';
  form.innerHTML = `
    <div class="form-group">
      <label for="batchNotebookSelect">目标笔记本</label>
      <select id="batchNotebookSelect" required>
        <option value="">选择笔记本...</option>
        ${notebooks.map(n => `<option value="${n.id}">${n.name}</option>`).join('')}
      </select>
      <small class="form-hint">已选择 ${selectedMemoIds.size} 个备忘录</small>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" onclick="closeNotebookModal()">取消</button>
      <button type="submit" class="btn btn-primary">确认移动</button>
    </div>
  `;
  
  modal.classList.add('active');
  editingNotebookId = 'batch-move'; // Special flag for batch move
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const notebookId = parseInt($('batchNotebookSelect').value);
    if (!notebookId) {
      showToast('请选择笔记本', true);
      return;
    }
    
    const result = await batchOperation('move', { notebook_id: notebookId });
    if (result.success) {
      showToast(`已移动 ${result.data.affected} 个备忘录`);
      closeNotebookModal();
      clearSelection();
      await loadMemos();
    } else {
      showToast(result.error?.message || '移动失败', true);
    }
  };
}
```

- [ ] **Step 7: Test batch operations**

Run: Select multiple memos, right-click, test each action
Expected: All batch operations work correctly

- [ ] **Step 8: Commit**

```bash
git add public/script.js public/index.html
git commit -m "feat(frontend): implement batch operations logic"
```

---

### Task 2.4: Add batch operations styles

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Add batch bar styles**

```css
/* Add to style.css */

/* Batch operation bar */
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

.batch-bar .btn-small {
  padding: 0.25rem 0.75rem;
}

/* Select circle on memo cards */
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
  transition: opacity 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.memo-card:hover .select-circle {
  opacity: 1;
}

.memo-card.selected .select-circle {
  opacity: 1;
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.memo-card.selected .select-circle::after {
  content: '✓';
  color: white;
  font-size: 0.75rem;
}

.memo-card.selected {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add context menu styles**

```css
/* Add after batch bar styles */

/* Context menu */
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  min-width: 160px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  display: none;
}

.context-menu .context-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.1s ease;
}

.context-menu .context-item:hover {
  background: var(--bg-tertiary);
}

.context-menu .context-item.danger {
  color: var(--error-color);
}

.context-menu .context-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.25rem 0;
}
```

- [ ] **Step 3: Add radio group styles for batch tags**

```css
/* Add after context menu styles */

/* Radio group */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: background 0.1s ease;
}

.radio-label:hover {
  background: var(--bg-tertiary);
}

.radio-label input[type="radio"] {
  margin-top: 0.2rem;
}

.radio-label span {
  font-weight: 500;
}

.radio-label .radio-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}
```

- [ ] **Step 4: Test styles**

Run: Verify batch bar, select circles, context menu look correct
Expected: Consistent with existing design

- [ ] **Step 5: Commit**

```bash
git add public/style.css
git commit -m "feat(style): add batch operations styles"
```

---

## Chunk 3: Smart Filters Frontend

### Task 3.1: Add saved filters state and API functions

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Add state variables**

```javascript
// Add after batch selection state

// Saved filters
let savedFilters = [];
let currentFilterPreset = null;
```

- [ ] **Step 2: Add saved filters API functions**

```javascript
// Add after batch API function

async function loadSavedFilters() {
  const res = await fetch('/api/filters');
  const data = await res.json();
  if (data.success) {
    savedFilters = data.data;
    renderSavedFilters();
  }
}

async function saveFilterPreset(name, icon, config) {
  const res = await fetch('/api/filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon, filter_config: config })
  });
  return res.json();
}

async function deleteFilterPreset(id) {
  const res = await fetch(`/api/filters/${id}`, { method: 'DELETE' });
  return res.json();
}

async function updateFilterPreset(id, data) {
  const res = await fetch(`/api/filters/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}
```

- [ ] **Step 3: Call loadSavedFilters on init**

```javascript
// Add to init() function, after loadMemos() and loadTags()

await loadSavedFilters();
```

- [ ] **Step 4: Commit**

```bash
git add public/script.js
git commit -m "feat(frontend): add saved filters state and API functions"
```

---

### Task 3.2: Implement sidebar saved filters list

**Files:**
- Modify: `public/script.js` (renderSavedFilters)
- Modify: `public/index.html` (sidebar section)

- [ ] **Step 1: Add sidebar section HTML**

```html
<!-- Add after notebook-section, before tags-section in index.html -->

<!-- Saved filters section -->
<div class="saved-filters-section" id="savedFiltersSection">
  <div class="sidebar-label">
    <h2>已保存的筛选</h2>
  </div>
  <div class="saved-filters-list" id="savedFiltersList"></div>
  <button class="btn btn-outline btn-small btn-block" id="saveFilterBtn" onclick="openSaveFilterModal()">
    + 保存当前筛选
  </button>
</div>
```

- [ ] **Step 2: Implement renderSavedFilters**

```javascript
// Add after loadSavedFilters

function renderSavedFilters() {
  const list = $('savedFiltersList');
  if (!list) return;
  
  if (savedFilters.length === 0) {
    list.innerHTML = '<p class="empty-hint">暂无筛选预设</p>';
    return;
  }
  
  // Only show first 10
  const displayFilters = savedFilters.slice(0, 10);
  
  list.innerHTML = displayFilters.map(f => `
    <div class="saved-filter-item ${currentFilterPreset === f.id ? 'active' : ''}" 
         data-filter-id="${f.id}"
         onclick="applyFilterPreset(${f.id})">
      <span class="filter-icon">${f.icon}</span>
      <span class="filter-name">${f.name}</span>
      <button class="filter-delete" onclick="event.stopPropagation(); confirmDeleteFilter(${f.id})">×</button>
    </div>
  `).join('');
}

function applyFilterPreset(id) {
  const filter = savedFilters.find(f => f.id === id);
  if (!filter) return;
  
  currentFilterPreset = id;
  const config = filter.filter_config;
  
  // Apply filter config
  if (config.notebook !== null) {
    currentNotebook = config.notebook;
    currentFilter.notebook = config.notebook;
  }
  if (config.tags !== null) {
    currentFilter.tags = config.tags.join(',');
  }
  if (config.favorite !== null) {
    currentFilter.favorite = config.favorite;
  }
  if (config.archived !== null) {
    currentFilter.archived = config.archived;
  }
  if (config.search !== null) {
    currentFilter.search = config.search;
    $('searchInput').value = config.search;
  }
  
  renderNotebooks();
  renderSavedFilters();
  renderTags();
  loadMemos();
}

function confirmDeleteFilter(id) {
  const filter = savedFilters.find(f => f.id === id);
  if (!filter) return;
  
  if (confirm(`确定删除筛选预设「${filter.name}」？`)) {
    deleteFilterPreset(id).then(result => {
      if (result.success) {
        savedFilters = savedFilters.filter(f => f.id !== id);
        if (currentFilterPreset === id) {
          currentFilterPreset = null;
        }
        renderSavedFilters();
        showToast('筛选预设已删除');
      }
    });
  }
}
```

- [ ] **Step 3: Add sidebar styles**

```css
/* Add to style.css */

/* Saved filters section */
.saved-filters-section {
  margin-bottom: 1.5rem;
}

.saved-filters-list {
  margin-bottom: 0.5rem;
}

.saved-filter-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s ease;
}

.saved-filter-item:hover {
  background: var(--bg-tertiary);
}

.saved-filter-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
}

.saved-filter-item .filter-icon {
  font-size: 1rem;
}

.saved-filter-item .filter-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-filter-item .filter-delete {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  transition: opacity 0.1s ease;
}

.saved-filter-item:hover .filter-delete {
  opacity: 1;
}

.saved-filter-item .filter-delete:hover {
  color: var(--error-color);
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.5rem;
}
```

- [ ] **Step 4: Test saved filters list**

Run: Create filter via API, verify sidebar shows it
Expected: Filter appears, clicking applies it, delete works

- [ ] **Step 5: Commit**

```bash
git add public/script.js public/index.html public/style.css
git commit -m "feat(frontend): implement saved filters sidebar list"
```

---

### Task 3.3: Implement save filter modal

**Files:**
- Modify: `public/script.js` (modal functions)
- Modify: `public/index.html` (modal HTML)

- [ ] **Step 1: Add save filter modal HTML**

```html
<!-- Add after batchTagsModal in index.html -->

<!-- Save filter modal -->
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
        <label>图标</label>
        <div class="icon-presets">
          <button type="button" class="icon-preset selected" data-icon="⭐">⭐</button>
          <button type="button" class="icon-preset" data-icon="📋">📋</button>
          <button type="button" class="icon-preset" data-icon="🔔">🔔</button>
          <button type="button" class="icon-preset" data-icon="📌">📌</button>
          <button type="button" class="icon-preset" data-icon="💼">💼</button>
          <button type="button" class="icon-preset" data-icon="🎯">🎯</button>
        </div>
        <input type="hidden" id="filterIcon" value="⭐">
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
```

- [ ] **Step 2: Implement modal functions**

```javascript
// Add after renderSavedFilters

let selectedFilterIcon = '⭐';

function openSaveFilterModal() {
  $('filterName').value = '';
  selectedFilterIcon = '⭐';
  $('filterIcon').value = '⭐';
  
  // Update icon preset selection
  document.querySelectorAll('.icon-preset').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.icon === '⭐');
  });
  
  // Show current conditions
  const conditions = [];
  if (currentNotebook !== 'all' && currentNotebook !== 'archived') {
    const notebook = notebooks.find(n => n.id === currentNotebook);
    conditions.push(`笔记本: ${notebook?.name || currentNotebook}`);
  }
  if (currentFilter.tags) {
    conditions.push(`标签: ${currentFilter.tags}`);
  }
  if (currentFilter.favorite) {
    conditions.push('收藏');
  }
  if (currentFilter.search) {
    conditions.push(`搜索: ${currentFilter.search}`);
  }
  
  $('filterConditions').innerHTML = conditions.length > 0 
    ? conditions.map(c => `<p class="condition-item">• ${c}</p>`).join('')
    : '<p class="empty-hint">当前无筛选条件</p>';
  
  $('saveFilterModal').classList.add('active');
}

function closeSaveFilterModal() {
  $('saveFilterModal').classList.remove('active');
}

// Icon preset click handler
document.querySelectorAll('.icon-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.icon-preset').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFilterIcon = btn.dataset.icon;
    $('filterIcon').value = selectedFilterIcon;
  });
});

// Form submit
document.getElementById('saveFilterForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Check 10 preset limit
  if (savedFilters.length >= 10) {
    showToast('已达到筛选预设上限（10个），请删除后再添加', true);
    return;
  }
  
  const name = $('filterName').value.trim();
  if (!name) {
    showToast('请输入名称', true);
    return;
  }
  
  const config = {
    notebook: currentNotebook === 'archived' ? null : currentNotebook,
    tags: currentFilter.tags ? currentFilter.tags.split(',').map(t => t.trim()).filter(t => t) : null,
    favorite: currentFilter.favorite || null,
    archived: currentNotebook === 'archived' ? true : null,
    search: currentFilter.search || null
  };
  
  const result = await saveFilterPreset(name, selectedFilterIcon, config);
  if (result.success) {
    savedFilters.push(result.data);
    renderSavedFilters();
    closeSaveFilterModal();
    showToast('筛选预设已保存');
  } else {
    showToast(result.error?.message || '保存失败', true);
  }
});
```

- [ ] **Step 3: Add icon preset styles**

```css
/* Add to style.css */

/* Icon presets */
.icon-presets {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.icon-preset {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-preset:hover {
  border-color: var(--primary-color);
}

.icon-preset.selected {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

/* Filter conditions preview */
.filter-conditions-preview {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.filter-conditions-preview .condition-item {
  margin: 0.25rem 0;
}
```

- [ ] **Step 4: Test save filter modal**

Run: Set some filters, click save button, create preset
Expected: Modal shows current conditions, saves correctly

- [ ] **Step 5: Commit**

```bash
git add public/script.js public/index.html public/style.css
git commit -m "feat(frontend): implement save filter modal"
```

---

### Task 3.4: Handle filter preset clearing

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Clear preset when clicking "全部笔记"**

```javascript
// Modify the notebook click handler to clear currentFilterPreset

function selectNotebook(id) {
  currentNotebook = id;
  currentFilterPreset = null; // Clear preset when manually selecting notebook
  currentFilter.notebook = id;
  currentFilter.archived = false;
  renderNotebooks();
  renderSavedFilters();
  loadMemos();
}
```

- [ ] **Step 2: Clear preset on manual filter change**

```javascript
// Add preset clearing to manual filter changes

// In search input handler:
$('searchInput').addEventListener('input', debounce(() => {
  currentFilter.search = $('searchInput').value;
  currentFilterPreset = null; // Clear preset
  renderSavedFilters();
  loadMemos();
}, 300));

// In tag filter change:
function filterByTag(tag) {
  currentFilter.tags = tag;
  currentFilterPreset = null; // Clear preset
  renderSavedFilters();
  loadMemos();
}

// In favorite filter change:
function toggleFavoriteFilter() {
  currentFilter.favorite = !currentFilter.favorite;
  currentFilterPreset = null; // Clear preset
  renderSavedFilters();
  loadMemos();
}
```

- [ ] **Step 3: Test preset clearing**

Run: Apply preset, click "全部笔记", verify preset cleared
Expected: Preset highlight removed, filters reset

- [ ] **Step 4: Commit**

```bash
git add public/script.js
git commit -m "feat(frontend): clear filter preset on manual changes"
```

---

## Chunk 4: E2E Tests

### Task 4.1: Batch operations E2E tests

**Files:**
- Create: `e2e/batch.spec.ts`

- [ ] **Step 1: Create test file**

```typescript
// e2e/batch.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Batch Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for memos to load
    await page.waitForSelector('.memo-card');
  });

  test('进入选择模式', async ({ page }) => {
    // Hover first memo card to show select circle
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    
    // Select circle should appear
    const selectCircle = firstCard.locator('.select-circle');
    await expect(selectCircle).toBeVisible();
    
    // Click to select
    await selectCircle.click();
    
    // Card should have selected class
    await expect(firstCard).toHaveClass(/selected/);
    
    // Batch bar should appear
    await expect(page.locator('.batch-bar')).toBeVisible();
    await expect(page.locator('#batchCount')).toContainText('已选择 1 个');
  });

  test('选择多个备忘录', async ({ page }) => {
    const cards = page.locator('.memo-card');
    const firstCard = cards.first();
    const secondCard = cards.nth(1);
    
    // Select first card
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Select second card
    await secondCard.hover();
    await secondCard.locator('.select-circle').click();
    
    // Batch bar should show 2 selected
    await expect(page.locator('#batchCount')).toContainText('已选择 2 个');
    
    // Both should be selected
    await expect(firstCard).toHaveClass(/selected/);
    await expect(secondCard).toHaveClass(/selected/);
  });

  test('全选功能', async ({ page }) => {
    // Enter selection mode
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Click "全选"
    await page.locator('.batch-bar').locator('button', { hasText: '全选' }).click();
    
    // All visible cards should be selected
    const visibleCards = await page.locator('.memo-card.selected').count();
    expect(visibleCards).toBeGreaterThan(1);
  });

  test('取消选择', async ({ page }) => {
    // Select a card
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Click cancel
    await page.locator('.batch-bar').locator('button', { hasText: '取消' }).click();
    
    // No cards should be selected
    await expect(page.locator('.memo-card.selected')).toHaveCount(0);
    
    // Batch bar should be hidden
    await expect(page.locator('.batch-bar')).toBeHidden();
  });

  test('右键菜单显示', async ({ page }) => {
    // Select a card
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Right-click on any card
    await firstCard.click({ button: 'right' });
    
    // Context menu should appear
    await expect(page.locator('.context-menu')).toBeVisible();
    
    // Menu items should be present
    await expect(page.locator('.context-item', { hasText: '归档所选' })).toBeVisible();
    await expect(page.locator('.context-item', { hasText: '删除所选' })).toBeVisible();
  });

  test('批量归档', async ({ page }) => {
    // Create a test memo first if needed
    // Select it
    const firstCard = page.locator('.memo-card').first();
    const memoId = await firstCard.getAttribute('data-memo-id');
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Right-click and select archive
    await firstCard.click({ button: 'right' });
    await page.locator('.context-item', { hasText: '归档所选' }).click();
    
    // Wait for toast
    await expect(page.locator('.toast')).toBeVisible();
    
    // Card should no longer be in main list
    await expect(page.locator(`.memo-card[data-memo-id="${memoId}"]`)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/batch.spec.ts`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/batch.spec.ts
git commit -m "test(e2e): add batch operations tests"
```

---

### Task 4.2: Saved filters E2E tests

**Files:**
- Create: `e2e/saved-filters.spec.ts`

- [ ] **Step 1: Create test file**

```typescript
// e2e/saved-filters.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Saved Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card');
  });

  test('显示已保存筛选区域', async ({ page }) => {
    // Saved filters section should exist
    await expect(page.locator('.saved-filters-section')).toBeVisible();
    
    // Save button should exist
    await expect(page.locator('#saveFilterBtn')).toBeVisible();
    
    // Empty hint if no filters
    const filtersCount = await page.locator('.saved-filter-item').count();
    if (filtersCount === 0) {
      await expect(page.locator('.saved-filters-list .empty-hint')).toBeVisible();
    }
  });

  test('保存筛选预设', async ({ page }) => {
    // Set some filter condition (e.g., search)
    await page.locator('#searchInput').fill('test');
    await page.waitForTimeout(500); // Wait for debounce
    
    // Click save button
    await page.locator('#saveFilterBtn').click();
    
    // Modal should appear
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    
    // Enter name
    await page.locator('#filterName').fill(`测试筛选 ${Date.now()}`);
    
    // Select icon
    await page.locator('.icon-preset[data-icon="📋"]').click();
    
    // Submit
    await page.locator('#saveFilterForm button[type="submit"]').click();
    
    // Wait for toast
    await expect(page.locator('.toast')).toBeVisible();
    
    // New filter should appear in list
    await expect(page.locator('.saved-filter-item').first()).toBeVisible();
  });

  test('应用筛选预设', async ({ page }) => {
    // First create a filter
    await page.locator('#searchInput').fill('unique-test-keyword');
    await page.waitForTimeout(500);
    await page.locator('#saveFilterBtn').click();
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    await page.locator('#filterName').fill(`应用测试 ${Date.now()}`);
    await page.locator('#saveFilterForm button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    // Clear the search manually
    await page.locator('#searchInput').clear();
    await page.waitForTimeout(500);
    
    // Click on the saved filter
    await page.locator('.saved-filter-item').first().click();
    
    // Search input should show the saved search term
    await expect(page.locator('#searchInput')).toHaveValue('unique-test-keyword');
    
    // Filter item should be active
    await expect(page.locator('.saved-filter-item').first()).toHaveClass(/active/);
  });

  test('删除筛选预设', async ({ page }) => {
    // First create a filter
    await page.locator('#saveFilterBtn').click();
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    const filterName = `待删除 ${Date.now()}`;
    await page.locator('#filterName').fill(filterName);
    await page.locator('#saveFilterForm button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    // Find the filter and click delete
    const filterItem = page.locator('.saved-filter-item', { hasText: filterName });
    await filterItem.hover();
    await filterItem.locator('.filter-delete').click();
    
    // Confirm deletion
    page.on('dialog', dialog => dialog.accept());
    
    // Filter should be removed
    await expect(filterItem).toHaveCount(0);
  });

  test('点击全部笔记清除预设', async ({ page }) => {
    // Create and apply a filter
    await page.locator('#searchInput').fill('test-clear');
    await page.waitForTimeout(500);
    await page.locator('#saveFilterBtn').click();
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    await page.locator('#filterName').fill('清除测试');
    await page.locator('#saveFilterForm button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    // Apply the filter
    await page.locator('.saved-filter-item', { hasText: '清除测试' }).click();
    await expect(page.locator('.saved-filter-item', { hasText: '清除测试' })).toHaveClass(/active/);
    
    // Click "全部笔记"
    await page.locator('.notebook-item', { hasText: '全部笔记' }).click();
    
    // Preset should no longer be active
    await expect(page.locator('.saved-filter-item.active')).toHaveCount(0);
    
    // Search should be cleared
    await expect(page.locator('#searchInput')).toHaveValue('');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/saved-filters.spec.ts`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/saved-filters.spec.ts
git commit -m "test(e2e): add saved filters tests"
```

---

## Final Verification

- [ ] **Run all E2E tests**

Run: `npx playwright test`
Expected: All M2 tests pass

- [ ] **Apply migration to production**

Run: `npx wrangler d1 migrations apply memo-db --remote`

- [ ] **Deploy to production**

Run: `npm run deploy`

- [ ] **Verify on production**

Open: https://main.memo-app-1xs.pages.dev
Check: Batch operations and saved filters work

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(M2): batch operations and smart filters complete"
```