class LinkedInResumeDetector {
  constructor() {
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
    console.log('LinkedIn Resume Detector initialized');
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

    // Try multiple selectors for LinkedIn profile cards
    const profileCards = document.querySelectorAll('.entity-result__item') || 
                        document.querySelectorAll('.reusable-search__result-container') ||
                        document.querySelectorAll('[data-chameleon-result-urn]') ||
                        document.querySelectorAll('.search-result');

    console.log(`LinkedIn Resume Detector: Found ${profileCards.length} profile cards`);
    
    if (profileCards.length === 0) {
      console.log('LinkedIn Resume Detector: No profile cards found with current selectors');
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
    indicator.title = hasResume ? 'Resume/CV available' : 'No resume found';
    
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
      const cardContainer = card.querySelector('.entity-result') || card;
      if (cardContainer) {
        cardContainer.appendChild(indicator);
      }
    }
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

// Make debug function available globally
window.ResumeHuntDebug = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const detector = new LinkedInResumeDetector();
      window.ResumeHuntDebug = detector;
      console.log('LinkedIn Resume Detector: Initialized successfully. Type "ResumeHuntDebug.debugInfo()" in console for debugging.');
    } catch (error) {
      console.error('LinkedIn Resume Detector: Failed to initialize:', error);
    }
  });
} else {
  try {
    const detector = new LinkedInResumeDetector();
    window.ResumeHuntDebug = detector;
    console.log('LinkedIn Resume Detector: Initialized successfully. Type "ResumeHuntDebug.debugInfo()" in console for debugging.');
  } catch (error) {
    console.error('LinkedIn Resume Detector: Failed to initialize:', error);
  }
} 