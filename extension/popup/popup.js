/**
 * Memo Extension - Popup Script
 */

const API_BASE = 'https://main.memo-app-1xs.pages.dev/api';

// DOM Elements
const loginView = document.getElementById('loginView');
const mainView = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');

const loginBtn = document.getElementById('loginBtn');
const savePageBtn = document.getElementById('savePageBtn');
const quickNoteBtn = document.getElementById('quickNoteBtn');
const viewAllBtn = document.getElementById('viewAllBtn');
const settingsBtn = document.getElementById('settingsBtn');
const backBtn = document.getElementById('backBtn');
const logoutBtn = document.getElementById('logoutBtn');
const syncNowBtn = document.getElementById('syncNowBtn');

const quickNoteForm = document.getElementById('quickNoteForm');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await init();
});

async function init() {
  const { authToken } = await chrome.storage.local.get('authToken');
  
  if (authToken) {
    showMainView();
    await loadUserInfo();
    await loadRecentMemos();
    await loadNotebooks();
    await updatePendingIndicator();
  } else {
    showLoginView();
  }
  
  // Load settings
  const settings = await chrome.storage.sync.get('memoSettings');
  if (settings.memoSettings) {
    document.getElementById('autoExtract').checked = settings.memoSettings.autoExtract !== false;
    document.getElementById('showNotification').checked = settings.memoSettings.showNotification !== false;
  }
}

// View Management
function showLoginView() {
  loginView.style.display = 'block';
  mainView.style.display = 'none';
  settingsView.style.display = 'none';
}

function showMainView() {
  loginView.style.display = 'none';
  mainView.style.display = 'block';
  settingsView.style.display = 'none';
}

function showSettingsView() {
  loginView.style.display = 'none';
  mainView.style.display = 'none';
  settingsView.style.display = 'block';
}

// Login
loginBtn.addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }
  
  loginBtn.disabled = true;
  loginBtn.textContent = '登录中...';
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      await chrome.storage.local.set({ authToken: result.data.token });
      showToast('登录成功', 'success');
      showMainView();
      await loadUserInfo();
      await loadRecentMemos();
      await loadNotebooks();
    } else {
      showToast(result.error?.message || '登录失败', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('网络错误，请稍后重试', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '登录';
  }
});

// Quick Actions
savePageBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Get page info from content script
  try {
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMeta' });
    
    let content = `# ${tab.title}\n\n`;
    if (pageInfo?.description) {
      content += `${pageInfo.description}\n\n`;
    }
    content += `链接: [${tab.url}](${tab.url})\n\n`;
    content += `保存时间: ${new Date().toLocaleString('zh-CN')}`;
    
    await createMemo({
      title: tab.title,
      content: content,
      tags: '网页收藏'
    });
  } catch (error) {
    // Content script may not be loaded, use basic info
    const content = `# ${tab.title}\n\n链接: [${tab.url}](${tab.url})`;
    await createMemo({
      title: tab.title,
      content: content,
      tags: '网页收藏'
    });
  }
});

quickNoteBtn.addEventListener('click', () => {
  quickNoteForm.style.display = quickNoteForm.style.display === 'none' ? 'block' : 'none';
  if (quickNoteForm.style.display === 'block') {
    document.getElementById('memoContent').focus();
  }
});

cancelNoteBtn.addEventListener('click', () => {
  quickNoteForm.style.display = 'none';
  document.getElementById('memoTitle').value = '';
  document.getElementById('memoContent').value = '';
  document.getElementById('memoTags').value = '';
});

saveNoteBtn.addEventListener('click', async () => {
  const title = document.getElementById('memoTitle').value.trim();
  const content = document.getElementById('memoContent').value.trim();
  const tags = document.getElementById('memoTags').value.trim();
  
  if (!content) {
    showToast('请输入内容', 'error');
    return;
  }
  
  await createMemo({ title, content, tags });
  
  // Reset form
  document.getElementById('memoTitle').value = '';
  document.getElementById('memoContent').value = '';
  document.getElementById('memoTags').value = '';
  quickNoteForm.style.display = 'none';
});

viewAllBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://main.memo-app-1xs.pages.dev/' });
});

settingsBtn.addEventListener('click', showSettingsView);
backBtn.addEventListener('click', showMainView);

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove('authToken');
  showToast('已退出登录', 'success');
  showLoginView();
});

// Sync pending memos
syncNowBtn.addEventListener('click', async () => {
  syncNowBtn.disabled = true;
  syncNowBtn.textContent = '同步中...';
  
  await chrome.runtime.sendMessage({ action: 'syncPending' });
  await updatePendingIndicator();
  
  syncNowBtn.disabled = false;
  syncNowBtn.textContent = '立即同步';
});

// Create memo
async function createMemo(data) {
  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    
    if (!authToken) {
      showToast('请先登录', 'error');
      showLoginView();
      return null;
    }
    
    // Get default notebook from settings
    const settings = await chrome.storage.sync.get('memoSettings');
    const notebookId = settings.memoSettings?.defaultNotebook;
    
    const response = await fetch(`${API_BASE}/memos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: data.title || '',
        content: data.content,
        tags: data.tags || '',
        notebook_id: notebookId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('保存成功', 'success');
      await loadRecentMemos();
      return result.data;
    } else {
      // Save to pending if auth error
      if (result.error?.code === 'AUTH_ERROR') {
        showToast('登录已过期', 'error');
        await chrome.storage.local.remove('authToken');
        showLoginView();
      } else {
        // Save to pending for offline
        await savePendingMemo(data);
        showToast('离线保存成功', 'success');
        await updatePendingIndicator();
      }
      return null;
    }
  } catch (error) {
    console.error('Create memo error:', error);
    await savePendingMemo(data);
    showToast('离线保存成功', 'success');
    await updatePendingIndicator();
    return null;
  }
}

// Save pending memo
async function savePendingMemo(data) {
  const { pendingMemos = [] } = await chrome.storage.local.get('pendingMemos');
  pendingMemos.push({
    ...data,
    createdAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ pendingMemos });
}

// Load recent memos
async function loadRecentMemos() {
  const recentMemos = document.getElementById('recentMemos');
  
  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(`${API_BASE}/memos?limit=5&sort=created_at&order=desc`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const result = await response.json();
    
    if (result.success && result.data.memos.length > 0) {
      recentMemos.innerHTML = result.data.memos.map(memo => `
        <div class="memo-item" data-id="${memo.id}">
          <div class="memo-title">${escapeHtml(memo.title || '无标题')}</div>
          <div class="memo-preview">${escapeHtml(memo.content.substring(0, 100))}${memo.content.length > 100 ? '...' : ''}</div>
          <div class="memo-meta">
            <span class="memo-date">${formatDate(memo.created_at)}</span>
            ${memo.tags ? `<span class="memo-tags">${escapeHtml(memo.tags)}</span>` : ''}
          </div>
        </div>
      `).join('');
      
      // Click to open in new tab
      recentMemos.querySelectorAll('.memo-item').forEach(item => {
        item.addEventListener('click', () => {
          chrome.tabs.create({ url: `https://main.memo-app-1xs.pages.dev/?memo=${item.dataset.id}` });
        });
      });
    } else {
      recentMemos.innerHTML = '<div class="empty">暂无备忘录</div>';
    }
  } catch (error) {
    console.error('Load memos error:', error);
    recentMemos.innerHTML = '<div class="error">加载失败</div>';
  }
}

// Load notebooks for settings
async function loadNotebooks() {
  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    
    const response = await fetch(`${API_BASE}/notebooks`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      const select = document.getElementById('defaultNotebook');
      result.data.forEach(notebook => {
        const option = document.createElement('option');
        option.value = notebook.id;
        option.textContent = notebook.name;
        select.appendChild(option);
      });
      
      // Set saved value
      const settings = await chrome.storage.sync.get('memoSettings');
      if (settings.memoSettings?.defaultNotebook) {
        select.value = settings.memoSettings.defaultNotebook;
      }
    }
  } catch (error) {
    console.error('Load notebooks error:', error);
  }
}

// Load user info
async function loadUserInfo() {
  // We can show username in header if needed
}

// Update pending indicator
async function updatePendingIndicator() {
  const { pendingMemos = [] } = await chrome.storage.local.get('pendingMemos');
  const indicator = document.getElementById('pendingIndicator');
  const count = document.querySelector('.pending-count');
  
  if (pendingMemos.length > 0) {
    indicator.style.display = 'flex';
    count.textContent = pendingMemos.length;
  } else {
    indicator.style.display = 'none';
  }
}

// Settings handlers
document.getElementById('autoExtract').addEventListener('change', saveSettings);
document.getElementById('showNotification').addEventListener('change', saveSettings);
document.getElementById('defaultNotebook').addEventListener('change', saveSettings);

async function saveSettings() {
  const settings = {
    autoExtract: document.getElementById('autoExtract').checked,
    showNotification: document.getElementById('showNotification').checked,
    defaultNotebook: document.getElementById('defaultNotebook').value || null
  };
  
  await chrome.storage.sync.set({ memoSettings: settings });
  showToast('设置已保存', 'success');
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// Helper functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}