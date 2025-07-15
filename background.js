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

  // Initialize context menu
  initializeContextMenu();
});

// Initialize context menu with error handling
function initializeContextMenu() {
  try {
    // Remove existing context menu items first
    chrome.contextMenus.removeAll(() => {
      // Create new context menu
      chrome.contextMenus.create({
        id: 'toggleResumeDetector',
        title: 'Toggle Resume Detector',
        contexts: ['page'],
        documentUrlPatterns: ['https://www.linkedin.com/search/results/people/*']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Context menu creation failed:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu created successfully');
        }
      });
    });
  } catch (error) {
    console.error('Error initializing context menu:', error);
  }
}

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

  if (request.action === 'updateBadge') {
    try {
      chrome.action.setBadgeText({
        text: request.count.toString(),
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#22c55e'
      });
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a LinkedIn search page
    const isLinkedInSearch = tab.url.includes('linkedin.com/search') || 
                           tab.url.includes('linkedin.com/search/results/people/') ||
                           tab.url.includes('linkedin.com/search/results/all/');
    
    if (isLinkedInSearch) {
      console.log('LinkedIn search page detected, injecting content script:', tab.url);
      
      // Try multiple injection methods to bypass ad blockers
      setTimeout(() => {
        // Method 1: Direct injection
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).then(() => {
          console.log('Content script injected successfully (Method 1)');
        }).catch(err => {
          console.log('Method 1 failed:', err.message);
          
          // Method 2: Inline code injection as fallback
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // Inject a simple test to see if scripts can run
              console.log('=== TESTING CONTENT SCRIPT INJECTION ===');
              console.log('URL:', window.location.href);
              console.log('Can access LinkedIn page:', document.title.includes('LinkedIn'));
              
              // Try to load the main content script
              const script = document.createElement('script');
              script.src = chrome.runtime.getURL('content.js');
              script.onload = () => console.log('Content script loaded via DOM injection');
              script.onerror = (e) => console.error('Content script failed to load:', e);
              document.head.appendChild(script);
            }
          }).then(() => {
            console.log('Fallback injection method executed');
          }).catch(err => {
            console.error('Both injection methods failed:', err);
          });
        });
      }, 1000); // Wait 1 second for page to fully load
    }
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggleResumeDetector') {
    chrome.storage.sync.get(['enabled'], (result) => {
      const newState = !result.enabled;
      chrome.storage.sync.set({ enabled: newState }, () => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleEnabled', 
          enabled: newState 
        }).catch(err => {
          console.error('Error sending toggle message:', err.message || err);
        });
      });
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('linkedin.com/search/results/people/')) {
    chrome.tabs.sendMessage(tab.id, { action: 'refreshCheck' }).catch(err => {
      console.error('Error sending refresh message:', err.message || err);
    });
  }
}); 