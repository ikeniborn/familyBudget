/**
 * Navigation Progress Module v4.0
 * Pre-fetch + Direct Navigation + Element Loading indicators
 *
 * Flow:
 * 1. Intercept link click/touch
 * 2. Mark clicked element as loading (instant visual feedback)
 * 3. Show fade overlay with loading dots
 * 4. Pre-fetch page in background (warms HTTP cache)
 * 5. Wait for minimum display time (1.2 seconds)
 * 6. Navigate directly (instant load from HTTP cache)
 *
 * Key improvements over v3.2:
 * - Instant visual feedback on clicked nav element
 * - Fade overlay with loading dots for content area
 * - Unified loading state for all nav-item elements
 * - Removed progress bar (replaced by fade overlay + dots)
 *
 * @version 4.0.0
 */

(function() {
    'use strict';

    // Defensive debugLog - prevent errors if not defined
    var log = (typeof debugLog === 'function') ? debugLog : function() {};

    const NavigationProgress = {
        // DOM elements
        fadeOverlay: null,
        currentController: null,
        currentLoadingElement: null,

        // Configuration
        config: {
            fetchTimeout: 15000,      // 15 seconds max for pre-fetch
            minDisplayTime: 1200      // Minimum 1.2 seconds for visible loading
        },

        // State
        isNavigating: false,
        startTime: 0,

        /**
         * Initialize the navigation interceptor
         */
        init() {
            this.fadeOverlay = document.getElementById('navigation-fade-overlay');

            if (!this.fadeOverlay) {
                console.warn('[NavigationProgress] Fade overlay element not found');
                return;
            }

            // Hide overlay on incoming navigation (page load)
            this.hideFadeOverlay();
            this.clearElementLoading();

            // Intercept all clicks on document (capture phase)
            document.addEventListener('click', this.handleClick.bind(this), true);

            // Safari PWA: Also handle touchend for better iOS support
            // touchend fires before click on iOS, so we use it as primary trigger
            if (this.isSafariPWA()) {
                document.addEventListener('touchend', this.handleTouch.bind(this), true);
                log('[NavigationProgress] Safari PWA mode detected, touchend handler added');
            }

            log('[NavigationProgress] v4.0 Initialized (Pre-fetch + Element Loading + Fade Overlay)');
        },

        /**
         * Detect Safari PWA (standalone mode)
         */
        isSafariPWA() {
            // Check for iOS standalone mode
            var isStandalone = window.navigator.standalone === true;
            // Check for display-mode: standalone
            var isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
            // Check for Safari
            var isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            return (isStandalone || isDisplayStandalone) && (isSafari || isIOS);
        },

        /**
         * Handle touch events (for Safari PWA)
         */
        handleTouch(event) {
            // Only process single touch
            if (event.changedTouches && event.changedTouches.length !== 1) return;

            var touch = event.changedTouches ? event.changedTouches[0] : event;
            var target = document.elementFromPoint(touch.clientX, touch.clientY);

            if (!target) return;

            var link = target.closest('a');
            if (!this.shouldIntercept(link)) return;

            // Prevent default and handle navigation
            event.preventDefault();
            event.stopPropagation();

            // Mark element as loading immediately (instant feedback)
            this.markElementLoading(link);

            // Mark that we're handling via touch (to prevent duplicate click)
            this._touchHandled = true;
            setTimeout(() => { this._touchHandled = false; }, 300);

            this.closeMobileMenu();
            var href = link.getAttribute('href');
            this.navigateTo(href);
        },

        /**
         * Check if link should be intercepted
         */
        shouldIntercept(link) {
            // Must be a link
            if (!link || link.tagName !== 'A') return false;

            // Must have href
            const href = link.getAttribute('href');
            if (!href) return false;

            // Exclude external links
            if (href.startsWith('http://') || href.startsWith('https://')) {
                try {
                    const url = new URL(href);
                    if (url.origin !== window.location.origin) return false;
                } catch (e) {
                    return false;
                }
            }

            // Exclude hash links (anchor navigation)
            if (href.startsWith('#')) return false;

            // Exclude javascript: links
            if (href.startsWith('javascript:')) return false;

            // Exclude download links
            if (link.hasAttribute('download')) return false;

            // Exclude target="_blank" links
            if (link.target === '_blank') return false;

            // Exclude links with data-no-progress attribute
            if (link.hasAttribute('data-no-progress')) return false;

            // Exclude HTMX-controlled links
            if (link.hasAttribute('hx-get') ||
                link.hasAttribute('hx-post') ||
                link.hasAttribute('hx-boost')) return false;

            // Exclude links inside modals/dialogs (let modal handle navigation)
            if (link.closest('dialog, .modal')) return false;

            return true;
        },

        /**
         * Close mobile menu if open
         */
        closeMobileMenu() {
            const mobileMenu = document.getElementById('mobile-menu-content');
            if (mobileMenu && mobileMenu.style.display !== 'none') {
                mobileMenu.style.display = 'none';
                const menuBtn = document.getElementById('mobile-menu-btn');
                if (menuBtn) {
                    menuBtn.setAttribute('aria-expanded', 'false');
                    menuBtn.blur();
                }
                log('[NavigationProgress] Mobile menu closed');
            }
        },

        /**
         * Handle click events
         */
        handleClick(event) {
            // Skip if already handled by touch (Safari PWA)
            if (this._touchHandled) return;

            // Find the clicked link (may be nested in the target)
            const link = event.target.closest('a');

            if (!this.shouldIntercept(link)) return;

            // Mark element as loading immediately (instant feedback)
            this.markElementLoading(link);

            // Close mobile menu before navigation
            this.closeMobileMenu();

            // Prevent default navigation
            event.preventDefault();
            event.stopPropagation();

            // Start navigation
            const href = link.getAttribute('href');
            this.navigateTo(href);
        },

        /**
         * Navigate to URL with progress (Pre-fetch + Overlay approach)
         */
        async navigateTo(url) {
            if (this.isNavigating) {
                // Cancel current navigation
                this.cancel();
            }

            this.isNavigating = true;
            this.startTime = Date.now();
            this.currentController = new AbortController();

            // Show fade overlay (replaces progress bar in v4.0)
            this.showFadeOverlay();

            try {
                // Pre-fetch the page (warms HTTP cache)
                await this.prefetchPage(url);

                // Ensure minimum display time for fade overlay
                const elapsed = Date.now() - this.startTime;
                const remaining = Math.max(0, this.config.minDisplayTime - elapsed);

                if (remaining > 0) {
                    await this.delay(remaining);
                }

                // Navigate directly - HTTP cache is already warmed by pre-fetch
                // Browser loads instantly from cache
                this.isNavigating = false;
                window.location.href = url;

            } catch (error) {
                if (error.name === 'AbortError') {
                    log('[NavigationProgress] Navigation cancelled');
                    return;
                }

                console.error('[NavigationProgress] Pre-fetch failed:', error);
                this.hideFadeOverlay();
                this.clearElementLoading();
                this.isNavigating = false;

                // Fall back to normal navigation (let browser handle it)
                window.location.href = url;
            }
        },

        /**
         * Pre-fetch page to warm HTTP cache
         * v4.0: Simplified - no progress bar tracking, just cache warming
         */
        async prefetchPage(url) {
            // Setup timeout
            const timeoutId = setTimeout(() => {
                if (this.currentController) {
                    this.currentController.abort();
                }
            }, this.config.fetchTimeout);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    signal: this.currentController.signal,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml',
                        'X-Requested-With': 'NavigationProgress'
                    }
                });

                clearTimeout(timeoutId);

                // Check response status
                if (!response.ok) {
                    log('[NavigationProgress] Pre-fetch returned non-OK status:', response.status);
                    // Don't throw - just skip cache warming, navigation will still work
                    return;
                }

                // Consume response to warm HTTP cache
                await response.text();
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        },

        /**
         * Mark element as loading (instant visual feedback)
         * @param {HTMLElement} element - The clicked element
         */
        markElementLoading(element) {
            if (!element) return;

            // Find nav-item (button or link with explicit nav markers)
            const navItem = element.closest('[data-nav-item], .nav-item, .icon-btn');
            if (navItem) {
                navItem.classList.add('loading');
                this.currentLoadingElement = navItem;
                log('[NavigationProgress] Element marked as loading:', navItem.tagName);
            }
        },

        /**
         * Clear loading state from element
         */
        clearElementLoading() {
            if (this.currentLoadingElement) {
                this.currentLoadingElement.classList.remove('loading');
                this.currentLoadingElement = null;
            }
            // Fallback: clear all loading states
            document.querySelectorAll('.nav-item.loading, [data-nav-item].loading, .icon-btn.loading').forEach(el => {
                el.classList.remove('loading');
            });
        },

        /**
         * Show fade overlay with loading dots
         */
        showFadeOverlay() {
            if (!this.fadeOverlay) return;
            this.fadeOverlay.classList.add('active');
            // Block body scroll in PWA
            document.body.style.overflow = 'hidden';
        },

        /**
         * Hide fade overlay
         */
        hideFadeOverlay() {
            if (!this.fadeOverlay) return;
            this.fadeOverlay.classList.remove('active');
            // Restore body scroll
            document.body.style.overflow = '';
        },

        /**
         * Cancel current navigation
         */
        cancel() {
            if (this.currentController) {
                this.currentController.abort();
                this.currentController = null;
            }
            this.hideFadeOverlay();
            this.clearElementLoading();
            this.isNavigating = false;
        },

        /**
         * Delay helper
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    // Initialize on DOMContentLoaded
    if (document.readyState !== 'loading') {
        NavigationProgress.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => NavigationProgress.init());
    }

    // Handle bfcache (back/forward cache) restoration
    window.addEventListener('pageshow', (event) => {
        const fadeOverlay = document.getElementById('navigation-fade-overlay');
        if (fadeOverlay) {
            fadeOverlay.classList.remove('active');
        }

        // Reset navigation state
        if (window.NavigationProgress) {
            window.NavigationProgress.isNavigating = false;
            window.NavigationProgress.hideFadeOverlay();
            window.NavigationProgress.clearElementLoading();
        }
    });

    // Export globally
    window.NavigationProgress = NavigationProgress;

})();
