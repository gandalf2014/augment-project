/**
 * Memo Extension - Content Script
 * Runs on all pages to extract info and handle selection
 */

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getSelection':
      sendResponse({ selection: getSelectionText() });
      break;
      
    case 'getPageMeta':
      sendResponse(getPageMeta());
      break;
      
    case 'getPageContent':
      sendResponse({ content: document.body.innerText });
      break;
  }
  return true;
});

// Get selected text
function getSelectionText() {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    return selection.toString().trim();
  }
  return null;
}

// Get page metadata
function getPageMeta() {
  return {
    title: document.title,
    description: getMetaContent('description'),
    keywords: getMetaContent('keywords'),
    author: getMetaContent('author'),
    ogTitle: getMetaContent('og:title'),
    ogDescription: getMetaContent('og:description'),
    ogImage: getMetaContent('og:image'),
    canonical: getLinkHref('canonical'),
    url: window.location.href
  };
}

// Helper: Get meta tag content
function getMetaContent(name) {
  const meta = document.querySelector(
    `meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`
  );
  return meta ? meta.getAttribute('content') : null;
}

// Helper: Get link tag href
function getLinkHref(rel) {
  const link = document.querySelector(`link[rel="${rel}"]`);
  return link ? link.getAttribute('href') : null;
}

// Floating save button for selected text (optional feature)
let floatingBtn = null;

// Show floating button on text selection
document.addEventListener('mouseup', (e) => {
  // Remove existing button
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // Only show if meaningful selection
  if (selectedText.length < 10) return;
  
  // Don't show if clicking on input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  // Create floating button
  floatingBtn = document.createElement('div');
  floatingBtn.className = 'memo-float-btn';
  floatingBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  `;
  
  // Position near selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  floatingBtn.style.left = `${rect.right + 10}px`;
  floatingBtn.style.top = `${rect.top + scrollTop}px`;
  
  // Click handler
  floatingBtn.addEventListener('click', () => {
    saveSelectionToMemo(selectedText);
    floatingBtn.remove();
    floatingBtn = null;
  });
  
  document.body.appendChild(floatingBtn);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  }, 3000);
});

// Save selection to memo
async function saveSelectionToMemo(text) {
  const content = `${text}\n\n---\n来源: [${document.title}](${window.location.href})`;
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'createMemo',
    data: {
      title: document.title,
      content: content,
      tags: '网页剪藏'
    }
  });
}

// Add styles for floating button
const style = document.createElement('style');
style.textContent = `
  .memo-float-btn {
    position: absolute;
    z-index: 999999;
    width: 32px;
    height: 32px;
    background: #2563eb;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s, background 0.2s;
  }
  
  .memo-float-btn:hover {
    background: #1d4ed8;
    transform: scale(1.1);
  }
  
  .memo-float-btn svg {
    width: 18px;
    height: 18px;
    color: white;
  }
`;
document.head.appendChild(style);