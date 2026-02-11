if (!customElements.get('product-modal')) {
  customElements.define(
    'product-modal',
    class ProductModal extends ModalDialog {
      constructor() {
        super();
        this.isDragging = false;
        this.startX = 0;
        this.scrollLeft = 0;
        this.currentIndex = 0;
        this.allMedia = [];
        this.initialized = false;
      }

      connectedCallback() {
        // Don't initialize here - wait for show() to be called
      }

      initDragAndArrows() {
        // Prevent multiple initializations
        if (this.initialized) return;
        
        const container = this.querySelector('[role="document"]');
        if (!container) return;
        
        this.initialized = true;

        const prevArrow = this.querySelector('.product-media-modal__arrow--prev');
        const nextArrow = this.querySelector('.product-media-modal__arrow--next');
        const dialog = this.querySelector('[role="dialog"]');

        // Get counter elements
        const counterCurrent = this.querySelector('.product-media-modal__counter-current');
        const counterTotal = this.querySelector('.product-media-modal__counter-total');
        const counter = this.querySelector('.product-media-modal__counter');

        // Update counter and arrows visibility
        const updateCounter = () => {
          if (counterCurrent) {
            counterCurrent.textContent = this.currentIndex + 1;
          }
          if (counterTotal) {
            counterTotal.textContent = this.allMedia.length;
          }
          // Hide counter if only one image
          if (counter) {
            counter.style.display = this.allMedia.length <= 1 ? 'none' : 'flex';
          }
        };

        const updateArrows = () => {
          if (this.allMedia.length <= 1) {
            if (prevArrow) prevArrow.style.display = 'none';
            if (nextArrow) nextArrow.style.display = 'none';
            return;
          }
          if (prevArrow) prevArrow.style.display = 'flex';
          if (nextArrow) nextArrow.style.display = 'flex';

          // Update arrow states
          if (prevArrow) {
            prevArrow.disabled = this.currentIndex === 0;
            prevArrow.classList.toggle('disabled', this.currentIndex === 0);
          }
          if (nextArrow) {
            nextArrow.disabled = this.currentIndex === this.allMedia.length - 1;
            nextArrow.classList.toggle('disabled', this.currentIndex === this.allMedia.length - 1);
          }
          
          // Update counter
          updateCounter();
        };

        // Navigation arrows - prevent modal close
        if (prevArrow) {
          prevArrow.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
          });
          prevArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!prevArrow.disabled) {
              this.navigateToIndex(this.currentIndex - 1);
            }
          });
          prevArrow.addEventListener('touchstart', (e) => {
            e.stopPropagation();
          });
        }

        if (nextArrow) {
          nextArrow.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
          });
          nextArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!nextArrow.disabled) {
              this.navigateToIndex(this.currentIndex + 1);
            }
          });
          nextArrow.addEventListener('touchstart', (e) => {
            e.stopPropagation();
          });
        }

        // Prevent modal close when clicking on arrows or content
        if (dialog) {
          dialog.addEventListener('pointerup', (e) => {
            if (e.target.closest('.product-media-modal__arrow') || 
                e.target.closest('[role="document"]') ||
                e.target.closest('.product-media-modal__item')) {
              e.stopPropagation();
            }
          });
        }

        // Drag functionality
        let dragStartX = 0;
        let dragStartScrollLeft = 0;
        let isDragging = false;
        let hasDragged = false;

        const startDrag = (e) => {
          // Don't start drag if clicking on buttons, links, or interactive elements
          const target = e.target;
          if (target.closest('button') || 
              target.closest('a') || 
              target.tagName === 'BUTTON' || 
              target.tagName === 'A' ||
              target.closest('.product-media-modal__arrow')) {
            return;
          }
          
          // Check if image is zoomed - if so, don't start horizontal slider drag
          const clickedImage = target.closest('.product-media-modal__image');
          if (clickedImage) {
            const item = clickedImage.closest('.product-media-modal__item');
            if (item && item.dataset.isZoomed === 'true') {
              // Image is zoomed, let pan functionality handle it
              return;
            }
          }

          isDragging = true;
          hasDragged = false;
          container.style.cursor = 'grabbing';
          container.style.userSelect = 'none';
          container.style.pointerEvents = 'auto';
          
          // Add dragging class for CSS overrides
          container.classList.add('dragging');
          
          // Completely disable scroll snap and smooth behavior during drag
          container.style.scrollBehavior = 'auto';
          container.style.scrollSnapType = 'none';
          
          // Disable scroll snap on all child items
          this.allMedia.forEach(item => {
            if (item.style) {
              item.style.scrollSnapAlign = 'none';
            }
          });
          
          const clientX = e.type === 'touchstart' ? e.touches[0].clientX : (e.clientX || e.pageX);
          dragStartX = clientX;
          dragStartScrollLeft = container.scrollLeft;
          
          // Prevent default to avoid text selection and scrolling
          e.preventDefault();
          e.stopPropagation();
        };

        const drag = (e) => {
          if (!isDragging) return;
          
          const clientX = e.type === 'touchmove' ? e.touches[0].clientX : (e.clientX || e.pageX);
          const deltaX = dragStartX - clientX;
          
          // Start dragging immediately, no threshold needed
          hasDragged = true;
          
          // Update scroll position instantly - direct assignment for immediate response
          // This moves the slider instantly with the cursor/finger movement
          container.scrollLeft = dragStartScrollLeft + deltaX;
          
          e.preventDefault();
          e.stopPropagation();
        };

        const stopDrag = (e) => {
          if (!isDragging) return;
          
          isDragging = false;
          container.style.cursor = 'grab';
          container.style.userSelect = '';
          
          // Remove dragging class
          container.classList.remove('dragging');
          
          // Re-enable scroll snap after a brief delay to allow final position to settle
          setTimeout(() => {
            container.style.scrollBehavior = 'smooth';
            container.style.scrollSnapType = 'x mandatory';
            
            // Re-enable scroll snap on all child items
            this.allMedia.forEach(item => {
              if (item.style) {
                item.style.scrollSnapAlign = 'start';
              }
            });
          }, 50);
          
          // Update index and arrows after drag
          if (hasDragged) {
            // Small delay to ensure scroll position is finalized
            requestAnimationFrame(() => {
              this.updateCurrentIndex();
              updateArrows();
            });
            
            // Prevent any click events after dragging
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            
            // Clear the flag after a short delay to prevent accidental clicks
            setTimeout(() => {
              hasDragged = false;
            }, 200);
          } else {
            // If no drag occurred, immediately re-enable scroll snap
            container.style.scrollBehavior = 'smooth';
            container.style.scrollSnapType = 'x mandatory';
          }
        };

        // Mouse events
        container.addEventListener('mousedown', (e) => {
          startDrag(e);
          
          const handleMouseMove = (e) => {
            drag(e);
          };
          
          const handleMouseUp = (e) => {
            stopDrag(e);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleMouseUp);
          };
          
          const handleMouseLeave = (e) => {
            stopDrag(e);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleMouseLeave);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
          document.addEventListener('mouseleave', handleMouseLeave);
        });
        
        // Touch events
        container.addEventListener('touchstart', (e) => {
          startDrag(e);
        }, { passive: false });
        
        container.addEventListener('touchmove', (e) => {
          drag(e);
        }, { passive: false });
        
        container.addEventListener('touchend', (e) => {
          stopDrag(e);
        }, { passive: false });
        
        container.addEventListener('touchcancel', (e) => {
          stopDrag(e);
        }, { passive: false });

        // Set initial cursor
        container.style.cursor = 'grab';

        // Update on scroll
        let scrollTimeout;
        container.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            this.updateCurrentIndex();
            updateArrows();
            updateCounter();
          }, 100);
        });

        // Keyboard navigation
        this.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToIndex(this.currentIndex - 1);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToIndex(this.currentIndex + 1);
          }
        });

        this.updateArrows = updateArrows;
        
        // Initialize zoom functionality for images
        this.initZoom();
      }

      initZoom() {
        const container = this.querySelector('[role="document"]');
        if (!container) return;

        const images = container.querySelectorAll('.product-media-modal__image[data-zoomable="true"]');
        let zoomedImage = null;
        let zoomedImageData = null; // Store zoom state and pan position
        
        images.forEach(img => {
          const item = img.closest('.product-media-modal__item');
          if (!item) return;

          const originalWidth = parseInt(item.dataset.originalWidth) || img.naturalWidth || img.width;
          const originalHeight = parseInt(item.dataset.originalHeight) || img.naturalHeight || img.height;
          
          let isZoomed = false;
          let originalStyles = {};
          let panX = 0;
          let panY = 0;
          let isPanning = false;
          let panStartX = 0;
          let panStartY = 0;

          const zoomImage = (e) => {
            // Only zoom if clicking directly on the image element itself
            const target = e.target;
            if (target !== img && target.tagName !== 'IMG') {
              return;
            }
            
            // Don't zoom if we just finished dragging the slider
            if (this.hasDragged && !isZoomed) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (!isZoomed) {
              // Reset any previously zoomed image
              if (zoomedImage && zoomedImage !== img) {
                this.resetZoomedImage(zoomedImage, zoomedImageData);
                zoomedImage = null;
                zoomedImageData = null;
              }

              // Store original styles
              originalStyles = {
                width: img.style.width || '',
                height: img.style.height || '',
                maxWidth: img.style.maxWidth || '',
                maxHeight: img.style.maxHeight || '',
                objectFit: img.style.objectFit || '',
                cursor: img.style.cursor || '',
                transition: img.style.transition || '',
                transform: img.style.transform || ''
              };
              
              item.dataset.originalStyles = JSON.stringify(originalStyles);

              // Calculate zoom scale to fit original size
              const containerWidth = container.clientWidth;
              const containerHeight = container.clientHeight;
              const scaleX = originalWidth / containerWidth;
              const scaleY = originalHeight / containerHeight;
              const scale = Math.max(scaleX, scaleY, 1.5); // Minimum 1.5x zoom

              // Zoom with smooth transition
              img.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
              img.style.transform = `scale(${scale})`;
              img.style.transformOrigin = 'center center';
              img.style.cursor = 'grab';
              img.style.willChange = 'transform';
              
              // Center the zoomed image
              item.style.justifyContent = 'center';
              item.style.alignItems = 'center';
              item.style.overflow = 'hidden';
              item.style.position = 'relative';
              item.dataset.isZoomed = 'true';
              
              // Reset pan position
              panX = 0;
              panY = 0;
              
              isZoomed = true;
              zoomedImage = img;
              zoomedImageData = {
                item: item,
                originalStyles: originalStyles,
                scale: scale,
                panX: 0,
                panY: 0
              };

              // After transition, change cursor to grab
              setTimeout(() => {
                if (isZoomed) {
                  img.style.cursor = 'grab';
                  img.style.transition = 'none'; // Remove transition for smooth panning
                }
              }, 400);
            } else {
              // Reset to original with transition
              img.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
              img.style.transform = 'scale(1) translate(0, 0)';
              
              setTimeout(() => {
                img.style.width = originalStyles.width || '';
                img.style.height = originalStyles.height || '';
                img.style.maxWidth = originalStyles.maxWidth || '';
                img.style.maxHeight = originalStyles.maxHeight || '';
                img.style.objectFit = originalStyles.objectFit || '';
                img.style.cursor = 'zoom-in';
                img.style.transition = originalStyles.transition || '';
                img.style.transform = originalStyles.transform || '';
                img.style.transformOrigin = '';
                img.style.willChange = '';
                
                item.style.overflow = '';
                item.style.position = '';
                item.dataset.isZoomed = 'false';
                
                panX = 0;
                panY = 0;
              }, 400);
              
              isZoomed = false;
              zoomedImage = null;
              zoomedImageData = null;
            }
          };

          // Pan functionality for zoomed images
          const startPan = (e) => {
            // Only pan if clicking directly on the zoomed image element
            if (!isZoomed || img !== zoomedImage) return;
            
            const target = e.target;
            if (target !== img && target.tagName !== 'IMG') {
              return;
            }
            
            isPanning = true;
            img.style.cursor = 'grabbing';
            img.style.transition = 'none';
            
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : (e.clientX || e.pageX);
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : (e.clientY || e.pageY);
            
            panStartX = clientX - panX;
            panStartY = clientY - panY;
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          };

          const pan = (e) => {
            if (!isPanning || !isZoomed || img !== zoomedImage) return;
            
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : (e.clientX || e.pageX);
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : (e.clientY || e.pageY);
            
            const newPanX = clientX - panStartX;
            const newPanY = clientY - panStartY;
            
            // Calculate bounds to prevent panning too far
            const scale = zoomedImageData.scale;
            const containerRect = container.getBoundingClientRect();
            const imgNaturalWidth = originalWidth;
            const imgNaturalHeight = originalHeight;
            
            // Calculate maximum pan distance
            const scaledWidth = imgNaturalWidth * scale;
            const scaledHeight = imgNaturalHeight * scale;
            const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
            const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
            
            // Clamp pan values
            panX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
            panY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));
            
            // Apply pan transform
            img.style.transform = `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`;
            
            // Update stored pan position
            if (zoomedImageData) {
              zoomedImageData.panX = panX;
              zoomedImageData.panY = panY;
            }
            
            e.preventDefault();
            e.stopPropagation();
          };

          const stopPan = (e) => {
            if (!isPanning || img !== zoomedImage) return;
            
            isPanning = false;
            if (isZoomed) {
              img.style.cursor = 'grab';
            }
            
            e.preventDefault();
            e.stopPropagation();
          };

          // Pan event handlers
          const handleMouseMove = (e) => pan(e);
          const handleTouchMove = (e) => pan(e);
          const handleMouseUp = (e) => stopPan(e);
          const handleTouchEnd = (e) => stopPan(e);
          
          // Add pan listeners when image is zoomed
          const addPanListeners = () => {
            if (img.dataset.panListenersAdded !== 'true') {
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('touchmove', handleTouchMove, { passive: false });
              document.addEventListener('mouseup', handleMouseUp);
              document.addEventListener('touchend', handleTouchEnd);
              img.dataset.panListenersAdded = 'true';
            }
          };
          
          // Remove pan listeners when image is unzoomed
          const removePanListeners = () => {
            if (img.dataset.panListenersAdded === 'true') {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('mouseup', handleMouseUp);
              document.removeEventListener('touchend', handleTouchEnd);
              img.dataset.panListenersAdded = 'false';
            }
          };
          
          // Wrapper for zoom function that manages pan listeners
          const zoomImageWithPan = (e) => {
            const wasZoomed = isZoomed;
            zoomImage(e);
            
            // Manage pan listeners based on zoom state
            if (!wasZoomed && isZoomed) {
              // Just zoomed in - add pan listeners
              addPanListeners();
            } else if (wasZoomed && !isZoomed) {
              // Just zoomed out - remove pan listeners
              removePanListeners();
              panX = 0;
              panY = 0;
            }
          };
          
          // Set zoom-in cursor initially - only on the image
          img.style.cursor = 'zoom-in';
          
          // Click to zoom - only trigger on direct image clicks, not container
          const handleImageClick = (e) => {
            // Only zoom if clicking directly on the image element itself
            // Not on the container or any wrapper elements
            const target = e.target;
            if (target === img || (target.tagName === 'IMG' && target.classList.contains('product-media-modal__image'))) {
              zoomImageWithPan(e);
            }
          };
          
          img.addEventListener('click', handleImageClick, true);
          
          // Pan events for zoomed image - only on the image itself
          const handleImagePanStart = (e) => {
            const target = e.target;
            if (target === img || (target.tagName === 'IMG' && target.classList.contains('product-media-modal__image'))) {
              startPan(e);
            }
          };
          
          img.addEventListener('mousedown', handleImagePanStart);
          img.addEventListener('touchstart', handleImagePanStart, { passive: false });
          
          // Also allow double-click for zoom (common pattern) - only on image
          img.addEventListener('dblclick', (e) => {
            const target = e.target;
            if (target === img || (target.tagName === 'IMG' && target.classList.contains('product-media-modal__image'))) {
              e.preventDefault();
              e.stopPropagation();
              zoomImageWithPan(e);
            }
          }, true);
        });
        
        // Store reset function for external use
        this.resetZoomedImage = (img, data) => {
          if (!img || !data) return;
          const item = data.item;
          const styles = data.originalStyles;
          
          // Remove pan listeners if they were added
          if (img.dataset.panListenersAdded === 'true') {
            // Find and remove the listeners (they're scoped to the image's closure)
            // We'll handle this by checking the zoom state
            img.dataset.panListenersAdded = 'false';
          }
          
          img.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
          img.style.transform = 'scale(1) translate(0, 0)';
          
          setTimeout(() => {
            img.style.width = styles.width || '';
            img.style.height = styles.height || '';
            img.style.maxWidth = styles.maxWidth || '';
            img.style.maxHeight = styles.maxHeight || '';
            img.style.objectFit = styles.objectFit || '';
            img.style.cursor = 'zoom-in';
            img.style.transition = styles.transition || '';
            img.style.transform = styles.transform || '';
            img.style.transformOrigin = '';
            img.style.willChange = '';
            
            item.style.overflow = '';
            item.style.position = '';
            item.dataset.isZoomed = 'false';
          }, 400);
        };
        
        // Reset zoom when clicking outside zoomed image
        const dialog = this.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.addEventListener('click', (e) => {
            const clickedImage = e.target.closest('.product-media-modal__image');
            if (!clickedImage && zoomedImage) {
              // Clicked outside image, reset zoom
              this.resetZoomedImage(zoomedImage, zoomedImageData);
              zoomedImage = null;
              zoomedImageData = null;
            }
          });
        }
      }

      updateCurrentIndex() {
        const container = this.querySelector('[role="document"]');
        if (!container) return;

        // Ensure we have an up-to-date list of slide items
        if (!this.allMedia || this.allMedia.length === 0) {
          this.allMedia = Array.from(
            this.querySelectorAll('.product-media-modal__item[data-media-id]')
          );
        }
        if (this.allMedia.length === 0) return;

        const scrollPosition = container.scrollLeft;
        const itemWidth = container.clientWidth;
        this.currentIndex = Math.round(scrollPosition / itemWidth);
        this.currentIndex = Math.max(0, Math.min(this.currentIndex, this.allMedia.length - 1));
        
        // Update active class on visible item
        const activeItem = this.allMedia[this.currentIndex];
        this.allMedia.forEach((item) => item.classList.remove('active'));
        if (activeItem) {
          activeItem.classList.add('active');
        }

        // Update counter
        const counterCurrent = this.querySelector('.product-media-modal__counter-current');
        if (counterCurrent) {
          counterCurrent.textContent = this.currentIndex + 1;
        }
      }

      navigateToIndex(index) {
        const container = this.querySelector('[role="document"]');
        if (!container || this.allMedia.length === 0) return;

        index = Math.max(0, Math.min(index, this.allMedia.length - 1));
        this.currentIndex = index;

        const targetMedia = this.allMedia[index];
        if (targetMedia) {
          targetMedia.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }

        if (this.updateArrows) {
          this.updateArrows();
        }
        
        // Update counter when navigating
        const counterCurrent = this.querySelector('.product-media-modal__counter-current');
        if (counterCurrent) {
          counterCurrent.textContent = this.currentIndex + 1;
        }
      }

      hide() {
        super.hide();
        this.isDragging = false;
        this.initialized = false;
      }

      show(opener) {
        super.show(opener);
        // Re-initialize drag and arrows after modal is shown
        setTimeout(() => {
          this.initDragAndArrows();
          this.showActiveMedia();
        }, 0);
      }

      showActiveMedia() {
        const container = this.querySelector('[role="document"]');
        // Only treat the top-level modal items as slides
        this.allMedia = Array.from(
          this.querySelectorAll('.product-media-modal__item[data-media-id]')
        );

        // Clear previous active state
        this.allMedia.forEach((item) => {
          item.classList.remove('active');
        });

        // Determine which media ID should be active
        const mediaId = this.openedBy && this.openedBy.getAttribute('data-media-id');
        const activeMedia =
          (mediaId &&
            this.querySelector(
              `.product-media-modal__item[data-media-id="${mediaId}"]`
            )) ||
          this.allMedia[0];

        if (!activeMedia) return;
        
        activeMedia.classList.add('active');
        const activeMediaTemplate = activeMedia.querySelector('template');
        const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
        
        // Show all media items for horizontal scrolling
        this.allMedia.forEach((element) => {
          element.style.display = 'flex';
        });
        
        // Find current index
        this.currentIndex = this.allMedia.indexOf(activeMedia);
        if (this.currentIndex < 0) this.currentIndex = 0;
        
        // Scroll to the active media horizontally
        if (container) {
          requestAnimationFrame(() => {
            activeMedia.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'center'
            });
            this.updateCurrentIndex();
            if (this.updateArrows) {
              this.updateArrows();
            }
            
            // Update counter on initial load
            const counterCurrent = this.querySelector('.product-media-modal__counter-current');
            const counterTotal = this.querySelector('.product-media-modal__counter-total');
            if (counterCurrent) {
              counterCurrent.textContent = this.currentIndex + 1;
            }
            if (counterTotal) {
              counterTotal.textContent = this.allMedia.length;
            }
          });
        }

        if (
          activeMedia.nodeName == 'DEFERRED-MEDIA' &&
          activeMediaContent &&
          activeMediaContent.querySelector('.js-youtube')
        )
          activeMedia.loadContent();
      }
    }
  );
}
