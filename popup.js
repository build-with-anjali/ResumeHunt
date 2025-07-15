// Popup script for LinkedIn Resume Detector
document.addEventListener('DOMContentLoaded', function() {
  const enabledToggle = document.getElementById('enabledToggle');
  const autoCheckToggle = document.getElementById('autoCheckToggle');
  const delayInput = document.getElementById('delayInput');
  const maxChecksInput = document.getElementById('maxChecksInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const forceReloadBtn = document.getElementById('forceReloadBtn');
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

  forceReloadBtn.addEventListener('click', function() {
    this.disabled = true;
    this.textContent = 'Force Reloading...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        const isLinkedIn = currentUrl.includes('linkedin.com');
        
        if (!isLinkedIn) {
          showNotification('Please navigate to LinkedIn first');
          forceReloadBtn.disabled = false;
          forceReloadBtn.textContent = 'Force Reload';
          return;
        }
        
        console.log('=== FORCE RELOAD DEBUGGING ===');
        console.log('Tab URL:', currentUrl);
        console.log('Tab ID:', tabs[0].id);
        
        // Method 1: Try direct file injection
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }).then(() => {
          console.log('✅ Method 1 (Direct file injection) - SUCCESS');
          showNotification('Content script injected successfully!');
          setTimeout(() => {
            forceReloadBtn.disabled = false;
            forceReloadBtn.textContent = 'Force Reload';
            loadStatus();
          }, 1000);
        }).catch(error => {
          console.error('❌ Method 1 (Direct file injection) - FAILED:', error);
          
          // Method 2: Try inline code injection with embedded script
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: function() {
              console.log('=== INLINE INJECTION TESTING ===');
              console.log('Current URL:', window.location.href);
              console.log('Document title:', document.title);
              console.log('Page loaded:', document.readyState);
              
              // Check for existing script
              if (window.LinkedInResumeDetectorLoaded) {
                console.log('✅ Content script already loaded');
                return { success: true, message: 'Already loaded' };
              }
              
              // Check for CSP blocking
              const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
              if (cspMeta) {
                console.log('⚠️ CSP detected:', cspMeta.content);
              }
              
              // Test if we can create and execute scripts
              try {
                const testScript = document.createElement('script');
                testScript.textContent = 'console.log("✅ Script execution test passed");';
                document.head.appendChild(testScript);
                document.head.removeChild(testScript);
                console.log('✅ Script execution allowed');
              } catch (e) {
                console.error('❌ Script execution blocked:', e);
                return { success: false, message: 'Script execution blocked' };
              }
              
              // Try to load content script via URL
              try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('content.js');
                script.onload = function() {
                  console.log('✅ Content script loaded via URL');
                };
                script.onerror = function(e) {
                  console.error('❌ Content script URL load failed:', e);
                };
                document.head.appendChild(script);
                return { success: true, message: 'Script injection attempted' };
              } catch (e) {
                console.error('❌ Script URL injection failed:', e);
                return { success: false, message: 'URL injection failed' };
              }
            }
          }).then((results) => {
            const result = results[0]?.result;
            console.log('Method 2 result:', result);
            
            if (result?.success) {
              showNotification('Content script injection attempted - check console');
            } else {
              showNotification('Content script injection failed: ' + (result?.message || 'Unknown error'));
            }
            
            setTimeout(() => {
              forceReloadBtn.disabled = false;
              forceReloadBtn.textContent = 'Force Reload';
              loadStatus();
            }, 2000);
          }).catch(fallbackError => {
            console.error('❌ Method 2 (Inline injection) - FAILED:', fallbackError);
            
            // Method 3: Try direct code injection
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: function() {
                // Embed the minimal content script directly
                if (window.LinkedInResumeDetectorLoaded) {
                  console.log('Content script already loaded');
                  return;
                }
                
                console.log('=== DIRECT CODE INJECTION ===');
                window.LinkedInResumeDetectorLoaded = true;
                
                // Create a minimal detector
                window.ResumeHuntDebug = {
                  debugInfo: function() {
                    console.log('=== Minimal Debug Info ===');
                    console.log('URL:', window.location.href);
                    console.log('Title:', document.title);
                    console.log('Content script: Injected via Method 3');
                    
                    // Test profile card detection
                    const selectors = [
                      '.entity-result__item',
                      '.search-results-container li',
                      '.artdeco-list li',
                      '[data-chameleon-result-urn]'
                    ];
                    
                    selectors.forEach(sel => {
                      const count = document.querySelectorAll(sel).length;
                      console.log(`${sel}: ${count} elements`);
                    });
                    
                    console.log('=== End Debug Info ===');
                  }
                };
                
                console.log('✅ Minimal content script injected');
                console.log('Try: ResumeHuntDebug.debugInfo()');
              }
            }).then(() => {
              console.log('✅ Method 3 (Direct code injection) - SUCCESS');
              showNotification('Minimal content script injected - try ResumeHuntDebug.debugInfo()');
              setTimeout(() => {
                forceReloadBtn.disabled = false;
                forceReloadBtn.textContent = 'Force Reload';
                loadStatus();
              }, 1000);
            }).catch(finalError => {
              console.error('❌ All injection methods failed:', finalError);
              showNotification('All injection methods failed - check console');
              forceReloadBtn.disabled = false;
              forceReloadBtn.textContent = 'Force Reload';
            });
          });
        });
      } else {
        forceReloadBtn.disabled = false;
        forceReloadBtn.textContent = 'Force Reload';
        showNotification('No active tab found');
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
      
      // Check if we're on a LinkedIn search page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          const url = tabs[0].url;
          const isLinkedInSearch = url.includes('linkedin.com/search');
          
          if (!isLinkedInSearch) {
            extensionStatus.textContent = 'Navigate to LinkedIn search';
            extensionStatus.style.color = '#f59e0b';
            return;
          }
          
          // Test if content script is loaded
          chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
            if (chrome.runtime.lastError) {
              extensionStatus.textContent = 'Content script not loaded';
              extensionStatus.style.color = '#dc2626';
            } else if (isEnabled) {
              extensionStatus.textContent = 'Active';
              extensionStatus.style.color = '#22c55e';
            } else {
              extensionStatus.textContent = 'Disabled';
              extensionStatus.style.color = '#dc2626';
            }
          });
        } else {
          extensionStatus.textContent = 'Unknown status';
          extensionStatus.style.color = '#6b7280';
        }
      });
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