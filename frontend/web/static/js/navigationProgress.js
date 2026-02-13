/**
 * Navigation Progress Module v4.1
 * Pre-fetch + Direct Navigation + Element Loading + HTMX Widget Tracking
 *
 * Flow:
 * 1. Intercept link click/touch
 * 2. Mark clicked element as loading (instant visual feedback)
 * 3. Show fade overlay with loading dots
 * 4. Pre-fetch page in background (warms HTTP cache)
 * 5. Wait for minimum display time (1.2 seconds)
 * 6. Navigate directly (instant load from HTTP cache)
 * 7. NEW: Keep overlay visible until all HTMX hx-trigger="load" widgets complete
 * 8. Smooth fade out (0.3s) after all widgets loaded
 *
 * Key improvements over v4.0:
 * - HTMX widget tracking - overlay stays until widgets loaded
 * - Eliminates "flicker" from empty containers
 * - Smoother 0.3s transition (was 0.15s)
 * - Fallback timeout (5s) prevents infinite waiting
 *
 * @version 4.1.0
 */

(function() {
    'use strict';

    // Defensive debugLog - prevent errors if not defined
    const log = (typeof debugLog === 'function') ? debugLog : function() {};

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

        // HTMX Widget Tracking (v4.1)
        htmxTrackingEnabled: false,
        pendingHtmxRequests: 0,
        htmxTrackingTimeout: null,
        htmxSettleTimeout: 5000,    // Max 5 sec waiting for widgets
        htmxSettleDelay: 150,       // Grace period after last settle

        /**
         * Initialize the navigation interceptor
         */
        init() {
            this.fadeOverlay = document.getElementById('navigation-fade-overlay');

            if (!this.fadeOverlay) {
                console.warn('[NavigationProgress] Fade overlay element not found');
                return;
            }

            // v4.1: Don't hide overlay immediately - enable HTMX tracking instead
            // Overlay will be hidden after all hx-trigger="load" widgets complete
            this.enableHtmxTracking();
            this.clearElementLoading();

            // Intercept all clicks on document (capture phase)
            document.addEventListener('click', this.handleClick.bind(this), true);

            // Safari PWA: Also handle touchend for better iOS support
            // touchend fires before click on iOS, so we use it as primary trigger
            if (this.isSafariPWA()) {
                document.addEventListener('touchend', this.handleTouch.bind(this), true);
                log('[NavigationProgress] Safari PWA mode detected, touchend handler added');
            }

            log('[NavigationProgress] v4.1 Initialized (Pre-fetch + Element Loading + Fade Overlay + HTMX Tracking)');
        },

        /**
         * Detect Safari PWA (standalone mode)
         */
        isSafariPWA() {
            // Check for iOS standalone mode
            const isStandalone = window.navigator.standalone === true;
            // Check for display-mode: standalone
            const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
            // Check for Safari
            const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            return (isStandalone || isDisplayStandalone) && (isSafari || isIOS);
        },

        /**
         * Handle touch events (for Safari PWA)
         */
        handleTouch(event) {
            // Only process single touch
            if (event.changedTouches && event.changedTouches.length !== 1) return;

            const touch = event.changedTouches ? event.changedTouches[0] : event;
            const target = document.elementFromPoint(touch.clientX, touch.clientY);

            if (!target) return;

            const link = target.closest('a');
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
            const href = link.getAttribute('href');
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
            const navItem = element.closest('[data-nav-item], .nav-item');
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
            document.querySelectorAll('.nav-item.loading, [data-nav-item].loading').forEach(el => {
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
         * Enable HTMX tracking for widget loading (v4.1)
         * Keeps overlay visible until all hx-trigger="load" elements complete
         */
        enableHtmxTracking() {
            // Check if HTMX available
            if (typeof htmx === 'undefined') {
                log('[NavigationProgress] HTMX not available, hiding overlay');
                this.hideFadeOverlay();
                return;
            }

            // Check if there are any hx-trigger="load" elements
            const loadTriggerElements = document.querySelectorAll('[hx-trigger*="load"]');
            if (loadTriggerElements.length === 0) {
                log('[NavigationProgress] No HTMX load triggers, hiding overlay');
                this.hideFadeOverlay();
                return;
            }

            this.htmxTrackingEnabled = true;
            this.pendingHtmxRequests = 0;

            // Setup event listeners
            document.body.addEventListener('htmx:beforeRequest', this._htmxBeforeRequest = this.handleHtmxBeforeRequest.bind(this));
            document.body.addEventListener('htmx:afterSettle', this._htmxAfterSettle = this.handleHtmxAfterSettle.bind(this));

            // Timeout fallback - don't wait forever
            this.htmxTrackingTimeout = setTimeout(() => {
                log('[NavigationProgress] HTMX tracking timeout, forcing hide');
                this.completePageTransition();
            }, this.htmxSettleTimeout);

            log('[NavigationProgress] HTMX tracking enabled, found', loadTriggerElements.length, 'load triggers');
        },

        /**
         * Handle htmx:beforeRequest - count pending requests
         */
        handleHtmxBeforeRequest(event) {
            if (!this.htmxTrackingEnabled) return;

            // Only track hx-trigger="load" requests
            const trigger = event.detail?.elt?.getAttribute('hx-trigger');
            if (!trigger || !trigger.includes('load')) return;

            this.pendingHtmxRequests++;
            log('[NavigationProgress] HTMX request started, pending:', this.pendingHtmxRequests);
        },

        /**
         * Handle htmx:afterSettle - decrement counter
         */
        handleHtmxAfterSettle(event) {
            if (!this.htmxTrackingEnabled) return;

            // Only decrement for hx-trigger="load" requests
            const trigger = event.detail?.elt?.getAttribute('hx-trigger');
            if (!trigger || !trigger.includes('load')) return;

            this.pendingHtmxRequests = Math.max(0, this.pendingHtmxRequests - 1);
            log('[NavigationProgress] HTMX request settled, pending:', this.pendingHtmxRequests);

            if (this.pendingHtmxRequests === 0) {
                // Grace period for cascading requests
                setTimeout(() => {
                    if (this.pendingHtmxRequests === 0 && this.htmxTrackingEnabled) {
                        this.completePageTransition();
                    }
                }, this.htmxSettleDelay);
            }
        },

        /**
         * Cleanup HTMX tracking state (v4.1)
         * @private
         */
        _cleanupHtmxTracking() {
            this.htmxTrackingEnabled = false;

            // Clear timeout
            if (this.htmxTrackingTimeout) {
                clearTimeout(this.htmxTrackingTimeout);
                this.htmxTrackingTimeout = null;
            }

            // Remove event listeners
            if (this._htmxBeforeRequest) {
                document.body.removeEventListener('htmx:beforeRequest', this._htmxBeforeRequest);
                this._htmxBeforeRequest = null;
            }
            if (this._htmxAfterSettle) {
                document.body.removeEventListener('htmx:afterSettle', this._htmxAfterSettle);
                this._htmxAfterSettle = null;
            }
        },

        /**
         * Complete page transition - hide overlay smoothly (v4.1)
         */
        completePageTransition() {
            if (!this.htmxTrackingEnabled) return;

            this._cleanupHtmxTracking();
            this.hideFadeOverlay();

            log('[NavigationProgress] Page transition complete, all widgets loaded');
        },

        /**
         * Cancel current navigation
         */
        cancel() {
            if (this.currentController) {
                this.currentController.abort();
                this.currentController = null;
            }

            // v4.1: Also cancel HTMX tracking
            if (this.htmxTrackingEnabled) {
                this._cleanupHtmxTracking();
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
            window.NavigationProgress.htmxTrackingEnabled = false;  // v4.1
            window.NavigationProgress.hideFadeOverlay();
            window.NavigationProgress.clearElementLoading();
        }
    });

    // Export globally
    window.NavigationProgress = NavigationProgress;

})();
