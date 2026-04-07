/**
 * Memo Extension - Background Service Worker
 * Handles context menus, shortcuts, and API communication
 */

// API Configuration
const API_BASE = 'https://main.memo-app-1xs.pages.dev/api';

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Memo extension installed');
  
  // Create context menus
  await createContextMenus();
  
  // Initialize default settings
  const settings = await chrome.storage.sync.get('memoSettings');
  if (!settings.memoSettings) {
    await chrome.storage.sync.set({
      memoSettings: {
        autoExtract: true,
        showNotification: true,
        defaultNotebook: null
      }
    });
  }
});

// Create context menus
async function createContextMenus() {
  // Remove existing menus first
  await chrome.contextMenus.removeAll();
  
  // Save selection
  chrome.contextMenus.create({
    id: 'save-selection',
    title: '保存到 Memo',
    contexts: ['selection']
  });
  
  // Save page
  chrome.contextMenus.create({
    id: 'save-page',
    title: '保存页面到 Memo',
    contexts: ['page']
  });
  
  // Save link
  chrome.contextMenus.create({
    id: 'save-link',
    title: '保存链接到 Memo',
    contexts: ['link']
  });
  
  // Save image (for future use)
  chrome.contextMenus.create({
    id: 'save-image',
    title: '保存图片到 Memo',
    contexts: ['image']
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const auth = await checkAuth();
  if (!auth) {
    showNotification('请先登录', '请点击扩展图标登录 Memo');
    return;
  }
  
  switch (info.menuItemId) {
    case 'save-selection':
      await saveSelection(info, tab);
      break;
    case 'save-page':
      await savePage(info, tab);
      break;
    case 'save-link':
      await saveLink(info, tab);
      break;
    case 'save-image':
      await saveImage(info, tab);
      break;
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (command === 'save-selection') {
    const auth = await checkAuth();
    if (!auth) {
      showNotification('请先登录', '请点击扩展图标登录 Memo');
      return;
    }
    
    // Get selection from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
    if (response && response.selection) {
      await createMemoFromSelection(response.selection, tab);
    } else {
      showNotification('未选中文字', '请先选中要保存的文字');
    }
  }
});

// Save selected text
async function saveSelection(info, tab) {
  const selection = info.selectionText;
  const content = `${selection}\n\n---\n来源: [${tab.title}](${tab.url})`;
  
  await createMemo({
    title: tab.title,
    content: content,
    tags: '网页剪藏'
  });
}

// Save page URL and info
async function savePage(info, tab) {
  // Extract meta description
  const meta = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMeta' });
  
  let content = `# ${tab.title}\n\n`;
  if (meta && meta.description) {
    content += `${meta.description}\n\n`;
  }
  content += `链接: [${tab.url}](${tab.url})\n\n`;
  content += `保存时间: ${new Date().toLocaleString('zh-CN')}`;
  
  await createMemo({
    title: tab.title,
    content: content,
    tags: '网页收藏'
  });
}

// Save link
async function saveLink(info, tab) {
  const linkUrl = info.linkUrl;
  const linkText = info.linkText || linkUrl;
  
  const content = `[${linkText}](${linkUrl})\n\n保存自: [${tab.title}](${tab.url})`;
  
  await createMemo({
    title: linkText,
    content: content,
    tags: '链接收藏'
  });
}

// Save image URL (not uploading, just saving the URL)
async function saveImage(info, tab) {
  const imageUrl = info.srcUrl;
  const content = `![图片](${imageUrl})\n\n来源: [${tab.title}](${tab.url})`;
  
  await createMemo({
    title: '图片收藏',
    content: content,
    tags: '图片收藏'
  });
}

// Create memo from selection (called by keyboard shortcut)
async function createMemoFromSelection(selection, tab) {
  const content = `${selection}\n\n---\n来源: [${tab.title}](${tab.url})`;
  
  await createMemo({
    title: tab.title,
    content: content,
    tags: '网页剪藏'
  });
}

// Create memo via API
async function createMemo(data) {
  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    
    if (!authToken) {
      showNotification('请先登录', '请点击扩展图标登录 Memo');
      return null;
    }
    
    // Get default notebook
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
      showNotification('保存成功', `"${data.title || '备忘录'}" 已保存`);
      return result.data;
    } else {
      // Handle offline - save to pending
      if (result.error?.code === 'AUTH_ERROR') {
        showNotification('登录已过期', '请重新登录');
        await chrome.storage.local.remove('authToken');
      } else {
        await savePendingMemo(data);
        showNotification('离线保存', '网络不可用，已暂存到待同步列表');
      }
      return null;
    }
  } catch (error) {
    console.error('Create memo error:', error);
    // Save to pending
    await savePendingMemo(data);
    showNotification('离线保存', '网络不可用，已暂存到待同步列表');
    return null;
  }
}

// Save pending memo for later sync
async function savePendingMemo(data) {
  const { pendingMemos = [] } = await chrome.storage.local.get('pendingMemos');
  pendingMemos.push({
    ...data,
    createdAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ pendingMemos });
}

// Sync pending memos
async function syncPendingMemos() {
  const { pendingMemos = [] } = await chrome.storage.local.get('pendingMemos');
  const { authToken } = await chrome.storage.local.get('authToken');
  
  if (!authToken || pendingMemos.length === 0) return;
  
  const synced = [];
  for (const memo of pendingMemos) {
    const result = await createMemo(memo);
    if (result) {
      synced.push(memo.createdAt);
    }
  }
  
  if (synced.length > 0) {
    const remaining = pendingMemos.filter(m => !synced.includes(m.createdAt));
    await chrome.storage.local.set({ pendingMemos: remaining });
    showNotification('同步完成', `已同步 ${synced.length} 条备忘录`);
  }
}

// Check if user is authenticated
async function checkAuth() {
  const { authToken } = await chrome.storage.local.get('authToken');
  return !!authToken;
}

// Show notification
async function showNotification(title, message) {
  const settings = await chrome.storage.sync.get('memoSettings');
  if (settings.memoSettings?.showNotification !== false) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: title,
      message: message
    });
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'checkAuth':
      checkAuth().then(sendResponse);
      return true;
      
    case 'createMemo':
      createMemo(message.data).then(sendResponse);
      return true;
      
    case 'syncPending':
      syncPendingMemos().then(sendResponse);
      return true;
      
    case 'getPendingCount':
      chrome.storage.local.get('pendingMemos').then(({ pendingMemos = [] }) => {
        sendResponse(pendingMemos.length);
      });
      return true;
  }
});

// Periodic sync check
chrome.alarms.create('syncPending', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncPending') {
    syncPendingMemos();
  }
});

// Sync on browser start
chrome.runtime.onStartup.addListener(() => {
  setTimeout(syncPendingMemos, 5000);
});