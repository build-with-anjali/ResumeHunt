// Background service worker for LinkedIn Resume Detector
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Resume Detector installed');
  
  // Set default settings (conservative for safety)
  chrome.storage.sync.set({
    enabled: true,
    autoCheck: false, // Disabled by default for safety
    delay: 2000, // 2 seconds minimum for safety
    maxConcurrentChecks: 1 // Conservative concurrent limit
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get([
      'enabled', 
      'autoCheck', 
      'delay', 
      'maxConcurrentChecks'
    ], (result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'updateSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'logActivity') {
    console.log('LinkedIn Resume Detector:', request.message);
  }
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('linkedin.com/search/results/people/')) {
    
    // Inject content script if not already present
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => {
      // Script might already be injected
      console.log('Content script injection skipped:', err.message);
    });
  }
});

// Context menu for quick actions
chrome.contextMenus.create({
  id: 'toggleResumeDetector',
  title: 'Toggle Resume Detector',
  contexts: ['page'],
  documentUrlPatterns: ['https://www.linkedin.com/search/results/people/*']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggleResumeDetector') {
    chrome.storage.sync.get(['enabled'], (result) => {
      const newState = !result.enabled;
      chrome.storage.sync.set({ enabled: newState }, () => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleEnabled', 
          enabled: newState 
        });
      });
    });
  }
});

// Badge management
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    chrome.action.setBadgeText({
      text: request.count.toString(),
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#22c55e'
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('linkedin.com/search/results/people/')) {
    chrome.tabs.sendMessage(tab.id, { action: 'refreshCheck' });
  }
}); 