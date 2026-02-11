/**
 * Product Infinite Scroll
 * Handles infinite scroll functionality for product listings
 */
class ProductInfiniteScroll {
  constructor(container) {
    // Allow passing a container for re-initialization
    const searchContainer = container || document;
    
    this.productGrid = searchContainer.querySelector('.product-grid-infinite');
    if (!this.productGrid) return;

    this.loader = searchContainer.querySelector('.product-infinite-scroll-loader');
    this.trigger = searchContainer.querySelector('.product-infinite-scroll-trigger');
    this.currentPage = parseInt(this.productGrid.dataset.currentPage) || 1;
    this.totalPages = parseInt(this.productGrid.dataset.totalPages) || 1;
    this.isLoading = false;
    this.observer = null;
    this.sectionId = this.productGrid.dataset.id;

    this.init();
  }

  init() {
    // Clean up any existing observer first
    if (this.observer && this.trigger) {
      this.observer.unobserve(this.trigger);
      this.observer.disconnect();
    }
    this.observer = null;

    // Re-read data attributes in case they changed
    this.currentPage = parseInt(this.productGrid.dataset.currentPage) || 1;
    this.totalPages = parseInt(this.productGrid.dataset.totalPages) || 1;
    
    if (this.currentPage >= this.totalPages) {
      // No more pages to load
      if (this.trigger) this.trigger.remove();
      return;
    }

    // Re-find trigger in case DOM was updated
    const container = this.productGrid.closest('.collection') || this.productGrid.parentElement;
    this.trigger = container ? container.querySelector('.product-infinite-scroll-trigger') : null;
    
    if (!this.trigger) {
      // No trigger means no more pages or not set up yet
      return;
    }

    // Create IntersectionObserver to detect when trigger is visible
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.isLoading && this.currentPage < this.totalPages) {
            this.loadNextPage();
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before the trigger is visible
        threshold: 0.1
      }
    );

    this.observer.observe(this.trigger);
  }

  async loadNextPage() {
    if (this.isLoading || this.currentPage >= this.totalPages) return;

    this.isLoading = true;
    this.showLoader();

    try {
      let nextPageUrl = this.trigger.dataset.nextPage;
      if (!nextPageUrl) {
        throw new Error('No next page URL found');
      }

      // Convert relative URL to absolute if needed
      if (nextPageUrl.startsWith('/')) {
        nextPageUrl = window.location.origin + nextPageUrl;
      }

      // Preserve existing query parameters (for filters, sorting, etc.)
      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(nextPageUrl);
      
      // Copy important query parameters from current URL (like filters)
      currentUrl.searchParams.forEach((value, key) => {
        // Preserve filter-related params but not page number
        if (key !== 'page' && (key.startsWith('filter_') || key === 'sort_by' || key === 'q')) {
          nextUrl.searchParams.set(key, value);
        }
      });

      // Fetch the section directly using section_id for better performance
      if (this.sectionId) {
        nextUrl.searchParams.set('section_id', this.sectionId);
      }

      nextPageUrl = nextUrl.toString();

      // Fetch the next page
      const response = await fetch(nextPageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      
      // When using section_id, Shopify returns the section HTML
      // It might be a full HTML document or just a fragment
      let doc;
      let newProductGrid = null;
      
      if (this.sectionId) {
        // Section-only response: Try parsing as full document first
        doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Check if it's a full document or fragment
        if (doc.body && doc.body.querySelector('.product-grid')) {
          // Full document structure
          newProductGrid = doc.querySelector('.product-grid') || doc.querySelector('#product-grid');
        } else {
          // Fragment - wrap it for parsing
          const wrappedHtml = `<div id="section-wrapper">${html}</div>`;
          doc = new DOMParser().parseFromString(wrappedHtml, 'text/html');
          const wrapper = doc.querySelector('#section-wrapper') || doc.body;
          newProductGrid = wrapper.querySelector('.product-grid') || wrapper.querySelector('#product-grid');
        }
      } else {
        // Full page response
        doc = new DOMParser().parseFromString(html, 'text/html');
        newProductGrid = doc.querySelector('.product-grid') || doc.querySelector('#product-grid');
      }
      
      if (!newProductGrid) {
        console.error('Product grid not found. URL:', nextPageUrl);
        console.error('HTML preview:', html.substring(0, 1000));
        throw new Error('Product grid not found in response');
      }

      // Extract new items
      const newItems = Array.from(newProductGrid.querySelectorAll('.grid__item'));
      
      if (newItems.length === 0) {
        // No more items
        if (this.trigger) this.trigger.remove();
        this.hideLoader();
        this.isLoading = false;
        return;
      }

      // Append new items to the existing grid
      newItems.forEach((item) => {
        // Remove animation classes that might interfere
        item.classList.remove('scroll-trigger');
        // Move the item from the parsed document to the live DOM
        this.productGrid.appendChild(item);
      });

      // Update current page
      this.currentPage++;
      this.productGrid.dataset.currentPage = this.currentPage;

      // Update trigger with next page URL
      // Look for trigger in the section wrapper or document
      let nextPageTrigger = null;
      if (this.sectionId) {
        // Try multiple ways to find the trigger
        const wrapper = doc.querySelector('#section-wrapper');
        if (wrapper) {
          nextPageTrigger = wrapper.querySelector('.product-infinite-scroll-trigger');
        }
        if (!nextPageTrigger) {
          // Also check the collection container
          const collectionContainer = doc.querySelector('.collection');
          if (collectionContainer) {
            nextPageTrigger = collectionContainer.querySelector('.product-infinite-scroll-trigger');
          }
        }
        if (!nextPageTrigger) {
          // Last resort: search in body
          nextPageTrigger = doc.body.querySelector('.product-infinite-scroll-trigger');
        }
      } else {
        nextPageTrigger = doc.querySelector('.product-infinite-scroll-trigger');
      }
      
      if (nextPageTrigger && nextPageTrigger.dataset.nextPage) {
        this.trigger.dataset.nextPage = nextPageTrigger.dataset.nextPage;
        // Re-observe the trigger with updated URL
        if (this.observer && this.trigger) {
          this.observer.unobserve(this.trigger);
          this.observer.observe(this.trigger);
        }
      } else {
        // No more pages
        if (this.trigger) {
          this.trigger.remove();
        }
        if (this.observer && this.trigger) {
          this.observer.unobserve(this.trigger);
        }
      }

      // Update total pages if changed
      const newTotalPages = parseInt(newProductGrid.dataset.totalPages) || this.totalPages;
      if (newTotalPages !== this.totalPages) {
        this.totalPages = newTotalPages;
        this.productGrid.dataset.totalPages = this.totalPages;
      }

      // Reinitialize scroll animations if available
      if (typeof initializeScrollAnimationTrigger === 'function') {
        initializeScrollAnimationTrigger();
      }

      // Reinitialize color swatches if available (for product cards)
      if (typeof initAllCards === 'function') {
        initAllCards();
      }

      // Re-observe the trigger if it still exists
      if (this.trigger && this.observer) {
        this.observer.unobserve(this.trigger);
        this.observer.observe(this.trigger);
      }

      this.hideLoader();
      this.isLoading = false;

      // Dispatch custom event for other scripts that might need to know
      document.dispatchEvent(new CustomEvent('product:infinite-scroll:loaded', {
        detail: { page: this.currentPage, items: newItems.length }
      }));

    } catch (error) {
      console.error('Error loading next page:', error);
      this.hideLoader();
      this.isLoading = false;
      
      // Show error message (optional)
      this.showError('Failed to load more products. Please try again.');
    }
  }

  showLoader() {
    if (this.loader) {
      this.loader.classList.remove('hidden');
      this.loader.setAttribute('aria-hidden', 'false');
    }
  }

  hideLoader() {
    if (this.loader) {
      this.loader.classList.add('hidden');
      this.loader.setAttribute('aria-hidden', 'true');
    }
  }

  showError(message) {
    // Create or update error message
    let errorElement = document.querySelector('.product-infinite-scroll-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'product-infinite-scroll-error';
      errorElement.style.cssText = 'text-align: center; padding: 2rem; color: rgb(var(--color-foreground));';
      if (this.loader) {
        this.loader.parentNode.insertBefore(errorElement, this.loader);
      } else {
        this.productGrid.parentNode.appendChild(errorElement);
      }
    }
    errorElement.textContent = message;
    
    // Remove error after 5 seconds
    setTimeout(() => {
      if (errorElement && errorElement.parentNode) {
        errorElement.remove();
      }
    }, 5000);
  }

  destroy() {
    if (this.observer) {
      if (this.trigger) {
        this.observer.unobserve(this.trigger);
      }
      this.observer.disconnect();
    }
    this.observer = null;
  }
}

// Store instances to clean up properly
const infiniteScrollInstances = new WeakMap();

function initializeInfiniteScroll(container = document) {
  // Only initialize if infinite scroll is enabled
  const productGrid = container.querySelector('.product-grid-infinite');
  if (!productGrid) return;
  
  const loadingType = productGrid.dataset.loadingType;
  if (loadingType !== 'infinite_scroll') return;

  // Clean up existing instance if any
  if (infiniteScrollInstances.has(productGrid)) {
    const oldInstance = infiniteScrollInstances.get(productGrid);
    if (oldInstance) {
      oldInstance.destroy();
    }
  }

  // Create new instance
  const instance = new ProductInfiniteScroll(container);
  if (instance.productGrid) {
    infiniteScrollInstances.set(instance.productGrid, instance);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeInfiniteScroll();
  });
} else {
  initializeInfiniteScroll();
}

// Re-initialize on Shopify section load/reload (for theme editor)
document.addEventListener('shopify:section:load', (event) => {
  const section = event.target;
  if (section.querySelector('.product-grid-infinite')) {
    setTimeout(() => {
      initializeInfiniteScroll(section);
    }, 100);
  }
});

// Re-initialize when section is selected in editor
document.addEventListener('shopify:section:select', (event) => {
  const section = event.target;
  if (section.querySelector('.product-grid-infinite')) {
    setTimeout(() => {
      initializeInfiniteScroll(section);
    }, 100);
  }
});

// Re-initialize when filters are applied (facets.js updates the grid)
document.addEventListener('facet:rendered', () => {
  setTimeout(() => {
    initializeInfiniteScroll();
  }, 100);
});
