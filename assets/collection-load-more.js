/**
 * Collection Load More
 * Handles load more and infinite scroll functionality for product listings
 */
(function() {
  'use strict';

  const options = {
    loadMoreButton: '.collections-load-more',
    productGrid: '#product-grid',
    productGridContainer: '#ProductGridContainer'
  };

  const CollectionLoadMore = {
    init: function() {
      this.eventLoadMore();
    },

    eventLoadMore: function() {
      document.querySelectorAll(options.loadMoreButton).forEach(loadMore => {
        const _this = this;
        
        // Check if infinite scrolling is enabled
        if (loadMore.classList.contains('infinit-scrolling')) {
          // Use IntersectionObserver for infinite scroll
          const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
              if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                _this.loadMoreProducts(loadMore);
              }
            });
          }, {
            threshold: 0.5,
            rootMargin: '200px'
          });
          
          observer.observe(loadMore);
        } else {
          // Click handler for load more button
          loadMore.addEventListener("click", function(event) {
            event.preventDefault();
            const target = event.currentTarget;
            _this.loadMoreProducts(target);
          }, false);
        }
      });
    },

    loadMoreProducts: function(target) {
      // Prevent multiple simultaneous loads
      if (target.classList.contains('loading')) {
        return;
      }

      const loadMoreUrl = target.getAttribute('href');
      if (!loadMoreUrl) {
        return;
      }

      this.toggleLoading(target, true);

      fetch(loadMoreUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(responseText => {
          const parser = new DOMParser();
          const productNodes = parser.parseFromString(responseText, 'text/html');
          
          // Find the product grid in the response
          let productGrid = null;
          if (productNodes.querySelector(options.productGridContainer)) {
            productGrid = productNodes.querySelector(options.productGridContainer);
          } else if (productNodes.querySelector(options.productGrid)) {
            productGrid = productNodes.querySelector(options.productGrid);
          } else {
            // Try to find product grid by class
            productGrid = productNodes.querySelector('.product-grid') || productNodes.querySelector('#product-grid');
          }

          if (!productGrid) {
            throw new Error('Product grid not found in response');
          }

          // Get new product items
          const newItems = productGrid.querySelectorAll('.grid__item, li.grid__item');
          
          // Find the current product grid
          const currentGrid = document.querySelector(options.productGrid) || 
                            document.querySelector('.product-grid') ||
                            document.querySelector('#product-grid');
          
          if (!currentGrid) {
            throw new Error('Current product grid not found');
          }

          // Append new items
          newItems.forEach(item => {
            // Clone and append to avoid issues
            const clonedItem = item.cloneNode(true);
            currentGrid.appendChild(clonedItem);
          });

          // Update or remove load more button
          const newLoadMore = productNodes.querySelector('.collections-load-more');
          if (newLoadMore) {
            target.setAttribute("href", newLoadMore.getAttribute('href'));
            // Re-observe if infinite scrolling
            if (target.classList.contains('infinit-scrolling')) {
              // Reinitialize observer
              this.eventLoadMore();
            }
          } else {
            target.remove();
          }

          this.toggleLoading(target, false);

          // Reinitialize lazy loading if available
          if (typeof BlsLazyloadImg !== 'undefined' && typeof BlsLazyloadImg.init === 'function') {
            BlsLazyloadImg.init();
          }

          // Reinitialize scroll animations if available
          if (typeof initializeScrollAnimationTrigger === 'function') {
            initializeScrollAnimationTrigger();
          }

          // Reinitialize color swatches if available
          if (typeof initAllCards === 'function') {
            initAllCards();
          }

          // Dispatch custom event
          document.dispatchEvent(new CustomEvent('collection:load-more:loaded', {
            detail: { items: newItems.length }
          }));
        })
        .catch((error) => {
          console.error('Error loading more products:', error);
          this.toggleLoading(target, false);
          this.showError('Failed to load more products. Please try again.');
        });
    },

    toggleLoading: function(button, loading) {
      if (button) {
        if (loading) {
          button.classList.add('loading');
          button.setAttribute('aria-busy', 'true');
        } else {
          button.classList.remove('loading');
          button.removeAttribute('aria-busy');
        }
      }
    },

    showError: function(message) {
      // Create or update error message
      let errorElement = document.querySelector('.load-more-error');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'load-more-error';
        errorElement.style.cssText = 'text-align: center; padding: 2rem; color: rgb(var(--color-foreground)); background-color: rgba(var(--color-foreground), 0.05); border-radius: 0.4rem; margin: 2rem 0;';
        const loadMoreContainer = document.querySelector('.pagination-load-more');
        if (loadMoreContainer) {
          loadMoreContainer.appendChild(errorElement);
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
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      CollectionLoadMore.init();
    });
  } else {
    CollectionLoadMore.init();
  }

  // Re-initialize on Shopify section load/reload (for theme editor)
  document.addEventListener('shopify:section:load', function(event) {
    setTimeout(function() {
      CollectionLoadMore.init();
    }, 100);
  });

  // Re-initialize when filters are applied
  document.addEventListener('facet:rendered', function() {
    setTimeout(function() {
      CollectionLoadMore.init();
    }, 100);
  });
})();
