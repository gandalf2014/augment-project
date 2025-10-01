// Global state
let memos = [];
let tags = [];
let currentMemo = null;
let currentFilter = { search: '', tag: '', favorite: false };
let isPreviewMode = false;

// DOM elements
const elements = {
  memosGrid: document.getElementById('memosGrid'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  tagFilter: document.getElementById('tagFilter'),
  favoritesFilter: document.getElementById('favoritesFilter'),
  newMemoBtn: document.getElementById('newMemoBtn'),
  newTagBtn: document.getElementById('newTagBtn'),
  themeToggle: document.getElementById('themeToggle'),
  exportBtn: document.getElementById('exportBtn'),
  totalMemos: document.getElementById('totalMemos'),
  totalTags: document.getElementById('totalTags'),
  tagsList: document.getElementById('tagsList'),
  memoModal: document.getElementById('memoModal'),
  tagModal: document.getElementById('tagModal'),
  loading: document.getElementById('loading'),
  toastContainer: document.getElementById('toastContainer')
};

// Improved Markdown parser
function parseMarkdown(text) {
  if (!text) return '';

  // First, handle code blocks to protect them from other processing
  const codeBlocks = [];
  let codeBlockIndex = 0;

  // Extract code blocks and replace with placeholders
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
    codeBlocks[codeBlockIndex] = `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    codeBlockIndex++;
    return placeholder;
  });

  // Split into lines for processing
  const lines = text.split('\n');
  const result = [];
  let inList = false;
  let listType = '';
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join('<br>');
      if (content.trim()) {
        result.push(`<p>${parseInlineMarkdown(content)}</p>`);
      }
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle lists
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();

      const marker = listMatch[2];
      const content = listMatch[3];
      const currentListType = /\d+\./.test(marker) ? 'ol' : 'ul';

      if (!inList) {
        result.push(`<${currentListType}>`);
        inList = true;
        listType = currentListType;
      } else if (listType !== currentListType) {
        result.push(`</${listType}>`);
        result.push(`<${currentListType}>`);
        listType = currentListType;
      }

      result.push(`<li>${parseInlineMarkdown(content)}</li>`);
      continue;
    }

    // Close list if we're not in a list item
    if (inList) {
      result.push(`</${listType}>`);
      inList = false;
      listType = '';
    }

    // Handle headers
    if (line.match(/^#{1,6}\s/)) {
      flushParagraph();
      const level = line.match(/^#+/)[0].length;
      const content = line.substring(level + 1);
      result.push(`<h${level}>${parseInlineMarkdown(content)}</h${level}>`);
      continue;
    }

    // Handle blockquotes
    if (line.startsWith('> ')) {
      flushParagraph();
      result.push(`<blockquote>${parseInlineMarkdown(line.substring(2))}</blockquote>`);
      continue;
    }

    // Handle horizontal rules
    if (line.trim() === '---' || line.trim() === '***') {
      flushParagraph();
      result.push('<hr>');
      continue;
    }

    // Handle empty lines
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular paragraph content
    currentParagraph.push(line);
  }

  // Flush any remaining paragraph
  flushParagraph();

  // Close any open lists
  if (inList) {
    result.push(`</${listType}>`);
  }

  // Restore code blocks
  let html = result.join('\n');
  codeBlocks.forEach((codeBlock, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, codeBlock);
  });

  return html;
}

function parseInlineMarkdown(text) {
  if (!text) return '';

  // First, protect inline code from other processing
  const inlineCodes = [];
  let codeIndex = 0;

  text = text.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${codeIndex}__`;
    inlineCodes[codeIndex] = `<code>${escapeHtml(code)}</code>`;
    codeIndex++;
    return placeholder;
  });

  // Escape HTML characters
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Process formatting (order matters)
  text = text
    // Bold and italic combinations
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Alternative bold/italic syntax
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Restore inline code
  inlineCodes.forEach((code, index) => {
    text = text.replace(`__INLINE_CODE_${index}__`, code);
  });

  return text;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  initializeTheme();
  setupEventListeners();
  await loadData();
});

// Theme management
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = elements.themeToggle.querySelector('.theme-icon');
  // Dark theme shows sun icon (to switch to light), light theme shows moon icon (to switch to dark)
  icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Event listeners
function setupEventListeners() {
  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Search and filter
  elements.searchInput.addEventListener('input', handleSearch);
  elements.searchClear.addEventListener('click', clearSearch);
  elements.tagFilter.addEventListener('change', handleTagFilter);
  elements.favoritesFilter.addEventListener('click', toggleFavoritesFilter);
  
  // Modal controls
  elements.newMemoBtn.addEventListener('click', () => openMemoModal());
  elements.newTagBtn.addEventListener('click', openTagModal);
  
  // Export
  elements.exportBtn.addEventListener('click', exportMemos);
  
  // Modal close handlers
  document.getElementById('modalClose').addEventListener('click', closeMemoModal);
  document.getElementById('cancelBtn').addEventListener('click', closeMemoModal);
  
  // Form submissions
  document.getElementById('memoForm').addEventListener('submit', handleMemoSubmit);
  document.getElementById('tagForm').addEventListener('submit', handleTagSubmit);
  
  // Color preset clicks
  document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', (e) => {
      document.getElementById('tagColor').value = e.target.dataset.color;
    });
  });

  // Editor tab switching
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('editor-tab')) {
      handleEditorTabSwitch(e.target);
    }
  });

  // Real-time markdown preview and title generation
  document.addEventListener('input', (e) => {
    if (e.target.id === 'memoContent') {
      if (isPreviewMode) {
        updateMarkdownPreview();
      }
      updateTitlePreview();
    }
  });
  
  // Modal backdrop clicks
  elements.memoModal.addEventListener('click', (e) => {
    if (e.target === elements.memoModal) closeMemoModal();
  });
  
  elements.tagModal.addEventListener('click', (e) => {
    if (e.target === elements.tagModal) closeTagModal();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Editor functions
function handleEditorTabSwitch(tab) {
  const tabContainer = tab.parentElement;
  const contentContainer = tabContainer.nextElementSibling;
  const textarea = contentContainer.querySelector('textarea');
  const preview = contentContainer.querySelector('.markdown-preview');

  // Update tab states
  tabContainer.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  const tabType = tab.dataset.tab;

  if (tabType === 'write') {
    isPreviewMode = false;
    textarea.style.display = 'block';
    preview.style.display = 'none';
  } else if (tabType === 'preview') {
    isPreviewMode = true;
    textarea.style.display = 'none';
    preview.style.display = 'block';
    updateMarkdownPreview();
  }
}

function updateMarkdownPreview() {
  const textarea = document.getElementById('memoContent');
  const preview = document.getElementById('markdownPreview');

  if (textarea && preview) {
    const markdownText = textarea.value;
    const htmlContent = parseMarkdown(markdownText);
    preview.innerHTML = `<div class="markdown-content">${htmlContent}</div>`;
  }
}

function updateTitlePreview() {
  const titleInput = document.getElementById('memoTitle');
  const contentInput = document.getElementById('memoContent');

  if (titleInput && contentInput) {
    const currentTitle = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!currentTitle && content) {
      const generatedTitle = generateTitleFromContent(content);
      titleInput.placeholder = `Auto-generated: ${generatedTitle}`;
    } else {
      titleInput.placeholder = 'Enter memo title (leave empty to auto-generate)...';
    }
  }
}

// Markdown editing helpers
function insertMarkdown(textarea, before, after = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  const replacement = before + selectedText + after;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

  // Set cursor position
  const newCursorPos = start + before.length + selectedText.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();

  // Update preview if in preview mode
  if (isPreviewMode) {
    updateMarkdownPreview();
  }
}

// Toolbar function for inserting markdown syntax
function insertMarkdownSyntax(before, after = '') {
  const textarea = document.getElementById('memoContent');
  if (textarea) {
    insertMarkdown(textarea, before, after);
  }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
  const textarea = document.getElementById('memoContent');
  const isInTextarea = e.target === textarea;

  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'n':
        e.preventDefault();
        openMemoModal();
        break;
      case 'f':
        e.preventDefault();
        elements.searchInput.focus();
        break;
      case 'e':
        e.preventDefault();
        exportMemos();
        break;
      case 'b':
        if (isInTextarea) {
          e.preventDefault();
          insertMarkdown(textarea, '**', '**');
        }
        break;
      case 'i':
        if (isInTextarea) {
          e.preventDefault();
          insertMarkdown(textarea, '*', '*');
        }
        break;
      case 'k':
        if (isInTextarea) {
          e.preventDefault();
          const url = prompt('Enter URL:');
          if (url) {
            insertMarkdown(textarea, '[', `](${url})`);
          }
        }
        break;
    }
  }

  // Tab key for indentation in textarea
  if (e.key === 'Tab' && isInTextarea) {
    e.preventDefault();
    insertMarkdown(textarea, '  ');
  }

  if (e.key === 'Escape') {
    closeMemoModal();
    closeTagModal();
  }
}

// Data loading
async function loadData() {
  showLoading(true);
  try {
    await Promise.all([loadMemos(), loadTags()]);
    updateStats();
    renderMemos();
    renderTags();
  } catch (error) {
    showToast('Failed to load data', 'error');
    console.error('Error loading data:', error);
  } finally {
    showLoading(false);
  }
}

async function loadMemos() {
  try {
    const response = await fetch('/api/memos');
    if (!response.ok) throw new Error('Failed to fetch memos');
    memos = await response.json();
  } catch (error) {
    console.error('Error loading memos:', error);
    memos = [];
  }
}

async function loadTags() {
  try {
    const response = await fetch('/api/tags');
    if (!response.ok) throw new Error('Failed to fetch tags');
    tags = await response.json();
    updateTagFilter();
  } catch (error) {
    console.error('Error loading tags:', error);
    tags = [];
  }
}

// Search and filter
function handleSearch(e) {
  currentFilter.search = e.target.value.toLowerCase();
  elements.searchClear.style.display = e.target.value ? 'block' : 'none';
  renderMemos();
}

function clearSearch() {
  elements.searchInput.value = '';
  currentFilter.search = '';
  elements.searchClear.style.display = 'none';
  renderMemos();
}

function handleTagFilter(e) {
  currentFilter.tag = e.target.value;
  renderMemos();
}

function toggleFavoritesFilter() {
  currentFilter.favorite = !currentFilter.favorite;
  elements.favoritesFilter.classList.toggle('btn-primary', currentFilter.favorite);
  elements.favoritesFilter.classList.toggle('btn-outline', !currentFilter.favorite);
  renderMemos();
}

// Memo operations
async function createMemo(memoData) {
  try {
    const response = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memoData)
    });
    
    if (!response.ok) throw new Error('Failed to create memo');
    
    const newMemo = await response.json();
    memos.unshift(newMemo);
    renderMemos();
    updateStats();
    showToast('Memo created successfully', 'success');
    return newMemo;
  } catch (error) {
    showToast('Failed to create memo', 'error');
    throw error;
  }
}

async function updateMemo(id, memoData) {
  try {
    console.log('Updating memo with ID:', id, 'Data:', memoData);
    const response = await fetch(`/api/memos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memoData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Update failed:', response.status, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const updatedMemo = await response.json();
    console.log('Update successful:', updatedMemo);

    const index = memos.findIndex(m => m.id === parseInt(id));
    if (index !== -1) {
      memos[index] = updatedMemo;
      renderMemos();
      showToast('Memo updated successfully', 'success');
    }
    return updatedMemo;
  } catch (error) {
    console.error('Error updating memo:', error);
    showToast(`Failed to update memo: ${error.message}`, 'error');
    throw error;
  }
}

async function deleteMemo(id) {
  if (!confirm('Are you sure you want to delete this memo?')) return;

  try {
    console.log('Deleting memo with ID:', id);
    const response = await fetch(`/api/memos/${id}`, { method: 'DELETE' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Delete failed:', response.status, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('Delete successful:', result);

    memos = memos.filter(m => m.id !== parseInt(id));
    renderMemos();
    updateStats();
    showToast('Memo deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting memo:', error);
    showToast(`Failed to delete memo: ${error.message}`, 'error');
  }
}

async function toggleFavorite(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;

  try {
    await updateMemo(id, { ...memo, is_favorite: !memo.is_favorite });
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}

// Tag operations
async function createTag(tagData) {
  try {
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create tag');
    }

    const newTag = await response.json();
    tags.push(newTag);
    renderTags();
    updateTagFilter();
    updateStats();
    showToast('Tag created successfully', 'success');
    return newTag;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

async function deleteTag(id) {
  if (!confirm('Are you sure you want to delete this tag?')) return;

  try {
    const response = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete tag');

    tags = tags.filter(t => t.id !== id);
    renderTags();
    updateTagFilter();
    updateStats();
    showToast('Tag deleted successfully', 'success');
  } catch (error) {
    showToast('Failed to delete tag', 'error');
  }
}

// Rendering functions
function renderMemos() {
  const filteredMemos = getFilteredMemos();

  if (filteredMemos.length === 0) {
    elements.memosGrid.style.display = 'none';
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.memosGrid.style.display = 'grid';
  elements.emptyState.style.display = 'none';

  elements.memosGrid.innerHTML = filteredMemos.map(memo => createMemoCard(memo)).join('');
}

function getFilteredMemos() {
  return memos.filter(memo => {
    // For search, also search in the plain text version of markdown content
    const plainTextContent = stripMarkdown(memo.content);
    const matchesSearch = !currentFilter.search ||
      memo.title.toLowerCase().includes(currentFilter.search) ||
      memo.content.toLowerCase().includes(currentFilter.search) ||
      plainTextContent.toLowerCase().includes(currentFilter.search);

    const matchesTag = !currentFilter.tag ||
      memo.tags.toLowerCase().includes(currentFilter.tag.toLowerCase());

    const matchesFavorite = !currentFilter.favorite || memo.is_favorite;

    return matchesSearch && matchesTag && matchesFavorite;
  });
}

// Helper function to strip markdown formatting for search
function stripMarkdown(text) {
  if (!text) return '';

  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function createMemoCard(memo) {
  const memoTags = memo.tags ? memo.tags.split(',').map(t => t.trim()).filter(t => t) : [];
  const tagElements = memoTags.map(tagName => {
    const tag = tags.find(t => t.name === tagName);
    const color = tag ? tag.color : '#64748b';
    return `<span class="memo-tag" style="background-color: ${color}">${tagName}</span>`;
  }).join('');

  const date = new Date(memo.created_at).toLocaleDateString();

  // Render content as markdown for display (full content, no truncation)
  const contentHtml = parseMarkdown(memo.content);

  return `
    <div class="memo-card">
      <div class="memo-header">
        <h3 class="memo-title" title="${escapeHtml(memo.title)}">${escapeHtml(memo.title)}</h3>
        <div class="memo-actions">
          <button class="memo-action"
                  onclick="openMemoModal(${memo.id})"
                  title="Edit memo">
            ✏️
          </button>
          <button class="memo-action ${memo.is_favorite ? 'favorite' : ''}"
                  onclick="toggleFavorite(${memo.id})"
                  title="Toggle favorite">
            ${memo.is_favorite ? '⭐' : '☆'}
          </button>
          <button class="memo-action"
                  onclick="deleteMemo(${memo.id})"
                  title="Delete memo">
            🗑️
          </button>
        </div>
      </div>
      <div class="memo-content markdown">${contentHtml}</div>
      <div class="memo-footer">
        <div class="memo-tags">${tagElements}</div>
        <div class="memo-date">${date}</div>
      </div>
    </div>
  `;
}



function renderTags() {
  elements.tagsList.innerHTML = tags.map(tag => `
    <div class="tag-item" onclick="filterByTag('${tag.name}')">
      <div class="tag-info">
        <div class="tag-color" style="background-color: ${tag.color}"></div>
        <span class="tag-name">${escapeHtml(tag.name)}</span>
      </div>
      <button class="tag-delete" onclick="event.stopPropagation(); deleteTag(${tag.id})" title="Delete tag">
        ×
      </button>
    </div>
  `).join('');
}

function updateTagFilter() {
  const currentValue = elements.tagFilter.value;
  elements.tagFilter.innerHTML = '<option value="">All Tags</option>' +
    tags.map(tag => `<option value="${tag.name}" ${tag.name === currentValue ? 'selected' : ''}>${tag.name}</option>`).join('');
}

function filterByTag(tagName) {
  elements.tagFilter.value = tagName;
  currentFilter.tag = tagName;
  renderMemos();
}

function updateStats() {
  elements.totalMemos.textContent = memos.length;
  elements.totalTags.textContent = tags.length;
}

// Modal functions
function openMemoModal(memoId = null) {
  currentMemo = memoId ? memos.find(m => m.id === memoId) : null;

  const form = document.getElementById('memoForm');
  const title = document.getElementById('modalTitle');
  const titleInput = document.getElementById('memoTitle');
  const contentInput = document.getElementById('memoContent');
  const tagsInput = document.getElementById('memoTags');
  const favoriteInput = document.getElementById('memoFavorite');

  // Reset editor to write mode
  const writeTab = document.querySelector('.editor-tab[data-tab="write"]');
  const previewTab = document.querySelector('.editor-tab[data-tab="preview"]');
  const preview = document.getElementById('markdownPreview');

  if (writeTab && previewTab) {
    writeTab.classList.add('active');
    previewTab.classList.remove('active');
    contentInput.style.display = 'block';
    preview.style.display = 'none';
    isPreviewMode = false;
  }

  if (currentMemo) {
    title.textContent = 'Edit Memo';
    titleInput.value = currentMemo.title;
    contentInput.value = currentMemo.content;
    tagsInput.value = currentMemo.tags;
    favoriteInput.checked = currentMemo.is_favorite;
  } else {
    title.textContent = 'New Memo';
    form.reset();
  }

  renderAvailableTags();
  elements.memoModal.classList.add('active');
  titleInput.focus();
}

function closeMemoModal() {
  elements.memoModal.classList.remove('active');
  currentMemo = null;
}

function openTagModal() {
  document.getElementById('tagForm').reset();
  elements.tagModal.classList.add('active');
  document.getElementById('tagName').focus();
}

function closeTagModal() {
  elements.tagModal.classList.remove('active');
}

function renderAvailableTags() {
  const container = document.getElementById('availableTags');
  container.innerHTML = tags.map(tag => `
    <span class="available-tag" onclick="addTagToInput('${tag.name}')" style="border-color: ${tag.color}">
      ${escapeHtml(tag.name)}
    </span>
  `).join('');
}

function addTagToInput(tagName) {
  const tagsInput = document.getElementById('memoTags');
  const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

  if (!currentTags.includes(tagName)) {
    currentTags.push(tagName);
    tagsInput.value = currentTags.join(', ');
  }
}

// Form handlers
async function handleMemoSubmit(e) {
  e.preventDefault();

  const formData = {
    title: document.getElementById('memoTitle').value.trim(),
    content: document.getElementById('memoContent').value.trim(),
    tags: document.getElementById('memoTags').value.trim(),
    is_favorite: document.getElementById('memoFavorite').checked
  };

  if (!formData.content) {
    showToast('Content is required', 'error');
    return;
  }

  try {
    showLoading(true);

    if (currentMemo) {
      await updateMemo(currentMemo.id, formData);
    } else {
      await createMemo(formData);
    }

    closeMemoModal();
  } catch (error) {
    console.error('Error saving memo:', error);
  } finally {
    showLoading(false);
  }
}

async function handleTagSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('tagName').value.trim(),
    color: document.getElementById('tagColor').value
  };

  if (!formData.name) {
    showToast('Tag name is required', 'error');
    return;
  }

  try {
    showLoading(true);
    await createTag(formData);
    closeTagModal();
  } catch (error) {
    console.error('Error creating tag:', error);
  } finally {
    showLoading(false);
  }
}

// Export functionality
function exportMemos() {
  const exportData = {
    memos: memos,
    tags: tags,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `memos-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  showToast('Memos exported successfully', 'success');
}

// Helper function to generate title from content (client-side)
function generateTitleFromContent(content) {
  if (!content) return 'Untitled Memo';

  // Remove markdown formatting for title generation
  let plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Remove bold+italic
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^#{1,6}\s+/gm, '') // Remove headers
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Get first meaningful line/sentence
  const firstLine = plainText.split(/[.!?]|\n/)[0].trim();

  // Limit length and add ellipsis if needed
  if (firstLine.length > 50) {
    return firstLine.substring(0, 47) + '...';
  }

  return firstLine || 'Untitled Memo';
}

// Utility functions
function showLoading(show) {
  elements.loading.classList.toggle('active', show);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Service Worker registration (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
