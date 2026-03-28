// State
let memos = [];
let tags = [];
let currentMemo = null;
let currentFilter = { search: '', tag: '', favorite: false };
let isPreviewMode = false;

// Pagination
let pagination = { page: 1, limit: 50, total: 0, hasMore: false };

// Draft
let draftTimer = null;
const DRAFT_KEY = 'memo-draft';
const DRAFT_DELAY = 1000;

// Undo
let lastDeleted = null;
const UNDO_TIMEOUT = 5000;

// DOM
const $ = id => document.getElementById(id);
const dom = {
  memosGrid: $('memosGrid'),
  emptyState: $('emptyState'),
  searchInput: $('searchInput'),
  searchClear: $('searchClear'),
  tagFilter: $('tagFilter'),
  favoritesFilter: $('favoritesFilter'),
  newMemoBtn: $('newMemoBtn'),
  newTagBtn: $('newTagBtn'),
  themeToggle: $('themeToggle'),
  exportBtn: $('exportBtn'),
  totalMemos: $('totalMemos'),
  totalTags: $('totalTags'),
  tagsList: $('tagsList'),
  memoModal: $('memoModal'),
  tagModal: $('tagModal'),
  loading: $('loading'),
  toastContainer: $('toastContainer')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  loadDraft();
  setupEvents();
  await loadData();
});

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
  dom.themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Events
function setupEvents() {
  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.searchInput.addEventListener('input', debounce(handleSearch, 300));
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

  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', e => $('tagColor').value = e.target.dataset.color);
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

  // 编辑模态框不响应点击外部关闭，防止误操作丢失内容
  // dom.memoModal.addEventListener('click', e => {
  //   if (e.target === dom.memoModal) closeMemoModal();
  // });

  dom.tagModal.addEventListener('click', e => {
    if (e.target === dom.tagModal) closeTagModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMemoModal();
      closeTagModal();
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

  window.addEventListener('scroll', handleScroll);
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
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
    await Promise.all([loadMemos(), loadTags()]);
    updateStats();
    renderMemos();
    renderTags();
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

// Render - Simple CSS Columns Masonry
function renderMemos(append = false) {
  if (memos.length === 0) {
    dom.memosGrid.style.display = 'none';
    dom.emptyState.style.display = 'block';
    return;
  }

  dom.memosGrid.style.display = 'block';
  dom.emptyState.style.display = 'none';

  const html = memos.map(memo => createMemoCard(memo)).join('');

  if (append) {
    dom.memosGrid.insertAdjacentHTML('beforeend', html);
  } else {
    dom.memosGrid.innerHTML = html;
  }

  updateLoadMore();
}

function createMemoCard(memo) {
  const memoTags = (memo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const tagHtml = memoTags.map(name => {
    const tag = tags.find(t => t.name === name);
    return `<span class="memo-tag" style="background:${tag?.color || '#64748b'}">${escapeHtml(name)}</span>`;
  }).join('');

  const date = new Date(memo.created_at).toLocaleDateString('zh-CN');
  const content = parseMarkdown(memo.content);

  return `
    <article class="memo-card" data-memo-id="${memo.id}" tabindex="0" role="listitem">
      <div class="memo-header">
        <h3 class="memo-title">${escapeHtml(memo.title)}</h3>
        <div class="memo-actions">
          <button class="memo-action" onclick="openMemoModal(${memo.id})" title="编辑">✏️</button>
          <button class="memo-action ${memo.is_favorite ? 'favorite' : ''}" onclick="toggleFavorite(${memo.id})" title="${memo.is_favorite ? '取消收藏' : '收藏'}">${memo.is_favorite ? '⭐' : '☆'}</button>
          <button class="memo-action" onclick="deleteMemo(${memo.id})" title="删除">🗑️</button>
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
    is_favorite: $('memoFavorite').checked
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

// Markdown parser
function parseMarkdown(text) {
  if (!text) return '';

  // Code blocks first
  const codeBlocks = [];
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const i = codeBlocks.length;
    codeBlocks[i] = `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    return `__CODE${i}__`;
  });

  // Inline code
  const inlineCodes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const i = inlineCodes.length;
    inlineCodes[i] = `<code>${escapeHtml(code)}</code>`;
    return `__INLINE${i}__`;
  });

  // Escape HTML
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Blockquotes
  text = text.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists
  text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Paragraphs
  text = text.replace(/\n\n/g, '</p><p>');
  text = text.replace(/\n/g, '<br>');
  text = `<p>${text}</p>`;

  // Restore code
  codeBlocks.forEach((c, i) => text = text.replace(`__CODE${i}__`, c));
  inlineCodes.forEach((c, i) => text = text.replace(`__INLINE${i}__`, c));

  return text;
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