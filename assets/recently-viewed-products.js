// Recently Viewed Products Tracker and Display
class RecentlyViewedProducts extends HTMLElement {
  constructor() {
    super();
    this.storageKey = 'shopify_recently_viewed_products';
    this.maxProducts = parseInt(this.dataset.productsToShow) || 8;
  }

  connectedCallback() {
    this.loadProducts();
  }

  // Get recently viewed products from localStorage
  getRecentlyViewedProducts() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      const products = JSON.parse(stored);
      // Remove duplicates and limit to maxProducts
      const uniqueProducts = Array.from(new Map(products.map(p => [p.id, p])).values());
      return uniqueProducts.slice(0, this.maxProducts);
    } catch (e) {
      console.error('Error reading recently viewed products:', e);
      return [];
    }
  }

  // Save product to recently viewed
  static addProduct(productData) {
    try {
      const storageKey = 'shopify_recently_viewed_products';
      const stored = localStorage.getItem(storageKey);
      let products = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists (to move to top)
      products = products.filter(p => p.id !== productData.id);
      
      // Add to beginning
      products.unshift({
        id: productData.id,
        handle: productData.handle,
        title: productData.title,
        image: productData.image,
        price: productData.price,
        compare_at_price: productData.compare_at_price,
        vendor: productData.vendor,
        url: productData.url
      });
      
      // Limit to 20 products max
      products = products.slice(0, 20);
      
      localStorage.setItem(storageKey, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving recently viewed product:', e);
    }
  }

  // Load and display products
  async loadProducts() {
    const storedProducts = this.getRecentlyViewedProducts();
    
    if (storedProducts.length === 0) {
      this.showEmpty();
      return;
    }

    const sectionId = this.dataset.sectionId;
    const productHandles = storedProducts.map(p => p.handle).filter(Boolean);
    
    if (productHandles.length === 0) {
      this.showEmpty();
      return;
    }
    
    console.log('Recently viewed products: Loading', productHandles.length, 'products');
    
    try {
      // Fetch product cards using the theme's product-card-json template
      const imageRatio = this.dataset.imageRatio || 'adapt';
      const imageShape = this.dataset.imageShape || 'default';
      const showSecondaryImage = this.dataset.showSecondaryImage === 'true';
      const showVendor = this.dataset.showVendor === 'true';
      const showRating = this.dataset.showRating === 'true';
      
      const cardPromises = productHandles.map((handle, index) => {
        const params = new URLSearchParams({
          view: 'product-card-json',
          media_aspect_ratio: imageRatio,
          image_shape: imageShape,
          show_secondary_image: showSecondaryImage.toString(),
          show_vendor: showVendor.toString(),
          show_rating: showRating.toString(),
          skip_styles: (index > 0).toString() // Skip styles for cards after the first one
        });
        
        return fetch(`${window.Shopify.routes.root}products/${handle}?${params.toString()}`)
          .then(res => {
            if (!res.ok) {
              console.error(`Failed to fetch product card for ${handle}:`, res.status);
              return null;
            }
            return res.json();
          })
          .then(data => {
            if (data && data.card_html) {
              return {
                handle: handle,
                cardHtml: data.card_html,
                productId: data.id
              };
            }
            return null;
          })
          .catch(error => {
            console.error(`Error fetching product card for ${handle}:`, error);
            return null;
          });
      });
      
      const cardResults = await Promise.all(cardPromises);
      const validCards = cardResults.filter(card => card !== null).slice(0, this.maxProducts);
      
      if (validCards.length === 0) {
        this.showEmpty();
        return;
      }
      
      this.renderProductCards(validCards, sectionId);
    } catch (error) {
      console.error('Error loading recently viewed products:', error);
      this.showEmpty();
    }
  }

  // Render product cards using theme's card-product snippet
  renderProductCards(cards, sectionId) {
    const slider = this.querySelector('slider-component');
    const sliderList = this.querySelector('ul');
    const emptyMessage = this.querySelector('.recently-viewed-products__empty');
    const sliderButtons = this.querySelector('.slider-buttons');
    
    if (!slider || !sliderList) {
      console.error('Recently viewed products: Slider elements not found');
      return;
    }

    sliderList.innerHTML = '';
    
    cards.forEach((card, index) => {
      const li = document.createElement('li');
      li.id = `Slide-${sectionId}-${index + 1}`;
      li.className = `grid__item slider__slide`;
      
      // Insert the card HTML from the theme's card-product snippet
      li.innerHTML = card.cardHtml;
      sliderList.appendChild(li);
    });

    slider.style.display = '';
    if (emptyMessage) emptyMessage.style.display = 'none';
    
    if (cards.length > 1 && sliderButtons) {
      sliderButtons.style.display = '';
      const totalElement = sliderButtons.querySelector('.slider-counter--total');
      if (totalElement) totalElement.textContent = cards.length;
    } else if (sliderButtons) {
      sliderButtons.style.display = 'none';
    }

    setTimeout(() => {
      const sliderComponent = this.querySelector('slider-component');
      if (sliderComponent && sliderComponent.resetPages) {
        sliderComponent.resetPages();
      }
    }, 100);
  }


  showEmpty() {
    const slider = this.querySelector('slider-component');
    const emptyMessage = this.querySelector('.recently-viewed-products__empty');
    
    if (slider) slider.style.display = 'none';
    if (emptyMessage) emptyMessage.style.display = 'block';
  }
}

customElements.define('recently-viewed-products', RecentlyViewedProducts);

// Track product views on product pages
(function() {
  function trackProductView() {
    // Check if we're on a product page
    if (!window.location.pathname.includes('/products/')) return;
    
    // Try multiple methods to get product data
    let productData = null;
    
    // Method 1: JSON script tag with product data
    const productJson = document.querySelector('script[type="application/json"][data-product-json]');
    if (productJson) {
      try {
        productData = JSON.parse(productJson.textContent);
      } catch (e) {
        console.error('Error parsing product JSON:', e);
      }
    }
    
    // Method 2: Try to get from product-info element
    if (!productData) {
      const productInfo = document.querySelector('product-info');
      if (productInfo && productInfo.dataset.productId) {
        const handle = window.location.pathname.split('/products/')[1]?.split('?')[0];
        productData = {
          id: productInfo.dataset.productId,
          handle: handle,
          title: document.querySelector('h1')?.textContent?.trim() || '',
          url: window.location.pathname
        };
      }
    }
    
    // Method 3: Extract from URL and basic page data
    if (!productData) {
      const handle = window.location.pathname.split('/products/')[1]?.split('?')[0];
      if (handle) {
        productData = {
          id: null,
          handle: handle,
          title: document.querySelector('h1')?.textContent?.trim() || handle,
          url: window.location.pathname
        };
      }
    }
    
    if (productData && productData.handle) {
      RecentlyViewedProducts.addProduct({
        id: productData.id || productData.handle,
        handle: productData.handle,
        title: productData.title,
        image: productData.featured_image || productData.images?.[0] || '',
        price: productData.price || 0,
        compare_at_price: productData.compare_at_price || null,
        vendor: productData.vendor || '',
        url: productData.url || window.location.pathname
      });
    }
  }
  
  // Track on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackProductView);
  } else {
    trackProductView();
  }
})();

