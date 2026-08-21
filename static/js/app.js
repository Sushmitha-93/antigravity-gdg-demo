/**
 * BigQuery Release Notes Web Application
 * Vanilla JavaScript Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    feedData: null,
    activeCategory: 'ALL',
    searchTerm: '',
    selectedForTweet: null,
    isLoading: false
  };

  // DOM Elements
  const refreshBtn = document.getElementById('refresh-btn');
  const lastUpdatedText = document.getElementById('last-updated-text');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterPillsContainer = document.getElementById('filter-pills');
  const feedContainer = document.getElementById('feed-container');
  const noResultsEl = document.getElementById('no-results');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const statsCounter = document.getElementById('stats-counter');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const retryBtn = document.getElementById('retry-btn');

  // Tweet Modal Elements
  const tweetModal = document.getElementById('tweet-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const tweetTextarea = document.getElementById('tweet-textarea');
  const charCounter = document.getElementById('char-counter');
  const copyTweetBtn = document.getElementById('copy-tweet-btn');
  const postTweetBtn = document.getElementById('post-tweet-btn');
  const modalUpdateDate = document.getElementById('modal-update-date');
  const modalUpdateCategory = document.getElementById('modal-update-category');
  const modalUpdateSnippet = document.getElementById('modal-update-snippet');
  const tagPills = document.querySelectorAll('.tag-pill');
  const toastContainer = document.getElementById('toast-container');

  // =========================================================================
  // Feed Fetching & Management
  // =========================================================================

  async function fetchFeed(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    // UI loading states
    refreshBtn.classList.add('is-loading');
    refreshBtn.disabled = true;
    errorBanner.style.display = 'none';

    const url = forceRefresh ? '/api/feed?refresh=1' : '/api/feed';

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'Error fetching feed');
      }

      state.feedData = data.feed;

      // Update timestamp
      const fetchedDate = data.fetched_at ? new Date(data.fetched_at * 1000) : new Date();
      lastUpdatedText.textContent = `Updated: ${fetchedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      renderFeed();

      if (forceRefresh) {
        showToast('Feed refreshed successfully!', 'success');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showError(`Could not load release notes: ${err.message}`);
    } finally {
      state.isLoading = false;
      refreshBtn.classList.remove('is-loading');
      refreshBtn.disabled = false;
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.style.display = 'flex';
  }

  // =========================================================================
  // Feed Rendering & Filtering
  // =========================================================================

  function renderFeed() {
    if (!state.feedData || !state.feedData.entries) {
      feedContainer.innerHTML = '';
      return;
    }

    const term = state.searchTerm.trim().toLowerCase();
    const cat = state.activeCategory;

    let totalVisibleUpdates = 0;
    let totalVisibleEntries = 0;

    const filteredEntries = state.feedData.entries.map(entry => {
      // Filter updates inside the entry
      const matchingUpdates = entry.updates.filter(update => {
        const matchesCategory = (cat === 'ALL') || (update.category.toLowerCase() === cat.toLowerCase());
        const matchesSearch = !term || 
          update.summary_text.toLowerCase().includes(term) || 
          update.category.toLowerCase().includes(term) ||
          entry.title.toLowerCase().includes(term);

        return matchesCategory && matchesSearch;
      });

      return {
        ...entry,
        visibleUpdates: matchingUpdates
      };
    }).filter(entry => entry.visibleUpdates.length > 0);

    filteredEntries.forEach(e => {
      totalVisibleUpdates += e.visibleUpdates.length;
      totalVisibleEntries += 1;
    });

    // Update stats counter
    statsCounter.textContent = `Showing ${totalVisibleUpdates} update${totalVisibleUpdates === 1 ? '' : 's'} across ${totalVisibleEntries} release date${totalVisibleEntries === 1 ? '' : 's'}`;

    if (filteredEntries.length === 0) {
      feedContainer.innerHTML = '';
      noResultsEl.style.display = 'flex';
      return;
    }

    noResultsEl.style.display = 'none';

    // Render HTML cards
    const cardsHtml = filteredEntries.map(entry => {
      const updatesHtml = entry.visibleUpdates.map((update, idx) => {
        const catClass = getCategoryClass(update.category);
        const processedHtml = sanitizeAndProcessHtml(update.content_html);

        // Escape data for Tweet button attributes
        const safeSummary = escapeHtmlAttribute(update.summary_text);
        const safeTitle = escapeHtmlAttribute(entry.title);
        const safeCategory = escapeHtmlAttribute(update.category);
        const safeLink = escapeHtmlAttribute(entry.link);

        return `
          <article class="update-item" data-category="${update.category}">
            <div class="update-item-header">
              <span class="category-badge ${catClass}">${escapeHtml(update.category)}</span>
              <button class="tweet-action-btn" 
                      data-date="${safeTitle}" 
                      data-category="${safeCategory}" 
                      data-link="${safeLink}" 
                      data-summary="${safeSummary}" 
                      title="Share this specific update on X (Twitter)">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Tweet</span>
              </button>
            </div>
            <div class="update-item-content">
              ${processedHtml}
            </div>
          </article>
        `;
      }).join('');

      return `
        <div class="entry-card">
          <div class="entry-header">
            <div class="entry-title-group">
              <svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <h2 class="entry-title">${escapeHtml(entry.title)}</h2>
            </div>
            <div class="entry-actions">
              <a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer" class="docs-link" title="Open in official Google Cloud docs">
                <span>View in Docs</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>
          <div class="entry-body">
            ${updatesHtml}
          </div>
        </div>
      `;
    }).join('');

    feedContainer.innerHTML = cardsHtml;

    // Attach click listeners to tweet buttons
    document.querySelectorAll('.tweet-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const updateData = {
          date: btn.dataset.date,
          category: btn.dataset.category,
          link: btn.dataset.link,
          summary: btn.dataset.summary
        };
        openTweetModal(updateData);
      });
    });
  }

  function getCategoryClass(category) {
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('feature')) return 'category-feature';
    if (catLower.includes('deprecat')) return 'category-deprecated';
    if (catLower.includes('announc')) return 'category-announcement';
    if (catLower.includes('change') || catLower.includes('fix')) return 'category-changed';
    return 'category-general';
  }

  function sanitizeAndProcessHtml(htmlString) {
    if (!htmlString) return '';
    // Ensure all <a> tags open in new tab securely
    let modified = htmlString.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi, (match, href, rest) => {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${rest}>`;
    });
    return modified;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeHtmlAttribute(str) {
    if (!str) return '';
    return str
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, ' ');
  }

  // =========================================================================
  // Tweet Composer Modal Logic
  // =========================================================================

  function openTweetModal(update) {
    state.selectedForTweet = update;

    // Update preview details
    modalUpdateDate.textContent = update.date;
    modalUpdateCategory.textContent = update.category;
    modalUpdateCategory.className = `category-badge ${getCategoryClass(update.category)}`;
    modalUpdateSnippet.textContent = update.summary;

    // Compose draft tweet text
    // Truncate summary to keep tweet within comfortable 280 char limits
    const maxSummaryLen = 140;
    let snippet = update.summary.replace(/\s+/g, ' ').trim();
    if (snippet.length > maxSummaryLen) {
      snippet = snippet.substring(0, maxSummaryLen - 3) + '...';
    }

    const draft = `🚀 #BigQuery Update (${update.date} - ${update.category}):\n${snippet}\n\n🔗 ${update.link}\n#GoogleCloud #DataEngineering`;

    tweetTextarea.value = draft;
    updateCharCount();

    // Show modal
    tweetModal.classList.add('is-active');
    tweetModal.setAttribute('aria-hidden', 'false');
    tweetTextarea.focus();
  }

  function closeTweetModal() {
    tweetModal.classList.remove('is-active');
    tweetModal.setAttribute('aria-hidden', 'true');
    state.selectedForTweet = null;
  }

  function updateCharCount() {
    const len = tweetTextarea.value.length;
    const max = 280;
    charCounter.textContent = `${len} / ${max}`;

    charCounter.classList.remove('is-warning', 'is-exceeded');
    if (len > max) {
      charCounter.classList.add('is-exceeded');
    } else if (len > 240) {
      charCounter.classList.add('is-warning');
    }
  }

  function copyTweetText() {
    const text = tweetTextarea.value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Tweet copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      // Fallback
      tweetTextarea.select();
      document.execCommand('copy');
      showToast('Tweet copied to clipboard!', 'success');
    });
  }

  function postToTwitter() {
    const text = tweetTextarea.value;
    if (!text) return;

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=450,resizable=yes,scrollbars=yes');
  }

  // =========================================================================
  // Toast Notification System
  // =========================================================================

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        ${type === 'success' 
          ? '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>'
          : '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'}
      </svg>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================

  // Refresh Button
  refreshBtn.addEventListener('click', () => fetchFeed(true));
  retryBtn.addEventListener('click', () => fetchFeed(true));

  // Search Input
  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    clearSearchBtn.style.display = state.searchTerm ? 'block' : 'none';
    renderFeed();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchTerm = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderFeed();
  });

  // Filter Category Pills
  filterPillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;

    filterPillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    state.activeCategory = pill.dataset.category || 'ALL';
    renderFeed();
  });

  // Reset Filters Button
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchTerm = '';
    clearSearchBtn.style.display = 'none';
    state.activeCategory = 'ALL';
    filterPillsContainer.querySelectorAll('.pill').forEach(p => {
      p.classList.toggle('active', p.dataset.category === 'ALL');
    });
    renderFeed();
  });

  // Tweet Modal Controls
  closeModalBtn.addEventListener('click', closeTweetModal);
  cancelModalBtn.addEventListener('click', closeTweetModal);
  tweetTextarea.addEventListener('input', updateCharCount);
  copyTweetBtn.addEventListener('click', copyTweetText);
  postTweetBtn.addEventListener('click', postToTwitter);

  // Close modal when clicking on backdrop
  tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
      closeTweetModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tweetModal.classList.contains('is-active')) {
      closeTweetModal();
    }
  });

  // Suggested Hashtag Pills
  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const tag = pill.dataset.tag;
      if (!tweetTextarea.value.includes(tag)) {
        tweetTextarea.value = `${tweetTextarea.value.trim()} ${tag}`;
        updateCharCount();
      }
    });
  });

  // Initial Load
  fetchFeed(false);
});
