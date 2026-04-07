// State
let memos = [];
let tags = [];
let notebooks = [];
let currentNotebook = 'all'; // 'all' | notebook_id | 'archived'
let currentMemo = null;
let currentFilter = { search: '', tag: '', notebook: 'all', archived: false, favorite: false };
let isPreviewMode = false;
let editingNotebookId = null;
let restoreMemoId = null;

// Batch selection
let selectionMode = false;
let selectedMemoIds = new Set();

// Saved filters
let savedFilters = [];
let currentFilterPreset = null;
let selectedFilterIcon = '⭐';

// Pagination
let pagination = { page: 1, limit: 50, total: 0, hasMore: false };

// Draft
let draftTimer = null;
const DRAFT_KEY = 'memo-draft';
const DRAFT_DELAY = 1000;

// Undo
let lastDeleted = null;
const UNDO_TIMEOUT = 5000;

// Templates
let templates = [];

// View mode
let viewMode = localStorage.getItem('viewMode') || 'card'; // 'card' | 'list'

// Auto-save indicator
let autoSaveIndicator = null;
let autoSaveTimeout = null;

// Gesture state
let gestureState = {
  startX: 0,
  startY: 0,
  currentX: 0,
  isDragging: false,
  targetCard: null
};

// Performance: Cache for parsed markdown
const markdownCache = new Map();
const MARKDOWN_CACHE_MAX_SIZE = 100;

// DOM cache
const $ = (() => {
  const cache = {};
  return id => {
    if (!cache[id]) cache[id] = document.getElementById(id);
    return cache[id];
  };
})();
const dom = {
  memosGrid: null,
  emptyState: null,
  searchInput: null,
  searchClear: null,
  tagFilter: null,
  favoritesFilter: null,
  newMemoBtn: null,
  newTagBtn: null,
  themeToggle: null,
  exportBtn: null,
  totalMemos: null,
  totalTags: null,
  tagsList: null,
  memoModal: null,
  tagModal: null,
  loading: null,
  toastContainer: null,
  notebooksList: null,
  notebookModal: null,
  notebookSelect: null,
  restoreModal: null,
  includeArchived: null
};

// Initialize DOM cache
function initDomCache() {
  dom.memosGrid = $('memosGrid');
  dom.emptyState = $('emptyState');
  dom.searchInput = $('searchInput');
  dom.searchClear = $('searchClear');
  dom.tagFilter = $('tagFilter');
  dom.favoritesFilter = $('favoritesFilter');
  dom.newMemoBtn = $('newMemoBtn');
  dom.newTagBtn = $('newTagBtn');
  dom.themeToggle = $('themeToggle');
  dom.exportBtn = $('exportBtn');
  dom.totalMemos = $('totalMemos');
  dom.totalTags = $('totalTags');
  dom.tagsList = $('tagsList');
  dom.memoModal = $('memoModal');
  dom.tagModal = $('tagModal');
  dom.loading = $('loading');
  dom.toastContainer = $('toastContainer');
  dom.notebooksList = $('notebooksList');
  dom.notebookModal = $('notebookModal');
  dom.notebookSelect = $('notebookSelect');
  dom.restoreModal = $('restoreModal');
  dom.includeArchived = $('includeArchived');
}

// Auth state
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initDomCache();
  initTheme();
  
  // Check authentication first
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return; // Will redirect to login page
  }
  
  loadDraft();
  setupEvents();
  await loadData();
});

// Check authentication status
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/status');
    const result = await response.json();
    
    if (result.success && result.data?.authenticated) {
      currentUser = result.data;
      return true;
    } else {
      // Not authenticated - redirect to login
      window.location.href = '/login.html';
      return false;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/login.html';
    return false;
  }
}

// Logout
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout failed:', error);
    // Still redirect even if logout API fails
    window.location.href = '/login.html';
  }
}

// Theme
function initTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const use = dom.themeToggle.querySelector('use');
  use.setAttribute('href', theme === 'dark' ? '#icon-sun' : '#icon-moon');
}

// Scroll - throttled for performance
const throttledHandleScroll = throttle(handleScroll, 150);
function setupEvents() {
  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.searchInput.addEventListener('input', debounce(handleSearch, 300, 'search'));
  dom.searchClear.addEventListener('click', clearSearch);
  dom.tagFilter.addEventListener('change', handleTagFilter);
  dom.favoritesFilter.addEventListener('click', toggleFavoriteFilter);
  dom.newMemoBtn.addEventListener('click', () => openMemoModal());
  dom.newTagBtn.addEventListener('click', openTagModal);
  dom.exportBtn.addEventListener('click', exportMemos);

  $('modalClose').addEventListener('click', closeMemoModal);
  $('cancelBtn').addEventListener('click', closeMemoModal);
  $('memoForm').addEventListener('submit', handleMemoSubmit);
  $('tagForm').addEventListener('submit', handleTagSubmit);
  $('notebookForm').addEventListener('submit', handleNotebookSubmit);

  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', e => $('tagColor').value = e.target.dataset.color);
  });

  // Icon preset buttons
  document.querySelectorAll('.icon-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('notebookIcon').value = btn.dataset.icon;
    });
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('editor-tab')) {
      switchTab(e.target);
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'memoContent' || e.target.id === 'memoTitle' || e.target.id === 'memoTags') {
      if (isPreviewMode) updatePreview();
      saveDraft();
    }
  });

  dom.tagModal.addEventListener('click', e => {
    if (e.target === dom.tagModal) closeTagModal();
  });

  dom.notebookModal.addEventListener('click', e => {
    if (e.target === dom.notebookModal) closeNotebookModal();
  });

  dom.restoreModal.addEventListener('click', e => {
    if (e.target === dom.restoreModal) closeRestoreModal();
  });

  $('saveFilterModal')?.addEventListener('click', e => {
    if (e.target === $('saveFilterModal')) closeSaveFilterModal();
  });

  $('batchTagsModal')?.addEventListener('click', e => {
    if (e.target === $('batchTagsModal')) closeBatchTagsModal();
  });

  // Filter icon preset buttons
  document.querySelectorAll('#saveFilterModal .icon-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#saveFilterModal .icon-preset').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFilterIcon = btn.dataset.icon;
      $('filterIcon').value = selectedFilterIcon;
    });
  });

  // Save filter form submit
  $('saveFilterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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

  // Batch tags form submit
  $('batchTagsForm')?.addEventListener('submit', async (e) => {
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

  // Click outside to hide context menu
  document.addEventListener('click', e => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMemoModal();
      closeTagModal();
      closeNotebookModal();
      closeRestoreModal();
      closeSaveFilterModal();
      closeBatchTagsModal();
      hideContextMenu();
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'n') { e.preventDefault(); openMemoModal(); }
      if (e.key === 'f') { e.preventDefault(); dom.searchInput.focus(); }
      const textarea = $('memoContent');
      if (e.target === textarea) {
        if (e.key === 'b') { e.preventDefault(); insertMd('**', '**'); }
        if (e.key === 'i') { e.preventDefault(); insertMd('*', '*'); }
        if (e.key === 'k') { e.preventDefault(); insertMd('[', '](url)'); }
      }
    }
  });

  window.addEventListener('scroll', throttledHandleScroll, { passive: true });
}

// Debounce with unique ID for cleanup
const timers = new Map();
function debounce(fn, wait, id = 'default') {
  return (...args) => {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      fn(...args);
    }, wait));
  };
}

// Throttle for scroll events
function throttle(fn, wait) {
  let timeout = null;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (timeout) return;
    timeout = setTimeout(() => {
      timeout = null;
      fn(...lastArgs);
    }, wait);
  };
}

// Editor
function switchTab(tab) {
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  const textarea = $('memoContent');
  const preview = $('markdownPreview');

  if (tab.dataset.tab === 'write') {
    isPreviewMode = false;
    textarea.style.display = 'block';
    preview.style.display = 'none';
  } else {
    isPreviewMode = true;
    textarea.style.display = 'none';
    preview.style.display = 'block';
    updatePreview();
  }
}

function updatePreview() {
  $('markdownPreview').innerHTML = parseMarkdown($('memoContent').value);
}

function insertMd(before, after = '') {
  const textarea = $('memoContent');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value.substring(start, end);
  textarea.value = textarea.value.substring(0, start) + before + text + after + textarea.value.substring(end);
  textarea.focus();
  if (isPreviewMode) updatePreview();
  saveDraft();
}

// Draft
function saveDraft() {
  clearTimeout(draftTimer);
  showAutoSaveIndicator('saving');
  draftTimer = setTimeout(() => {
    const draft = {
      title: $('memoTitle').value,
      content: $('memoContent').value,
      tags: $('memoTags').value,
      is_favorite: $('memoFavorite').checked,
      savedAt: new Date().toISOString()
    };
    if (draft.content || draft.title) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      showAutoSaveIndicator('saved');
    }
  }, DRAFT_DELAY);
}

function loadDraft() {
  try {
    const json = localStorage.getItem(DRAFT_KEY);
    if (!json) return null;
    const draft = JSON.parse(json);
    const hours = (Date.now() - new Date(draft.savedAt)) / (1000 * 60 * 60);
    if (hours > 24) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

// Data
async function loadData() {
  showLoading(true);
  try {
    await Promise.all([loadMemos(), loadTags(), loadNotebooks(), loadSavedFilters(), loadTemplates()]);
    updateStats();
    updateViewToggleIcon();
    renderMemos();
    renderTags();
    renderNotebooks();
  } catch (e) {
    showToast('加载失败', 'error');
  } finally {
    showLoading(false);
  }
}

async function loadMemos(append = false) {
  const params = new URLSearchParams();
  params.set('page', pagination.page);
  params.set('limit', pagination.limit);
  if (currentFilter.search) params.set('search', currentFilter.search);
  if (currentFilter.tag) params.set('tag', currentFilter.tag);
  if (currentFilter.favorite) params.set('favorite', 'true');
  if (currentFilter.notebook && currentFilter.notebook !== 'all') {
    params.set('notebook', currentFilter.notebook);
  }
  if (currentFilter.archived) {
    params.set('archived', 'true');
  }

  const res = await fetch(`/api/memos?${params}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error?.message);

  memos = append ? [...memos, ...data.data.memos] : data.data.memos;
  pagination = { ...pagination, ...data.data.pagination };
}

async function loadMoreMemos() {
  if (!pagination.hasMore) return;
  pagination.page++;
  showLoading(true);
  try {
    await loadMemos(true);
    renderMemos(true);
  } catch (e) {
    pagination.page--;
  } finally {
    showLoading(false);
  }
}

async function loadTags() {
  const res = await fetch('/api/tags');
  const data = await res.json();
  tags = res.ok ? data.data : [];
  updateTagFilter();
}

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
    showToast('笔记本已更新', 'success');
  }
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

async function archiveMemo(id) {
  const res = await fetch(`/api/memos/${id}/archive`, { method: 'POST' });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);

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
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);

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

function updateNotebookCounts() {
  loadNotebooks().then(() => renderNotebooks());
}

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

function showNotebookMenu(event, id) {
  event.preventDefault();
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

// Notebook Modal
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

// Restore Modal
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

// Scroll
function handleScroll() {
  if (!pagination.hasMore) return;
  const { scrollY, innerHeight } = window;
  const height = document.documentElement.scrollHeight;
  if (scrollY + innerHeight >= height * 0.8) {
    loadMoreMemos();
  }
}

// Search & Filter
function handleSearch(e) {
  currentFilter.search = e.target.value.toLowerCase();
  dom.searchClear.style.display = e.target.value ? 'block' : 'none';
  resetAndLoad();
}

function clearSearch() {
  dom.searchInput.value = '';
  currentFilter.search = '';
  dom.searchClear.style.display = 'none';
  resetAndLoad();
}

function handleTagFilter(e) {
  currentFilter.tag = e.target.value;
  resetAndLoad();
}

function toggleFavoriteFilter() {
  currentFilter.favorite = !currentFilter.favorite;
  dom.favoritesFilter.classList.toggle('btn-primary', currentFilter.favorite);
  dom.favoritesFilter.classList.toggle('btn-outline', !currentFilter.favorite);
  resetAndLoad();
}

function resetAndLoad() {
  pagination.page = 1;
  memos = [];
  loadMemos().then(() => {
    renderMemos();
    updateStats();
  });
}

// Memo CRUD
async function createMemo(data) {
  const res = await fetch('/api/memos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);

  memos.unshift(result.data);
  pagination.total++;
  renderMemos();
  updateStats();
  clearDraft();
  showToast('已创建', 'success');
  
  // Track activity
  trackActivity('memo_created', { tags: result.data.tags?.split(',').map(t => t.trim()) || [] });
  
  return result.data;
}

async function updateMemo(id, data) {
  const res = await fetch(`/api/memos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);

  const idx = memos.findIndex(m => m.id === parseInt(id));
  if (idx !== -1) {
    memos[idx] = result.data;
    renderMemos();
    showToast('已更新', 'success');
  }
  clearDraft();
  
  // Track activity
  trackActivity('memo_edited', { tags: result.data.tags?.split(',').map(t => t.trim()) || [] });
  
  return result.data;
}

async function deleteMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;

  lastDeleted = { id, memo: { ...memo } };
  memos = memos.filter(m => m.id !== id);
  pagination.total--;
  renderMemos();
  updateStats();

  showToastWithAction('已删除', 'warning', '撤销', undoDelete);

  setTimeout(async () => {
    if (lastDeleted && lastDeleted.id === id) {
      try {
        await fetch(`/api/memos/${id}`, { method: 'DELETE' });
        lastDeleted = null;
      } catch (e) {
        memos.unshift(lastDeleted.memo);
        pagination.total++;
        renderMemos();
        updateStats();
        showToast('删除失败', 'error');
      }
    }
  }, UNDO_TIMEOUT);
}

function undoDelete() {
  if (!lastDeleted) return;
  memos.unshift(lastDeleted.memo);
  pagination.total++;
  renderMemos();
  updateStats();
  lastDeleted = null;
  showToast('已恢复', 'success');
}

async function toggleFavorite(id) {
  const memo = memos.find(m => m.id === id);
  if (memo) {
    await updateMemo(id, { ...memo, is_favorite: !memo.is_favorite });
  }
}

async function togglePinned(id) {
  const memo = memos.find(m => m.id === id);
  if (memo) {
    const newPinnedState = !memo.is_pinned;
    
    // Optimistic update
    memo.is_pinned = newPinnedState;
    
    // Send partial update
    const res = await fetch(`/api/memos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: newPinnedState })
    });
    
    const result = await res.json();
    if (!res.ok) {
      // Revert on error
      memo.is_pinned = !newPinnedState;
      showToast(result.error?.message || '操作失败', 'error');
      return;
    }
    
    // Update memo in array and re-render
    const idx = memos.findIndex(m => m.id === id);
    if (idx !== -1) {
      memos[idx] = result.data;
    }
    
    // Re-sort: pinned first
    memos.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    
    renderMemos();
    showToast(newPinnedState ? '已置顶' : '已取消置顶', 'success');
  }
}

// View mode toggle
function toggleViewMode() {
  viewMode = viewMode === 'card' ? 'list' : 'card';
  localStorage.setItem('viewMode', viewMode);
  updateViewToggleIcon();
  renderMemos();
}

function updateViewToggleIcon() {
  const btn = document.querySelector('.view-toggle');
  if (btn) {
    btn.innerHTML = viewMode === 'card' 
      ? '<svg class="icon"><use href="#icon-list"/></svg>'
      : '<svg class="icon"><use href="#icon-grid"/></svg>';
    btn.title = viewMode === 'card' ? '列表视图' : '卡片视图';
  }
}

// Gesture handling
function setupGestureListeners() {
  const cards = document.querySelectorAll('.memo-card');
  cards.forEach(card => {
    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove', handleTouchMove, { passive: false });
    card.addEventListener('touchend', handleTouchEnd);
  });
}

function handleTouchStart(e) {
  if (selectionMode) return;
  
  const touch = e.touches[0];
  gestureState.startX = touch.clientX;
  gestureState.startY = touch.clientY;
  gestureState.currentX = touch.clientX;
  gestureState.isDragging = false;
  gestureState.targetCard = e.currentTarget;
}

function handleTouchMove(e) {
  if (!gestureState.targetCard || selectionMode) return;
  
  const touch = e.touches[0];
  const deltaX = touch.clientX - gestureState.startX;
  const deltaY = touch.clientY - gestureState.startY;
  
  // Only handle horizontal swipes
  if (Math.abs(deltaY) > Math.abs(deltaX)) return;
  
  gestureState.isDragging = true;
  gestureState.currentX = touch.clientX;
  
  // Apply transform
  const card = gestureState.targetCard;
  if (deltaX < 0) {
    // Left swipe - show delete action
    card.style.transform = `translateX(${Math.max(deltaX, -100)}px)`;
    card.style.transition = 'none';
  }
}

function handleTouchEnd(e) {
  if (!gestureState.targetCard || !gestureState.isDragging) {
    gestureState = { startX: 0, startY: 0, currentX: 0, isDragging: false, targetCard: null };
    return;
  }
  
  const deltaX = gestureState.currentX - gestureState.startX;
  const card = gestureState.targetCard;
  const memoId = parseInt(card.dataset.memoId);
  
  card.style.transition = 'transform 0.3s ease';
  card.style.transform = '';
  
  // If swiped more than 80px left, show action menu
  if (deltaX < -80) {
    showSwipeActions(memoId, card);
  }
  
  gestureState = { startX: 0, startY: 0, currentX: 0, isDragging: false, targetCard: null };
}

function showSwipeActions(memoId, card) {
  // Create action overlay
  const existing = document.querySelector('.swipe-actions');
  if (existing) existing.remove();
  
  const memo = memos.find(m => m.id === memoId);
  if (!memo) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'swipe-actions';
  overlay.innerHTML = `
    <button onclick="archiveMemo(${memoId})" class="swipe-btn archive">
      <svg class="icon"><use href="#icon-archive"/></svg>
      归档
    </button>
    <button onclick="toggleFavorite(${memoId})" class="swipe-btn favorite ${memo.is_favorite ? 'active' : ''}">
      <svg class="icon"><use href="#icon-star${memo.is_favorite ? '' : '-empty'}"/></svg>
      ${memo.is_favorite ? '取消收藏' : '收藏'}
    </button>
    <button onclick="deleteMemo(${memoId})" class="swipe-btn delete">
      <svg class="icon"><use href="#icon-trash"/></svg>
      删除
    </button>
  `;
  
  card.appendChild(overlay);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 300);
  }, 3000);
}

// Template functions
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    const data = await res.json();
    if (data.success) {
      templates = data.data || [];
      renderTemplateSelector();
    }
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
}

function renderTemplateSelector() {
  const selector = $('templateSelector');
  if (!selector) return;
  
  selector.innerHTML = templates.length > 0 
    ? templates.map(t => `
        <div class="template-item" onclick="applyTemplate(${t.id})">
          <div class="template-name">${escapeHtml(t.name)}</div>
          ${t.is_default ? '<span class="template-default">默认</span>' : ''}
        </div>
      `).join('')
    : '<div class="template-empty">暂无模板</div>';
}

function applyTemplate(templateId) {
  const template = templates.find(t => t.id === templateId);
  if (template) {
    $('memoContent').value = template.content || '';
    $('memoTags').value = template.tags || '';
    updatePreview();
    showToast(`已应用模板：${template.name}`, 'success');
  }
  closeTemplateSelector();
}

function openTemplateSelector() {
  const modal = $('templateModal');
  if (modal) modal.classList.add('active');
}

function closeTemplateSelector() {
  const modal = $('templateModal');
  if (modal) modal.classList.remove('active');
}

// Auto-save indicator
function showAutoSaveIndicator(status = 'saving') {
  if (!autoSaveIndicator) {
    autoSaveIndicator = document.createElement('div');
    autoSaveIndicator.className = 'autosave-indicator';
    document.body.appendChild(autoSaveIndicator);
  }
  
  autoSaveIndicator.className = `autosave-indicator ${status}`;
  autoSaveIndicator.textContent = status === 'saving' ? '正在保存...' : '已保存';
  autoSaveIndicator.classList.add('visible');
  
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    autoSaveIndicator.classList.remove('visible');
  }, 2000);
}

// Tag CRUD
async function createTag(data) {
  const res = await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message);

  tags.push(result.data);
  renderTags();
  updateTagFilter();
  updateStats();
  showToast('标签已创建', 'success');
  return result.data;
}

async function deleteTag(id) {
  const confirmed = await showConfirm('确定删除此标签？');
  if (!confirmed) return;

  const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');

  tags = tags.filter(t => t.id !== id);
  renderTags();
  updateTagFilter();
  updateStats();
  showToast('标签已删除', 'success');
}

// Batch Selection Functions
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
  if (currentNotebook === 'archived') {
    return memos.filter(m => m.is_archived);
  }
  if (currentNotebook === 'all') {
    return memos.filter(m => !m.is_archived);
  }
  return memos.filter(m => m.notebook_id === currentNotebook && !m.is_archived);
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

// Context Menu Functions
function showContextMenu(event) {
  event.preventDefault();
  if (selectedMemoIds.size === 0) return;
  
  const menu = $('batchContextMenu');
  menu.style.display = 'block';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  
  // Adjust position if menu goes off-screen
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }
  }, 0);
}

function hideContextMenu() {
  const menu = $('batchContextMenu');
  if (menu) menu.style.display = 'none';
}

// Batch Operations
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

function batchMoveToNotebook() {
  hideContextMenu();
  if (selectedMemoIds.size === 0) return;
  
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
  editingNotebookId = 'batch-move';
  
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

// Saved Filters Functions
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

function renderSavedFilters() {
  const list = $('savedFiltersList');
  if (!list) return;
  
  if (savedFilters.length === 0) {
    list.innerHTML = '<p class="empty-hint">暂无筛选预设</p>';
    return;
  }
  
  const displayFilters = savedFilters.slice(0, 10);
  
  list.innerHTML = displayFilters.map(f => `
    <div class="saved-filter-item ${currentFilterPreset === f.id ? 'active' : ''}" 
         data-filter-id="${f.id}"
         onclick="applyFilterPreset(${f.id})">
      <span class="filter-icon">${f.icon}</span>
      <span class="filter-name">${escapeHtml(f.name)}</span>
      <button class="filter-delete" onclick="event.stopPropagation(); confirmDeleteFilter(${f.id})">×</button>
    </div>
  `).join('');
}

function applyFilterPreset(id) {
  const filter = savedFilters.find(f => f.id === id);
  if (!filter) return;
  
  currentFilterPreset = id;
  const config = filter.filter_config;
  
  if (config.notebook !== null && config.notebook !== undefined) {
    currentNotebook = config.notebook;
  }
  if (config.tags !== null && config.tags !== undefined) {
    currentFilter.tags = config.tags.join(',');
  }
  if (config.favorite !== null && config.favorite !== undefined) {
    currentFilter.favorite = config.favorite;
  }
  if (config.archived !== null && config.archived !== undefined) {
    currentFilter.archived = config.archived;
  }
  if (config.search !== null && config.search !== undefined) {
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

function openSaveFilterModal() {
  $('filterName').value = '';
  selectedFilterIcon = '⭐';
  $('filterIcon').value = '⭐';
  
  document.querySelectorAll('.icon-preset').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.icon === '⭐');
  });
  
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

// Render - Card or List view
function renderMemos(append = false) {
  // Filter memos based on archive view
  let filteredMemos = memos;
  if (currentNotebook !== 'archived') {
    filteredMemos = memos.filter(m => !m.is_archived);
  } else {
    filteredMemos = memos.filter(m => m.is_archived);
  }

  if (filteredMemos.length === 0) {
    dom.memosGrid.style.display = 'none';
    dom.emptyState.style.display = 'block';
    return;
  }

  dom.memosGrid.style.display = 'block';
  dom.emptyState.style.display = 'none';
  
  // Update grid class based on view mode
  dom.memosGrid.classList.toggle('list-view', viewMode === 'list');

  const html = filteredMemos.map(memo => createMemoCard(memo)).join('');

  if (append) {
    dom.memosGrid.insertAdjacentHTML('beforeend', html);
  } else {
    dom.memosGrid.innerHTML = html;
  }
  
  // Setup gesture listeners for cards
  setupGestureListeners();

  updateLoadMore();
}

// Random border colors for memo cards
const memoColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
];

function getRandomMemoColor() {
  return memoColors[Math.floor(Math.random() * memoColors.length)];
}

function createMemoCard(memo) {
  const memoTags = (memo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const tagHtml = memoTags.map(name => {
    const tag = tags.find(t => t.name === name);
    return `<span class="memo-tag" style="background:${tag?.color || '#64748b'}">${escapeHtml(name)}</span>`;
  }).join('');

  const date = new Date(memo.created_at).toLocaleDateString('zh-CN');
  const content = parseMarkdown(memo.content);
  const borderColor = getRandomMemoColor();
  
  // Selection state
  const isSelected = selectedMemoIds.has(memo.id);
  const selectedClass = isSelected ? 'selected' : '';

  // Archive or restore button based on state
  const archiveBtn = memo.is_archived
    ? `<button class="memo-action" onclick="openRestoreModal(${memo.id})" title="恢复">
         <svg class="icon small"><use href="#icon-upload"/></svg>
       </button>`
    : `<button class="memo-action" onclick="archiveMemo(${memo.id})" title="归档">
         <svg class="icon small"><use href="#icon-archive"/></svg>
       </button>`;

  return `
    <article class="memo-card ${memo.is_archived ? 'archived' : ''} ${selectedClass} ${memo.is_pinned ? 'pinned' : ''}" data-memo-id="${memo.id}" tabindex="0" role="listitem" style="border-left: 4px solid ${borderColor}" oncontextmenu="if(selectionMode && selectedMemoIds.size > 0) showContextMenu(event)">
      <div class="select-circle" onclick="event.stopPropagation(); toggleMemoSelection(${memo.id})"></div>
      ${memo.is_pinned ? '<div class="pinned-indicator"><svg class="icon small"><use href="#icon-pin"/></svg></div>' : ''}
      <div class="memo-header">
        <h3 class="memo-title">${escapeHtml(memo.title)}</h3>
        <div class="memo-actions">
          ${!memo.is_archived ? `
          <button class="memo-action" onclick="openMemoModal(${memo.id})" title="编辑">
            <svg class="icon small"><use href="#icon-edit"/></svg>
          </button>
          ` : ''}
          <button class="memo-action ${memo.is_pinned ? 'pinned' : ''}" onclick="togglePinned(${memo.id})" title="${memo.is_pinned ? '取消置顶' : '置顶'}">
            <svg class="icon small"><use href="#icon-pin"/></svg>
          </button>
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

function renderTags() {
  dom.tagsList.innerHTML = tags.map(tag => `
    <div class="tag-item" onclick="filterByTag('${escapeHtml(tag.name)}')" tabindex="0">
      <div class="tag-info">
        <div class="tag-color" style="background:${tag.color}"></div>
        <span class="tag-name">${escapeHtml(tag.name)}</span>
      </div>
      <button class="tag-delete" onclick="event.stopPropagation(); deleteTag(${tag.id})">×</button>
    </div>
  `).join('');
}

function updateTagFilter() {
  const current = dom.tagFilter.value;
  dom.tagFilter.innerHTML = '<option value="">全部标签</option>' +
    tags.map(t => `<option value="${escapeHtml(t.name)}" ${t.name === current ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
}

function filterByTag(name) {
  dom.tagFilter.value = name;
  currentFilter.tag = name;
  resetAndLoad();
}

function updateStats() {
  dom.totalMemos.textContent = pagination.total;
  dom.totalTags.textContent = tags.length;
}

function updateLoadMore() {
  const existing = document.getElementById('loadMore');
  if (pagination.hasMore) {
    if (!existing) {
      dom.memosGrid.insertAdjacentHTML('afterend', '<div id="loadMore" class="load-more"><div class="spinner-small"></div><span>加载更多...</span></div>');
    }
  } else if (existing) {
    existing.remove();
  }
}

// Modal
function openMemoModal(id = null) {
  currentMemo = id ? memos.find(m => m.id === id) : null;

  $('modalTitle').textContent = currentMemo ? '编辑备忘录' : '新建备忘录';

  // Reset tabs
  document.querySelectorAll('.editor-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 0);
  });
  $('memoContent').style.display = 'block';
  $('markdownPreview').style.display = 'none';
  isPreviewMode = false;

  // Populate notebook select
  const notebookSelect = $('memoNotebook');
  notebookSelect.innerHTML = notebooks.map(n =>
    `<option value="${n.id}" ${currentMemo?.notebook_id === n.id ? 'selected' : ''}>${escapeHtml(n.icon)} ${escapeHtml(n.name)}</option>`
  ).join('');

  // Default to current filter notebook or first notebook
  if (!currentMemo && currentNotebook !== 'all' && currentNotebook !== 'archived') {
    notebookSelect.value = currentNotebook;
  }

  if (currentMemo) {
    $('memoTitle').value = currentMemo.title;
    $('memoContent').value = currentMemo.content;
    $('memoTags').value = currentMemo.tags || '';
    $('memoFavorite').checked = currentMemo.is_favorite;
    clearDraft();
  } else {
    const draft = loadDraft();
    if (draft) {
      $('memoTitle').value = draft.title || '';
      $('memoContent').value = draft.content || '';
      $('memoTags').value = draft.tags || '';
      $('memoFavorite').checked = draft.is_favorite || false;
      showToast('已恢复草稿', 'info');
    } else {
      $('memoForm').reset();
    }
  }

  renderAvailableTags();
  dom.memoModal.classList.add('active');
  $('memoTitle').focus();
}

function closeMemoModal() {
  dom.memoModal.classList.remove('active');
  if (!currentMemo && ($('memoContent').value.trim() || $('memoTitle').value.trim())) {
    showToast('草稿已保存', 'info');
  }
  currentMemo = null;
}

function openTagModal() {
  $('tagForm').reset();
  dom.tagModal.classList.add('active');
  $('tagName').focus();
}

function closeTagModal() {
  dom.tagModal.classList.remove('active');
}

function renderAvailableTags() {
  $('availableTags').innerHTML = tags.map(t => `
    <span class="available-tag" onclick="addTag('${escapeHtml(t.name)}')" style="border-color:${t.color}">${escapeHtml(t.name)}</span>
  `).join('');
}

function addTag(name) {
  const current = $('memoTags').value.split(',').map(t => t.trim()).filter(Boolean);
  if (!current.includes(name)) {
    current.push(name);
    $('memoTags').value = current.join(', ');
  }
  saveDraft();
}

// Form handlers
async function handleMemoSubmit(e) {
  e.preventDefault();

  const data = {
    title: $('memoTitle').value.trim(),
    content: $('memoContent').value.trim(),
    tags: $('memoTags').value.trim(),
    is_favorite: $('memoFavorite').checked,
    notebook_id: parseInt($('memoNotebook').value) || 1
  };

  if (!data.content) {
    showToast('请输入内容', 'error');
    return;
  }

  showLoading(true);
  try {
    if (currentMemo) {
      await updateMemo(currentMemo.id, data);
    } else {
      await createMemo(data);
    }
    closeMemoModal();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function handleTagSubmit(e) {
  e.preventDefault();

  const data = {
    name: $('tagName').value.trim(),
    color: $('tagColor').value
  };

  if (!data.name) {
    showToast('请输入标签名称', 'error');
    return;
  }

  showLoading(true);
  try {
    await createTag(data);
    closeTagModal();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// Export
function exportMemos() {
  const data = {
    memos,
    tags,
    exportDate: new Date().toISOString(),
    version: '2.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `memos-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  showToast('导出成功', 'success');
}

// Markdown parser with caching
function parseMarkdown(text) {
  if (!text) return '';

  // Check cache first (use full text as key for short content, truncated for long)
  const cacheKey = text.length > 500 ? text.substring(0, 500) + '___' : text;
  if (markdownCache.has(cacheKey)) {
    return markdownCache.get(cacheKey);
  }

  let result = text;

  // Code blocks first
  const codeBlocks = [];
  result = result.replace(/```([\s\S]*?)```/g, (_, code) => {
    const i = codeBlocks.length;
    codeBlocks[i] = `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    return `__CODE${i}__`;
  });

  // Inline code
  const inlineCodes = [];
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const i = inlineCodes.length;
    inlineCodes[i] = `<code>${escapeHtml(code)}</code>`;
    return `__INLINE${i}__`;
  });

  // Escape HTML
  result = result.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Blockquotes
  result = result.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists
  result = result.replace(/^- (.+)$/gm, '<li>$1</li>');
  result = result.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Paragraphs
  result = result.replace(/\n\n/g, '</p><p>');
  result = result.replace(/\n/g, '<br>');
  result = `<p>${result}</p>`;

  // Restore code
  codeBlocks.forEach((c, i) => result = result.replace(`__CODE${i}__`, c));
  inlineCodes.forEach((c, i) => result = result.replace(`__INLINE${i}__`, c));

  // Cache result (limit cache size)
  if (markdownCache.size >= MARKDOWN_CACHE_MAX_SIZE) {
    const firstKey = markdownCache.keys().next().value;
    markdownCache.delete(firstKey);
  }
  markdownCache.set(cacheKey, result);

  return result;
}

// Utilities
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show) {
  dom.loading.classList.toggle('active', show);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showToastWithAction(message, type, actionText, actionFn) {
  const toast = document.createElement('div');
  toast.className = `toast ${type} toast-with-action`;
  toast.innerHTML = `<span>${message}</span><button class="toast-action">${actionText}</button>`;
  toast.querySelector('button').onclick = () => { actionFn(); toast.remove(); };
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove?.(), UNDO_TIMEOUT);
}

// Track user activity for statistics
async function trackActivity(action, data = {}) {
  try {
    await fetch('/api/stats/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ action, ...data })
    });
  } catch (e) {
    // Silently fail - activity tracking is not critical
    console.debug('Activity tracking failed:', e);
  }
}

// Social sharing functions
async function shareToSocial(memoId, platform) {
  try {
    const res = await fetch('/api/share/social', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ memo_id: memoId, platform })
    });
    
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message);
    
    if (result.data.share_url) {
      window.open(result.data.share_url, '_blank', 'width=600,height=400');
    } else if (platform === 'copy') {
      await navigator.clipboard.writeText(result.data.text);
      showToast('已复制到剪贴板', 'success');
    } else if (platform === 'wechat') {
      // Show QR code modal for WeChat
      showWeChatShareModal(memoId);
    }
    
    return result.data;
  } catch (e) {
    showToast('分享失败: ' + e.message, 'error');
  }
}

async function showWeChatShareModal(memoId) {
  // Create share link first
  const res = await fetch(`/api/share/${memoId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  const result = await res.json();
  
  if (!result.success) {
    showToast('创建分享链接失败', 'error');
    return;
  }
  
  // Get QR code
  const qrRes = await fetch(`/api/share/${result.data.share_token}/qr`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  const qrResult = await qrRes.json();
  
  if (!qrResult.success) {
    showToast('生成二维码失败', 'error');
    return;
  }
  
  // Show modal with QR code
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h2>微信分享</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body" style="text-align: center;">
        <img src="${qrResult.data.qr_code}" alt="QR Code" style="max-width: 200px; margin: 1rem auto;">
        <p class="text-secondary" style="margin-top: 1rem;">扫描二维码在微信中打开</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Custom Confirm Dialog
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-message">${escapeHtml(message)}</div>
        <div class="confirm-actions">
          <button class="btn btn-outline" data-action="cancel">取消</button>
          <button class="btn btn-primary" data-action="confirm">确定</button>
        </div>
      </div>
    `;

    overlay.querySelector('[data-action="cancel"]').onclick = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector('[data-action="confirm"]').onclick = () => {
      overlay.remove();
      resolve(true);
    };

    overlay.onclick = e => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };

    document.body.appendChild(overlay);
  });
}