class LinkedInResumeDetector {
  constructor() {
    this.checkedProfiles = new Set();
    this.resumeCache = new Map();
    this.isProcessing = false;
    this.settings = {
      enabled: true,
      autoCheck: true,
      delay: 1000,
      maxConcurrentChecks: 5
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
      const searchResults = document.querySelector('.search-results-container');
      if (searchResults) {
        this.processSearchResults();
        this.observeChanges();
      } else {
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
        setTimeout(() => this.processSearchResults(), 500);
      }
    });

    const container = document.querySelector('.search-results-container');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  async processSearchResults() {
    if (this.isProcessing || !this.settings.enabled) return;
    this.isProcessing = true;

    const profileCards = document.querySelectorAll('.entity-result__item');
    console.log(`Found ${profileCards.length} profile cards`);

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
      const profileLink = card.querySelector('a[href*="/in/"]');
      if (!profileLink) return;

      const profileUrl = profileLink.href;
      const profileId = this.extractProfileId(profileUrl);
      
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
    const targetElement = card.querySelector('.entity-result__primary-subtitle') || 
                         card.querySelector('.entity-result__secondary-subtitle') ||
                         card.querySelector('.entity-result__summary');
    
    if (targetElement) {
      targetElement.appendChild(indicator);
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new LinkedInResumeDetector();
  });
} else {
  new LinkedInResumeDetector();
} 