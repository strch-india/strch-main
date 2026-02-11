(function () {
  'use strict';
  // SAFEST fetch helper: supports raw text + parsed JSON
  async function fetchJsonOrText(url) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json,text/plain,text/html,*/*'
      }
    });

    const rawText = await response.text();

    let parsed = null;
    let isJson = false;

    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
        isJson = true;
      } catch (e) {
        isJson = false;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      isJson,
      rawText,
      data: parsed
    };
  }

  // Event delegation (replacement for jQuery(document).on)
  document.addEventListener('click', async function (event) {
    const trigger = event.target.closest('[data-ele="color-group-product"]');

    if (!trigger) return;


    const quickAddModal = trigger.closest('quick-add-modal')
    if (quickAddModal && quickAddModal.hasAttribute('open')) {
        event.preventDefault();
        const modalContent = quickAddModal.querySelector('[id^="QuickAddInfo-"]');
        const actionUrl = trigger.getAttribute('href');
        const result = await fetchJsonOrText(actionUrl);
        if (!result.ok) {
            console.error('Request failed:', result.status, result.rawText);
            return;
        }
        
        console.log('result', result);
        const responseHTML = new DOMParser().parseFromString(result.rawText, 'text/html');
        const productElement = responseHTML.querySelector('product-info');
        console.log('productElement', productElement);
        console.log('productElement.outerHTML', productElement.outerHTML);
        HTMLUpdateUtility.setInnerHTML(modalContent, productElement.outerHTML);
        return;
    }

     // 2. PRODUCT PAGE → NORMAL NAVIGATION
    const productInfo = trigger.closest('product-info')
    if (productInfo) {
      return;
    }

    event.preventDefault();
    const params = new URLSearchParams({
        media_aspect_ratio: trigger.dataset.media_aspect_ratio,
        image_shape: trigger.dataset.image_shape,
        show_secondary_image: trigger.dataset.show_secondary_image,
        show_vendor: trigger.dataset.show_vendor,
        show_rating: trigger.dataset.show_rating,
        quick_add: trigger.dataset.quick_add
    });

    const cardContainer = trigger.closest('li.grid__item');
    const actionUrl = trigger.getAttribute('data-action-card-json');

    if (!actionUrl) {
      console.warn('Missing data-action-card-json attribute');
      return;
    }

    const url = `${actionUrl}&${params.toString()}`;

    try {
      const result = await fetchJsonOrText(url);

      if (!result.ok) {
        console.error('Request failed:', result.status, result.rawText);
        return;
      }

      if (result.isJson) {
        console.log('Parsed JSON:', result.data);

        if (result.data && result.data.card_html && cardContainer) {
          cardContainer.innerHTML = result.data.card_html;
        }
      } else {
        console.warn('Response is not valid JSON. Raw text follows:');
        console.log(result.rawText);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  });




  function initColorGroupQuickAdd() {
    /* ==================================================
      TOAST HELPER (REUSABLE)
    ================================================== */
    function showToast(message, type = 'success') {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      // REMOVE existing toasts
      container.querySelectorAll('.toast').forEach(toast => toast.remove());

      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = message;

      container.appendChild(toast);

      setTimeout(() => toast.classList.add('show'), 50);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    /* ==================================================
      ADD TO CART METHOD (REUSABLE)
    ================================================== */
    async function addToCartWithSections({
      variantId,
      quantity = 1,
      card = null,
      onSuccess,
      onError
    }) {
      if (!variantId) return;

      if (card) {
        if (card.dataset.adding === 'true') return;
        card.dataset.adding = 'true';
      }

      const cartData = {
        items: [{ id: variantId, quantity }],
        sections: ['cart-drawer', 'cart-icon-bubble'],
        sections_url: window.location.pathname
      };

      let data, response;

      try {
        response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cartData)
        });

        // ✅ Always attempt to parse JSON
        data = await response.json();

        /* --------------------------------------------------
          HANDLE SHOPIFY ERRORS (ALL CASES)
        -------------------------------------------------- */
        if (!response.ok || data.status) {
          const status = data.status || response.status;
          let message = 'Unable to add item to cart.';

          switch (status) {
            case 400:
              message = 'Invalid request. Please refresh and try again.';
              break;

            case 404:
              message = 'This product is no longer available.';
              break;

            case 422:
              message =
                data.description ||
                data.message ||
                'This item cannot be added to the cart.';
              break;

            case 429:
              message = 'Too many requests. Please wait a moment.';
              break;

            case 500:
            case 502:
            case 503:
              message = 'Shopify is temporarily unavailable. Please try again.';
              break;

            default:
              message =
                data.description ||
                data.message ||
                `Unexpected error (${status}).`;
          }

          showToast(message, 'error');
          onError && onError({ status, data });
          return;
        }

        /* --------------------------------------------------
          SUCCESS
        -------------------------------------------------- */
        const cart =
          document.querySelector('cart-notification') ||
          document.querySelector('cart-drawer');

        if (cart) {
          cart.classList.remove('is-empty');
          cart.renderContents(data);
        }

        showToast('Added to cart');
        closeVariantSelects();
        onSuccess && onSuccess(data);

      } catch (err) {
        /* --------------------------------------------------
          NETWORK / PARSING ERROR
        -------------------------------------------------- */
        console.error(err);
        showToast('Network error. Please check your connection.', 'error');
        onError && onError(err);

      } finally {
        if (card) {
          setTimeout(() => {
            delete card.dataset.adding;
          }, 500);
        }
      }
    }

    async function handleProductWithoutVariantEvent(e) {
      // Find the closest quick add icon wrapper
      const addToCartButton = e.target.closest(
        '[data-ele="quick-add-icon"][data-product="only-default-variant"]'
      );

      if (!addToCartButton) return;

      // Get the product card
      const card = addToCartButton.closest('li.grid__item');
      if (!card) return;

      // Get variant ID from data attribute
      const variantId = addToCartButton.dataset.productDefaultVariantId;
      if (!variantId) return;

      addToCartWithSections({
        variantId: Number(variantId),
        quantity: 1,
        card
      });
    }


    /* ==================================================
      VARIANT EVENT HANDLER
    ================================================== */
    async function handleVariantEvent(e) {
      const input = e.target;
      if (!input.matches('input[type="radio"]')) return;

      // Allow re-click on same radio
      if (e.type === 'click' && !input.checked) return;

      const card = input.closest('li.grid__item');
      if (!card) return;

      const variantSelects = input.closest('variant-selects');
      if (!variantSelects) return;

      const groups = Array.from(
        variantSelects.querySelectorAll('[data-ele="variant-selects-option"]')
      );
      if (!groups.length) return;

      const lastGroup = groups[groups.length - 1];
      if (!lastGroup.contains(input)) return;

      const variantsScript = card.querySelector('[data-product-variants]');
      if (!variantsScript) return;

      const variants = JSON.parse(variantsScript.textContent);

      // Auto-select single-value options
      groups.forEach(group => {
        const radios = group.querySelectorAll('input[type="radio"]');
        if (!group.querySelector(':checked') && radios.length === 1) {
          radios[0].checked = true;
        }
      });

      const selectedOptions = [];
      groups.forEach(group => {
        const checked = group.querySelector('input[type="radio"]:checked');
        if (checked) selectedOptions.push(checked.value);
      });

      if (selectedOptions.length !== variants[0].options.length) return;

      const variant = variants.find(v =>
        v.options.every((opt, i) => opt === selectedOptions[i])
      );

      if (!variant) {
        showToast('Variant not found', 'error');
        return;
      }

      if (!variant.available) {
        showToast('This variant is sold out', 'error');
        return;
      }

      // CALL REUSABLE METHOD
      addToCartWithSections({
        variantId: variant.id,
        quantity: 1,
        card
      });
    }

    /* ==================================================
      EVENT BINDINGS
    ================================================== */
    document.addEventListener('change', handleVariantEvent);
    document.addEventListener('click', handleVariantEvent);

    document.addEventListener('click', handleProductWithoutVariantEvent);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initColorGroupQuickAdd);
  } else {
    initColorGroupQuickAdd();
  }

  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-ele="quick-add-icon"]');
    if (!trigger) return;

    const cardContainer = trigger.closest('li.grid__item');
    if (!cardContainer) return;

    document.body.classList.add('quick-add-active');

    const variantSelects = cardContainer.querySelector(
      'variant-selects:not([data-ele="variant-product-selects"])'
    );
    if (!variantSelects) return;

    variantSelects.classList.add('active');

    // Create wrapper once
    let contentWrapper = variantSelects.querySelector('.variant-selects__content');
    if (!contentWrapper) {
      contentWrapper = document.createElement('div');
      contentWrapper.className = 'variant-selects__content';

      while (variantSelects.firstChild) {
        contentWrapper.appendChild(variantSelects.firstChild);
      }

      variantSelects.appendChild(contentWrapper);
    }

    // Add close icon inside wrapper once
    if (!contentWrapper.querySelector('.selector-close-icon-container')) {
      const closeContainer = document.createElement('div');
      closeContainer.className = 'selector-close-icon-container';

      const closeInnerContainer = document.createElement('div');
      closeInnerContainer.className = 'selector-close-icon-container-inner';

      const closeBtn = document.createElement('span');
      closeBtn.setAttribute('role', 'button');
      closeBtn.className = 'selector-close-icon';
      closeBtn.setAttribute('aria-label', 'Close');

      const overlayContainer = document.createElement('div');
      overlayContainer.className = 'variant-overylay-container';
      overlayContainer.setAttribute('data-ele', 'overlay-section');

      closeInnerContainer.appendChild(closeBtn);
      closeContainer.appendChild(closeInnerContainer);

      contentWrapper.prepend(closeContainer);
      variantSelects.appendChild(overlayContainer);
    }
  });


  document.addEventListener('click', function (event) {
    const closeBtn = event.target.closest('.selector-close-icon');
    const overlay = event.target.closest('.variant-overylay-container');

    // Close if either close icon OR overlay is clicked
    if (!closeBtn && !overlay) return;

    const variantSelects =
      closeBtn?.closest('variant-selects') ||
      overlay?.closest('variant-selects');

    if (!variantSelects) return;

    variantSelects.classList.remove('active');
    document.body.classList.remove('quick-add-active');
  });

  function closeVariantSelects() {
    const variantSelects = document.querySelectorAll('variant-selects.active');

    variantSelects.forEach(el => {
      el.classList.remove('active');
    });

    document.body.classList.remove('quick-add-active');
  }
})();


(function () {
  const MORE_CLASS = 'variant-option--more';

  function applyVariantOverflow(gridItem) {
    const container = gridItem.querySelector(
      '.variant-product-options-container'
    );
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll('.variant-option:not(.' + MORE_CLASS + ')')
    );

    if (!items.length) return;

    // Reset
    items.forEach(item => (item.style.display = ''));
    container.querySelector('.' + MORE_CLASS)?.remove();

    const availableWidth = gridItem.clientWidth;
    let usedWidth = 0;
    let visibleCount = 0;

    const containerStyle = getComputedStyle(container);
    const gap = parseFloat(containerStyle.columnGap || containerStyle.gap || 0);

    for (const item of items) {
      const style = getComputedStyle(item);
      const width =
        item.offsetWidth +
        parseFloat(style.marginLeft) +
        parseFloat(style.marginRight);

      const nextWidth =
        visibleCount === 0
          ? width
          : width + gap;

      if (((usedWidth + nextWidth) + (width - gap) ) > availableWidth) break;

      usedWidth += nextWidth;
      visibleCount++;
    }

    const hiddenCount = items.length - visibleCount;

    if (hiddenCount > 0) {
      items.slice(visibleCount).forEach(item => {
        item.style.display = 'none';
      });

      const more = document.createElement('span');
      more.className = `variant-option ${MORE_CLASS}`;
      more.setAttribute('aria-hidden', 'true');

      // Match width with swatch
      const firstItem = items[0];
      if (firstItem) {
        more.style.width = `${firstItem.offsetWidth}px`;
      }

      // Resolve href from nearest variant-selects
      const variantSelects = container.closest('variant-selects');
      const href =
        variantSelects?.getAttribute('data-href-more-option') || '#';

      // Create anchor
      const link = document.createElement('a');
      link.href = href;
      link.setAttribute('aria-label', `${hiddenCount} more options`);
      link.style.display = 'flex';
      link.style.alignItems = 'center';
      link.style.width = '100%';
      link.style.height = '100%';

      // + icon span
      const plusSpan = document.createElement('span');
      plusSpan.className = 'variant-option-more-plus';
      plusSpan.textContent = '+';

      // count span
      const countSpan = document.createElement('span');
      countSpan.className = 'variant-option-more-count';
      countSpan.textContent = hiddenCount;

      link.appendChild(plusSpan);
      link.appendChild(countSpan);
      more.appendChild(link);
      container.appendChild(more);
    }


  }

  function initAllCards(root = document) {
    root.querySelectorAll('li.grid__item').forEach(gridItem => {
      applyVariantOverflow(gridItem);

      // Resize observer per card
      if (!gridItem.__variantObserver) {
        const ro = new ResizeObserver(() =>
          applyVariantOverflow(gridItem)
        );
        ro.observe(gridItem);
        gridItem.__variantObserver = ro;
      }
    });
  }

  // Initial load
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllCards);
  } else {
    initAllCards();
  }

  // Shopify AJAX / Load more / Infinite scroll support
  const mo = new MutationObserver(mutations => {
    let shouldReinit = false;

    for (const m of mutations) {
      if (
        Array.from(m.addedNodes).some(
          node =>
            node.nodeType === 1 &&
            (node.matches?.('li.grid__item .card-wrapper') ||
              node.querySelector?.('li.grid__item .card-wrapper'))
        )
      ) {
        shouldReinit = true;
        break;
      }
    }

    if (shouldReinit) {
      initAllCards();
    }
  });

  mo.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
