// LinkedIn Resume Detector Content Script
(function() {
  // Prevent multiple injections
  if (window.LinkedInResumeDetectorLoaded) {
    console.log('LinkedIn Resume Detector: Already loaded, skipping initialization');
    return;
  }
  window.LinkedInResumeDetectorLoaded = true;

  console.log('=== LinkedIn Resume Detector Content Script Loading ===');
  console.log('URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  console.log('Time:', new Date().toISOString());

  class LinkedInResumeDetector {
    constructor() {
      console.log('LinkedInResumeDetector constructor called');
      this.checkedProfiles = new Set();
      this.resumeCache = new Map();
      this.isProcessing = false;
      this.settings = {
        enabled: true,
        autoCheck: false, // Disabled by default for safety
        delay: 2000, // 2 seconds minimum for safety
        maxConcurrentChecks: 1 // Conservative concurrent limit
      };
      this.stats = {
        profilesChecked: 0,
        resumesFound: 0
      };
      this.init();
    }

    init() {
      console.log('LinkedIn Resume Detector initialized on:', window.location.href);
      console.log('Current URL matches LinkedIn search:', window.location.href.includes('linkedin.com/search'));
      this.loadSettings();
      this.setupMessageListener();
      this.waitForSearchResults();
    }

    async loadSettings() {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
          if (response) {
            this.settings = { ...this.settings, ...response };
          }
          resolve();
        });
      });
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
          case 'ping':
            sendResponse({ status: 'loaded', timestamp: Date.now() });
            break;
          
          case 'refreshCheck':
            this.clearCache();
            this.processSearchResults();
            sendResponse({ success: true });
            break;
          
          case 'clearCache':
            this.clearCache();
            sendResponse({ success: true });
            break;
          
          case 'getStatus':
            sendResponse({
              profilesChecked: this.stats.profilesChecked,
              resumesFound: this.stats.resumesFound,
              isProcessing: this.isProcessing
            });
            break;
          
          case 'settingUpdated':
            this.settings[request.key] = request.value;
            if (request.key === 'enabled') {
              if (request.value) {
                this.processSearchResults();
              } else {
                this.clearIndicators();
              }
            }
            sendResponse({ success: true });
            break;
          
          case 'toggleEnabled':
            this.settings.enabled = request.enabled;
            if (request.enabled) {
              this.processSearchResults();
            } else {
              this.clearIndicators();
            }
            sendResponse({ success: true });
            break;
        }
      });
    }

    waitForSearchResults() {
      const checkForResults = () => {
        console.log('LinkedIn Resume Detector: Checking for search results...');
        
        // Try multiple selectors for LinkedIn search results
        const searchResults = document.querySelector('.search-results-container') || 
                             document.querySelector('.search-results') ||
                             document.querySelector('[data-chameleon-result-urn]')?.parentElement ||
                             document.querySelector('.reusable-search-results-list');
        
        if (searchResults) {
          console.log('LinkedIn Resume Detector: Found search results container');
          this.processSearchResults();
          this.observeChanges();
        } else {
          console.log('LinkedIn Resume Detector: No search results found, retrying...');
          setTimeout(checkForResults, 1000);
        }
      };
      checkForResults();
    }

    observeChanges() {
      const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            shouldProcess = true;
          }
        });
        if (shouldProcess && !this.isProcessing && this.settings.enabled && this.settings.autoCheck) {
          console.log('LinkedIn Resume Detector: Page content changed, processing new results...');
          setTimeout(() => this.processSearchResults(), 500);
        }
      });

      // Try multiple selectors for the container to observe
      const container = document.querySelector('.search-results-container') ||
                       document.querySelector('.search-results') ||
                       document.querySelector('.reusable-search-results-list') ||
                       document.querySelector('[data-chameleon-result-urn]')?.parentElement ||
                       document.body;
      
      if (container) {
        console.log('LinkedIn Resume Detector: Setting up mutation observer');
        observer.observe(container, { childList: true, subtree: true });
      } else {
        console.log('LinkedIn Resume Detector: No container found for mutation observer');
      }
    }

    async processSearchResults() {
      if (this.isProcessing || !this.settings.enabled) return;
      this.isProcessing = true;

      // Debug: Show what's actually on the page
      console.log('=== DEBUGGING PROFILE CARD SELECTORS ===');
      console.log('Current URL:', window.location.href);
      console.log('Page title:', document.title);
      
      // Try multiple selectors for LinkedIn profile cards (updated for 2024)
      const selectorOptions = [
        '.entity-result__item',                    // Common search result item
        '.reusable-search__result-container',      // Older LinkedIn layout
        '[data-chameleon-result-urn]',             // Data attribute selector
        '.search-result',                          // Generic search result
        '.search-results-container .artdeco-list__item', // Artdeco list items
        '.search-result__wrapper',                 // Result wrapper
        '.entity-result',                          // Entity result
        '.search-entity-result',                   // Search entity result
        '.org-people-profile-card',                // Organization people cards
        '.search-results-container [data-test-id]', // Data test ID elements
        '.search-results-container li',            // List items in search results
        '.artdeco-list li'                         // Artdeco list items
      ];

      let profileCards = [];
      let usedSelector = '';

      // Try each selector until we find profile cards
      for (const selector of selectorOptions) {
        const elements = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": found ${elements.length} elements`);
        
        if (elements.length > 0) {
          profileCards = elements;
          usedSelector = selector;
          break;
        }
      }

      // If no specific selectors work, try to find any containers with profile links
      if (profileCards.length === 0) {
        console.log('No profile cards found with known selectors, trying fallback...');
        const fallbackElements = document.querySelectorAll('*[href*="/in/"], *[href*="/search/results/people/"]');
        if (fallbackElements.length > 0) {
          // Get parent containers of profile links
          const containers = new Set();
          fallbackElements.forEach(el => {
            let parent = el.closest('li') || el.closest('[data-test-id]') || el.closest('.artdeco-list__item');
            if (parent) containers.add(parent);
          });
          profileCards = Array.from(containers);
          usedSelector = 'fallback (parent containers of profile links)';
        }
      }

      console.log(`LinkedIn Resume Detector: Found ${profileCards.length} profile cards using selector: ${usedSelector}`);
      
      if (profileCards.length === 0) {
        console.log('LinkedIn Resume Detector: No profile cards found with any selectors');
        console.log('Available elements on page:', document.querySelectorAll('*').length);
        console.log('Search results container:', document.querySelector('.search-results-container') ? 'Found' : 'Not found');
        this.isProcessing = false;
        return;
      }

      // Process cards in batches to respect maxConcurrentChecks
      const batchSize = this.settings.maxConcurrentChecks;
      for (let i = 0; i < profileCards.length; i += batchSize) {
        const batch = Array.from(profileCards).slice(i, i + batchSize);
        await Promise.all(batch.map(card => this.processProfileCard(card)));
      }

      this.isProcessing = false;
      this.updateBadge();
    }

    async processProfileCard(card) {
      try {
        // Try multiple selectors for profile links
        const profileLink = card.querySelector('a[href*="/in/"]') ||
                           card.querySelector('a[href*="linkedin.com/in/"]') ||
                           card.querySelector('[data-control-name="search_srp_result"]') ||
                           card.querySelector('.app-aware-link');
        
        if (!profileLink) {
          console.log('LinkedIn Resume Detector: No profile link found in card');
          return;
        }

        const profileUrl = profileLink.href;
        const profileId = this.extractProfileId(profileUrl);
        
        console.log(`LinkedIn Resume Detector: Processing profile ${profileId}`);
        
        if (this.checkedProfiles.has(profileId)) {
          this.updateCardIndicator(card, this.resumeCache.get(profileId));
          return;
        }

        // Add loading indicator
        this.addLoadingIndicator(card);

        // Check if profile has resume
        const hasResume = await this.checkProfileForResume(profileUrl);
        
        // Cache result
        this.checkedProfiles.add(profileId);
        this.resumeCache.set(profileId, hasResume);

        // Update statistics
        this.stats.profilesChecked++;
        if (hasResume) {
          this.stats.resumesFound++;
        }

        // Update UI
        this.updateCardIndicator(card, hasResume);
        
        // Add delay to avoid rate limiting
        await this.delay(this.settings.delay + Math.random() * 500);
        
      } catch (error) {
        console.error('Error processing profile card:', error);
        this.removeLoadingIndicator(card);
      }
    }

    extractProfileId(url) {
      const match = url.match(/\/in\/([^\/\?]+)/);
      return match ? match[1] : url;
    }

    async checkProfileForResume(profileUrl) {
      try {
        const response = await fetch(profileUrl, {
          credentials: 'include',
          headers: {
            'User-Agent': navigator.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (!response.ok) {
          console.warn('Failed to fetch profile:', response.status);
          return false;
        }

        const html = await response.text();
        
        // Enhanced resume detection patterns
        const resumePatterns = [
          // Direct resume/CV keywords
          /resume|cv|curriculum vitae/i,
          // Document-related indicators
          /document.*download|download.*document/i,
          // Featured section with documents
          /featured.*document|document.*featured/i,
          // LinkedIn document URLs
          /linkedin\.com\/document/i,
          // File attachment indicators
          /attachment.*pdf|pdf.*attachment/i,
          // Professional document terms
          /professional.*document|document.*professional/i
        ];

        // Check for resume indicators
        const hasResumeIndicators = resumePatterns.some(pattern => pattern.test(html));
        
        // Look for specific LinkedIn document links
        const hasDocumentLinks = /href="[^"]*\/document\/[^"]*"/i.test(html);
        
        // Check for featured items section
        const hasFeaturedSection = html.includes('pv-featured-item') || html.includes('featured-item');
        
        // Look for download buttons or links
        const hasDownloadLinks = /download|view.*document/i.test(html);

        return hasResumeIndicators || hasDocumentLinks || (hasFeaturedSection && hasDownloadLinks);
        
      } catch (error) {
        console.error('Error checking profile for resume:', error);
        return false;
      }
    }

    addLoadingIndicator(card) {
      const existing = card.querySelector('.resume-indicator');
      if (existing) existing.remove();

      const indicator = document.createElement('div');
      indicator.className = 'resume-indicator loading';
      indicator.innerHTML = '<div class="loading-spinner"></div>';
      indicator.title = 'Checking for resume...';
      
      this.insertIndicator(card, indicator);
    }

    removeLoadingIndicator(card) {
      const indicator = card.querySelector('.resume-indicator.loading');
      if (indicator) indicator.remove();
    }

    updateCardIndicator(card, hasResume) {
      const existing = card.querySelector('.resume-indicator');
      if (existing) existing.remove();

      const indicator = document.createElement('div');
      indicator.className = `resume-indicator ${hasResume ? 'has-resume' : 'no-resume'}`;
      indicator.innerHTML = hasResume ? '📄' : '❌';
      indicator.title = hasResume ? 'Resume/CV available - Click to view profile' : 'No resume found';
      
      // Add click functionality for resume indicators
      if (hasResume) {
        indicator.style.cursor = 'pointer';
        indicator.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('📄 Resume icon clicked!');
          
          // Extract profile URL from the card
          const profileUrl = this.getProfileUrlFromCard(card);
          if (profileUrl) {
            console.log('Opening profile resume:', profileUrl);
            // Open profile in new tab and navigate to documents/featured section
            this.openProfileResume(profileUrl);
          } else {
            console.error('Could not extract profile URL from card');
            this.showNotification('❌ Could not find profile URL');
          }
        });
        
        // Add hover effect
        indicator.addEventListener('mouseenter', () => {
          indicator.style.transform = 'scale(1.1)';
          indicator.style.transition = 'transform 0.2s';
        });
        
        indicator.addEventListener('mouseleave', () => {
          indicator.style.transform = 'scale(1)';
        });
      }
      
      this.insertIndicator(card, indicator);
    }

    insertIndicator(card, indicator) {
      // Try multiple selectors for where to place the indicator
      const targetElement = card.querySelector('.entity-result__primary-subtitle') || 
                           card.querySelector('.entity-result__secondary-subtitle') ||
                           card.querySelector('.entity-result__summary') ||
                           card.querySelector('.search-result__info') ||
                           card.querySelector('.result-lockup__name') ||
                           card.querySelector('.search-result__wrapper') ||
                           card.querySelector('.reusable-search__result-container-inner');
      
      if (targetElement) {
        console.log('LinkedIn Resume Detector: Inserting indicator');
        targetElement.appendChild(indicator);
      } else {
        console.log('LinkedIn Resume Detector: No suitable element found for indicator placement');
        // Fallback: try to insert at the end of the card
        card.appendChild(indicator);
      }
    }

    getProfileUrlFromCard(card) {
      // Try multiple selectors for profile links
      const profileLink = card.querySelector('a[href*="/in/"]') ||
                         card.querySelector('a[href*="linkedin.com/in/"]') ||
                         card.querySelector('[data-control-name="search_srp_result"]') ||
                         card.querySelector('.app-aware-link');
      
      if (profileLink) {
        return profileLink.href;
      }
      
      // Fallback: try to find any link that looks like a profile
      const allLinks = card.querySelectorAll('a[href]');
      for (const link of allLinks) {
        if (link.href.includes('/in/') && link.href.includes('linkedin.com')) {
          return link.href;
        }
      }
      
      return null;
    }

    openProfileResume(profileUrl) {
      console.log('Opening profile resume for:', profileUrl);
      
      // Clean the profile URL to ensure it's in the correct format
      let cleanUrl = profileUrl.split('?')[0]; // Remove query parameters
      if (!cleanUrl.endsWith('/')) {
        cleanUrl += '/';
      }
      
      // Try multiple LinkedIn sections where resumes might be found
      const resumeSections = [
        'details/featured/',           // Featured section (most common for resumes)
        'details/documents/',          // Documents section
        'details/experience/',         // Experience section (sometimes has resume links)
        'details/skills/',             // Skills section
        ''                            // Fallback to main profile
      ];
      
      // Start with the most likely section
      const resumeUrl = cleanUrl + resumeSections[0];
      
      // Open in new tab
      window.open(resumeUrl, '_blank', 'noopener,noreferrer');
      
      // Show notification
      this.showNotification('Opening profile resume in new tab...');
    }

    showNotification(message) {
      // Create a temporary notification
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #0073b1;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
      `;
      
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(() => {
            notification.parentNode.removeChild(notification);
          }, 300);
        }
      }, 3000);
    }

    clearCache() {
      this.checkedProfiles.clear();
      this.resumeCache.clear();
      this.stats.profilesChecked = 0;
      this.stats.resumesFound = 0;
      this.clearIndicators();
    }

    clearIndicators() {
      const indicators = document.querySelectorAll('.resume-indicator');
      indicators.forEach(indicator => indicator.remove());
    }

    updateBadge() {
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: this.stats.resumesFound
      });
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Debug function for troubleshooting
    debugInfo() {
      console.log('=== LinkedIn Resume Detector Debug Info ===');
      console.log('Current URL:', window.location.href);
      console.log('Settings:', this.settings);
      console.log('Stats:', this.stats);
      console.log('Is processing:', this.isProcessing);
      
      // Check for search results containers
      const containers = [
        '.search-results-container',
        '.search-results',
        '.reusable-search-results-list',
        '[data-chameleon-result-urn]'
      ];
      
      console.log('--- Container Detection ---');
      containers.forEach(selector => {
        const element = document.querySelector(selector);
        console.log(`${selector}: ${element ? 'FOUND' : 'NOT FOUND'}`);
      });
      
      // Check for profile cards
      const cardSelectors = [
        '.entity-result__item',
        '.reusable-search__result-container',
        '[data-chameleon-result-urn]',
        '.search-result'
      ];
      
      console.log('--- Profile Card Detection ---');
      cardSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`${selector}: ${elements.length} found`);
      });
      
      console.log('=== End Debug Info ===');
    }
  }

  // Initialize the detector
  let detector;

  // Global debug function for testing
  window.ResumeHuntDebug = {
    get detector() { return detector; },
    debugInfo: function() {
      if (!detector) {
        console.log('=== LinkedIn Resume Detector NOT INITIALIZED ===');
        return null;
      }
      console.log('=== LinkedIn Resume Detector Debug Info ===');
      console.log('Current URL:', window.location.href);
      console.log('Settings:', detector.settings);
      console.log('Stats:', detector.stats);
      console.log('Is processing:', detector.isProcessing);
      console.log('Cache size:', detector.resumeCache.size);
      console.log('Checked profiles:', detector.checkedProfiles.size);
      
      // Check for profile cards with updated selectors
      const selectorOptions = [
        '.entity-result__item',
        '.reusable-search__result-container',
        '[data-chameleon-result-urn]',
        '.search-result',
        '.search-results-container .artdeco-list__item',
        '.search-result__wrapper',
        '.entity-result',
        '.search-entity-result',
        '.org-people-profile-card',
        '.search-results-container [data-test-id]',
        '.search-results-container li',
        '.artdeco-list li'
      ];
      
      console.log('Profile card selector results:');
      selectorOptions.forEach(selector => {
        const count = document.querySelectorAll(selector).length;
        console.log(`  ${selector}: ${count} elements`);
      });
      
      console.log('=== End Debug Info ===');
      return detector;
    },
    testRefresh: function() {
      if (!detector) {
        console.log('Detector not initialized!');
        return;
      }
      console.log('Testing refresh...');
      detector.clearCache();
      detector.processSearchResults();
    },
    testMessageHandling: function() {
      if (!detector) {
        console.log('Detector not initialized!');
        return;
      }
      console.log('Testing message handling...');
      const testMessage = { action: 'getStatus' };
      const response = detector.handleMessage(testMessage);
      console.log('Response:', response);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        detector = new LinkedInResumeDetector();
        console.log('LinkedIn Resume Detector: Initialized successfully. Type "ResumeHuntDebug.debugInfo()" in console for debugging.');
      } catch (error) {
        console.error('LinkedIn Resume Detector: Failed to initialize:', error);
      }
    });
  } else {
    try {
      detector = new LinkedInResumeDetector();
      console.log('LinkedIn Resume Detector: Initialized successfully. Type "ResumeHuntDebug.debugInfo()" in console for debugging.');
    } catch (error) {
      console.error('LinkedIn Resume Detector: Failed to initialize:', error);
    }
  }

  // Final verification
  setTimeout(() => {
    console.log('=== Final Content Script Verification ===');
    console.log('ResumeHuntDebug available:', typeof window.ResumeHuntDebug !== 'undefined');
    console.log('Detector instance:', detector ? 'Available' : 'Not available');
    if (window.ResumeHuntDebug) {
      console.log('Test debug info:', window.ResumeHuntDebug.debugInfo ? 'Available' : 'Not available');
    }
    console.log('✨ NEW FEATURE: Click on green 📄 resume icons to open profiles!');
    console.log('=== End Verification ===');
  }, 1000);
})(); 