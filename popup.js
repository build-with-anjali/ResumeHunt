// Popup script for LinkedIn Resume Detector
document.addEventListener('DOMContentLoaded', function() {
  const enabledToggle = document.getElementById('enabledToggle');
  const autoCheckToggle = document.getElementById('autoCheckToggle');
  const delayInput = document.getElementById('delayInput');
  const maxChecksInput = document.getElementById('maxChecksInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const debugBtn = document.getElementById('debugBtn');
  const extensionStatus = document.getElementById('extensionStatus');
  const profilesChecked = document.getElementById('profilesChecked');
  const resumesFound = document.getElementById('resumesFound');

  // Load current settings
  loadSettings();
  loadStatus();

  // Event listeners
  enabledToggle.addEventListener('change', function() {
    updateSetting('enabled', this.checked);
    updateStatus();
  });

  autoCheckToggle.addEventListener('change', function() {
    updateSetting('autoCheck', this.checked);
  });

  delayInput.addEventListener('change', function() {
    updateSetting('delay', parseInt(this.value));
  });

  maxChecksInput.addEventListener('change', function() {
    updateSetting('maxConcurrentChecks', parseInt(this.value));
  });

  refreshBtn.addEventListener('click', function() {
    this.disabled = true;
    this.textContent = 'Refreshing...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('linkedin.com/search/results/people/')) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'refreshCheck'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending refresh message:', chrome.runtime.lastError.message);
            showNotification('Error: Content script not loaded - ' + chrome.runtime.lastError.message);
          }
          setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh Check';
          }, 1000);
        });
      } else {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Check';
        showNotification('Please navigate to LinkedIn search results first');
      }
    });
  });

  clearCacheBtn.addEventListener('click', function() {
    this.disabled = true;
    this.textContent = 'Clearing...';
    
    // Send message to content script to clear cache
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('linkedin.com/search/results/people/')) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'clearCache'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending clear cache message:', chrome.runtime.lastError.message);
            showNotification('Error: Content script not loaded - ' + chrome.runtime.lastError.message);
          }
          setTimeout(() => {
            clearCacheBtn.disabled = false;
            clearCacheBtn.textContent = 'Clear Cache';
            loadStatus(); // Reload status after clearing
          }, 500);
        });
      } else {
        clearCacheBtn.disabled = false;
        clearCacheBtn.textContent = 'Clear Cache';
      }
    });
  });

  debugBtn.addEventListener('click', function() {
    this.disabled = true;
    this.textContent = 'Debugging...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // Get basic info
        const currentUrl = tabs[0].url;
        const isLinkedIn = currentUrl.includes('linkedin.com');
        const isSearchPage = currentUrl.includes('linkedin.com/search/results/people/');
        
        let debugInfo = `=== Debug Info ===\n`;
        debugInfo += `Current URL: ${currentUrl}\n`;
        debugInfo += `Is LinkedIn: ${isLinkedIn}\n`;
        debugInfo += `Is Search Page: ${isSearchPage}\n`;
        debugInfo += `Extension should work: ${isSearchPage}\n\n`;
        
        if (isSearchPage) {
          // Try to get content script status
          chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
            if (chrome.runtime.lastError) {
              debugInfo += `Content Script: NOT LOADED\n`;
              debugInfo += `Error: ${chrome.runtime.lastError.message}\n`;
              debugInfo += `\nTroubleshooting:\n`;
              debugInfo += `1. Try refreshing the LinkedIn page\n`;
              debugInfo += `2. Try reloading the extension\n`;
              debugInfo += `3. Check if page fully loaded\n`;
            } else {
              debugInfo += `Content Script: LOADED ✓\n`;
              debugInfo += `Stats: ${JSON.stringify(response, null, 2)}\n`;
              debugInfo += `\nIf not working:\n`;
              debugInfo += `1. Open Developer Tools (F12)\n`;
              debugInfo += `2. Go to Console tab\n`;
              debugInfo += `3. Type: ResumeHuntDebug.debugInfo()\n`;
            }
            
            alert(debugInfo);
            debugBtn.disabled = false;
            debugBtn.textContent = 'Debug Info';
          });
        } else {
          debugInfo += `Solution: Navigate to LinkedIn search results page\n`;
          debugInfo += `Example: https://www.linkedin.com/search/results/people/`;
          alert(debugInfo);
          debugBtn.disabled = false;
          debugBtn.textContent = 'Debug Info';
        }
      }
    });
  });

  // Update status every few seconds
  setInterval(loadStatus, 3000);

  function loadSettings() {
    chrome.storage.sync.get([
      'enabled', 
      'autoCheck', 
      'delay', 
      'maxConcurrentChecks'
    ], function(result) {
      enabledToggle.checked = result.enabled !== false;
      autoCheckToggle.checked = result.autoCheck === true; // Default to false for safety
      delayInput.value = result.delay || 2000; // Conservative default
      maxChecksInput.value = result.maxConcurrentChecks || 1; // Conservative default
      updateStatus();
    });
  }

  function loadStatus() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('linkedin.com/search/results/people/')) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
          if (chrome.runtime.lastError) {
            // Content script not loaded yet
            console.log('Content script not loaded:', chrome.runtime.lastError.message);
            profilesChecked.textContent = 'N/A';
            resumesFound.textContent = 'N/A';
            extensionStatus.textContent = 'Not loaded';
            extensionStatus.style.color = '#dc2626';
            return;
          }
          
          if (response) {
            profilesChecked.textContent = response.profilesChecked || '0';
            resumesFound.textContent = response.resumesFound || '0';
          } else {
            profilesChecked.textContent = '0';
            resumesFound.textContent = '0';
          }
        });
      } else {
        profilesChecked.textContent = 'N/A';
        resumesFound.textContent = 'N/A';
        extensionStatus.textContent = 'Wrong page';
        extensionStatus.style.color = '#dc2626';
      }
    });
  }

  function updateSetting(key, value) {
    const settings = {};
    settings[key] = value;
    
    chrome.storage.sync.set(settings, function() {
      // Send message to content script about setting change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url.includes('linkedin.com/search/results/people/')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'settingUpdated',
            key: key,
            value: value
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('Error sending setting update:', chrome.runtime.lastError.message);
              // Setting was saved to storage, so it's not a critical error
            }
          });
        }
      });
    });
  }

  function updateStatus() {
    chrome.storage.sync.get(['enabled'], function(result) {
      const isEnabled = result.enabled !== false;
      extensionStatus.textContent = isEnabled ? 'Active' : 'Disabled';
      extensionStatus.style.color = isEnabled ? '#0073b1' : '#dc2626';
    });
  }

  function showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #fef3c7;
      color: #92400e;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      border: 1px solid #f59e0b;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Handle keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case 'r':
          e.preventDefault();
          refreshBtn.click();
          break;
        case 'c':
          e.preventDefault();
          clearCacheBtn.click();
          break;
      }
    }
  });
}); 