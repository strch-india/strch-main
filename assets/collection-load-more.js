(function () {

  const GRID_SELECTOR = '#product-grid';
  const LOADER_SELECTOR = '.pagination-load-more.auto-load';

  let observer = null;
  let isLoading = false;

  function initAutoLoad() {

    const loader = document.querySelector(LOADER_SELECTOR);
    if (!loader) return;

    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoading) {
          loadNext(loader);
        }
      });
    }, {
      rootMargin: '500px'
    });

    observer.observe(loader);
  }

  function loadNext(loader) {

    const nextUrl = loader.dataset.nextUrl;
    if (!nextUrl) return;

    isLoading = true;

    let fetchUrl = nextUrl;

    if (loader.dataset.sectionId) {
      fetchUrl += fetchUrl.includes('?')
        ? '&section_id=' + loader.dataset.sectionId
        : '?section_id=' + loader.dataset.sectionId;
    }

    fetch(fetchUrl)
      .then(res => res.text())
      .then(html => {

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const newGrid = doc.querySelector(GRID_SELECTOR);
        const currentGrid = document.querySelector(GRID_SELECTOR);

        if (!newGrid || !currentGrid) return;

        // Append new items
        newGrid.querySelectorAll('li.grid__item')
          .forEach(item => {
            currentGrid.appendChild(item.cloneNode(true));
          });

        // Find next loader in response
        const newLoader = doc.querySelector(LOADER_SELECTOR);

        if (newLoader && newLoader.dataset.nextUrl) {
          loader.dataset.nextUrl = newLoader.dataset.nextUrl;
          isLoading = false;
        } else {
          observer.disconnect();
          loader.remove();
        }

        reInitTheme();

      })
      .catch(err => {
        console.error('Auto Load Error:', err);
        isLoading = false;
      });
  }

  function reInitTheme() {
    if (typeof BlsLazyloadImg !== 'undefined' && BlsLazyloadImg.init) {
      BlsLazyloadImg.init();
    }

    if (typeof initializeScrollAnimationTrigger === 'function') {
      initializeScrollAnimationTrigger();
    }

    if (typeof initAllCards === 'function') {
      initAllCards();
    }
  }

  function init() {
    setTimeout(initAutoLoad, 200);
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('facet:rendered', init);

})();