(() => {
  const storageKeyDesktop = 'collectionGridColumnsDesktop';
  const storageKeyMobile = 'collectionGridColumnsMobile';

  const getProductGrid = () => document.getElementById('product-grid');

  const getSliderSteps = (slider) =>
    slider?.dataset.gridSteps
      ? slider.dataset.gridSteps.split(',').map((step) => step.trim())
      : [];

  const sliderValueToColumns = (slider) => {
    if (!slider) return null;
    const steps = getSliderSteps(slider);
    const index = Number(slider.value);
    return steps[index] || steps[0] || null;
  };

  const columnsToSliderIndex = (slider, columns) => {
    if (!slider) return null;
    const steps = getSliderSteps(slider);
    const idx = steps.indexOf(String(columns));
    return idx === -1 ? 0 : idx;
  };

  const isMobileToggle = (wrapper) => {
    return wrapper.classList.contains('grid-toggle--mobile') || 
           wrapper.querySelector('.grid-toggle--mobile') !== null;
  };

  const readStored = (isMobile) => {
    try {
      const key = isMobile ? storageKeyMobile : storageKeyDesktop;
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  const writeStored = (value, isMobile) => {
    try {
      const key = isMobile ? storageKeyMobile : storageKeyDesktop;
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore write errors (private mode, etc.) */
    }
  };

  const detectCurrentColumns = (grid, isMobile) => {
    const pattern = isMobile ? /^grid--\d+-col-tablet-down$/ : /^grid--\d+-col-desktop$/;
    const className = Array.from(grid.classList).find((cls) => pattern.test(cls));
    if (!className) return null;
    if (isMobile) {
      return className.replace('grid--', '').replace('-col-tablet-down', '');
    } else {
      return className.replace('grid--', '').replace('-col-desktop', '');
    }
  };

  const applyColumns = (grid, buttons, columns, persist = false, slider, isMobile = false) => {
    const safeButtons = buttons || [];
    const sliderSteps = getSliderSteps(slider);
    const available = [...safeButtons.map((button) => button.dataset.gridToggle), ...sliderSteps].filter(Boolean);

    const requested = String(columns);
    const normalized = (() => {
      if (!available.length) return requested;
      if (available.includes(requested)) return requested;
      const requestedNumber = Number(requested);
      const nearest = available
        .map((value) => ({
          value,
          distance: Math.abs(Number(value) - requestedNumber),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      return nearest?.value || available[0];
    })();
    const container = document.getElementById('ProductGridContainer');

    // Remove existing grid classes for the appropriate type
    const pattern = isMobile ? /^grid--\d+-col-tablet-down$/ : /^grid--\d+-col-desktop$/;
    Array.from(grid.classList).forEach((cls) => {
      if (pattern.test(cls)) {
        grid.classList.remove(cls);
      }
    });

    // Add the new grid class
    const classSuffix = isMobile ? '-col-tablet-down' : '-col-desktop';
    grid.classList.add(`grid--${normalized}${classSuffix}`);

    if (typeof window.recalculateCardHeights === 'function') {
      requestAnimationFrame(() => window.recalculateCardHeights());
    }
    
    safeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.gridToggle === normalized ? 'true' : 'false');
    });

    if (slider) {
      const index = columnsToSliderIndex(slider, normalized);
      if (index !== null) {
        slider.value = index;
      }
      const ticks = slider.closest('.grid-toggle__slider')?.querySelectorAll('[data-grid-tick]');
      ticks?.forEach((tick) => tick.setAttribute('data-active', tick.dataset.gridTick === normalized ? 'true' : 'false'));
    }

    // Store the choice on the container as well for any observers
    if (container) {
      if (isMobile) {
        container.dataset.gridColumnsMobile = normalized;
      } else {
        container.dataset.gridColumnsDesktop = normalized;
      }
    }

    if (persist) {
      writeStored(normalized, isMobile);
    }
  };

  const bindWrapper = (wrapper) => {
    if (wrapper.dataset.gridToggleBound === 'true') return;

    const grid = getProductGrid();
    if (!grid) return;

    const buttons = Array.from(wrapper.querySelectorAll('[data-grid-toggle]'));
    const slider = wrapper.querySelector('[data-grid-toggle-range]');
    if (!buttons.length && !slider) return;

    const isMobile = isMobileToggle(wrapper);
    const saved = readStored(isMobile);
    const defaultColumns = wrapper.dataset.gridDefault || detectCurrentColumns(grid, isMobile) || (isMobile ? '2' : '4');
    const initialColumns = saved || defaultColumns;
    applyColumns(grid, buttons, initialColumns, false, slider, isMobile);

    buttons.forEach((button) => {
      button.addEventListener('click', () =>
        applyColumns(grid, buttons, button.dataset.gridToggle, true, slider, isMobile)
      );
    });

    if (slider && slider.dataset.gridToggleBound !== 'true') {
      const handleSlider = () => {
        const columns = sliderValueToColumns(slider);
        if (columns) {
          applyColumns(grid, buttons, columns, true, slider, isMobile);
        }
      };

      slider.addEventListener('input', handleSlider);
      slider.addEventListener('change', handleSlider);
      slider.dataset.gridToggleBound = 'true';
    }

    wrapper.dataset.gridToggleBound = 'true';

    if (typeof window.recalculateCardHeights === 'function') {
      window.recalculateCardHeights();
    }
  };

  const initGridToggles = (root = document) => {
    const wrappers = root.querySelectorAll
      ? root.querySelectorAll('[data-grid-toggle-wrapper]')
      : [];

    wrappers.forEach(bindWrapper);
  };

  const watchForUpdates = () => {
    const container = document.getElementById('ProductGridContainer');
    if (!container || container.dataset.gridToggleObserved === 'true') return;

    const observer = new MutationObserver(() => initGridToggles());
    observer.observe(container, { childList: true, subtree: true });
    container.dataset.gridToggleObserved = 'true';
  };

  document.addEventListener('DOMContentLoaded', () => {
    initGridToggles();
    watchForUpdates();
  });

  document.addEventListener('shopify:section:load', (event) => {
    initGridToggles(event.target);
    watchForUpdates();
  });
})();