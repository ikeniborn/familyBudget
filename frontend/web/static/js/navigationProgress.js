/**
 * Navigation Progress Module v3.1
 * Pre-fetch + Overlay approach with Safari PWA support
 *
 * Flow:
 * 1. Intercept link click/touch
 * 2. Show progress bar (5-95%)
 * 3. Pre-fetch page in background (warms HTTP cache)
 * 4. Wait for minimum display time (1 second)
 * 5. Show overlay at 100% → navigate
 * 6. Target page hides overlay after load (via pageshow event)
 *
 * Key improvements over v3.0:
 * - Safari PWA standalone mode support
 * - Touch event handling for iOS
 * - Defensive debugLog checks
 * - ReadableStream fallback for older browsers
 *
 * @version 3.1.0
 */

(function() {
    'use strict';

    // Defensive debugLog - prevent errors if not defined
    var log = (typeof debugLog === 'function') ? debugLog : function() {};

    const NavigationProgress = {
        // DOM elements
        progressBar: null,
        overlay: null,
        currentController: null,

        // Configuration
        config: {
            timeout: 30000,           // 30 seconds max
            minDisplayTime: 1000,     // Minimum 1 second for better UX
            overlayDelay: 50,         // Delay before navigation after overlay shown
            animatedFallbackSpeed: 30 // Fake progress increment per 100ms
        },

        // State
        isNavigating: false,
        progress: 0,
        startTime: 0,
        animationFrameId: null,

        /**
         * Initialize the navigation interceptor
         */
        init() {
            this.progressBar = document.getElementById('navigation-progress');
            this.overlay = document.getElementById('navigation-overlay');

            if (!this.progressBar) {
                console.warn('[NavigationProgress] Progress bar element not found');
                return;
            }

            // Hide overlay on incoming navigation (page load)
            this.hideOverlay();

            // Intercept all clicks on document (capture phase)
            document.addEventListener('click', this.handleClick.bind(this), true);

            // Safari PWA: Also handle touchend for better iOS support
            // touchend fires before click on iOS, so we use it as primary trigger
            if (this.isSafariPWA()) {
                document.addEventListener('touchend', this.handleTouch.bind(this), true);
                log('[NavigationProgress] Safari PWA mode detected, touchend handler added');
            }

            log('[NavigationProgress] v3.1 Initialized (Pre-fetch + Overlay + Safari PWA)');
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
            this.progress = 0;
            this.startTime = Date.now();
            this.currentController = new AbortController();

            // Show progress bar
            this.showProgress();
            this.setProgress(5); // Initial progress to show activity

            try {
                // Pre-fetch the page (warms HTTP cache + shows real progress)
                await this.prefetchWithProgress(url);

                // Ensure minimum display time (1 second)
                const elapsed = Date.now() - this.startTime;
                const remaining = Math.max(0, this.config.minDisplayTime - elapsed);

                if (remaining > 0) {
                    // Animate progress smoothly during remaining time
                    await this.animateToComplete(remaining);
                }

                // Complete progress
                this.setProgress(100);

                // Show overlay before navigation (hides DOM cleanup)
                this.showOverlay();

                // Small delay to ensure overlay is rendered
                await this.delay(this.config.overlayDelay);

                // Navigate normally - browser loads from HTTP cache
                // All inline scripts will execute properly
                // Overlay will be hidden by target page's pageshow handler
                this.isNavigating = false;
                window.location.href = url;

            } catch (error) {
                if (error.name === 'AbortError') {
                    log('[NavigationProgress] Navigation cancelled');
                    return;
                }

                console.error('[NavigationProgress] Pre-fetch failed:', error);
                this.hideProgress();
                this.hideOverlay();
                this.isNavigating = false;

                // Fall back to normal navigation (let browser handle it)
                window.location.href = url;
            }
        },

        /**
         * Pre-fetch URL with real progress tracking
         * The response warms the HTTP cache for instant subsequent load
         */
        async prefetchWithProgress(url) {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                signal: this.currentController.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    'X-Requested-With': 'NavigationProgress'
                }
            });

            // Get Content-Length for progress calculation
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;

            // Check if ReadableStream is available (Safari PWA might not support it)
            const hasReadableStream = response.body && typeof response.body.getReader === 'function';

            // If no Content-Length, no body, or no ReadableStream support, use animated fallback
            if (!total || !hasReadableStream) {
                this.startAnimatedProgress();
                // Still consume the response to warm cache
                await response.text();
                return;
            }

            try {
                // Read response with progress tracking
                const reader = response.body.getReader();
                let loaded = 0;
                let useFallback = false;

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    loaded += value.length;

                    // Gzip/Brotli fix: if loaded exceeds total by too much, switch to fallback
                    if (loaded > total * 1.5) {
                        if (!useFallback) {
                            useFallback = true;
                            this.startAnimatedProgress();
                        }
                    } else {
                        // Calculate and update progress (5-90% range, reserve 90-100% for minimum time)
                        const percentComplete = 5 + (loaded / total) * 85;
                        this.setProgress(Math.min(90, percentComplete));
                    }
                }

                // Response fully consumed → HTTP cache warmed
            } catch (streamError) {
                // ReadableStream error (Safari PWA edge case) - fallback to animated progress
                log('[NavigationProgress] ReadableStream error, using fallback:', streamError.message);
                this.startAnimatedProgress();
                // Note: response already consumed by failed getReader, cache should be warmed
            }
        },

        /**
         * Start animated progress (fallback when Content-Length unknown)
         */
        startAnimatedProgress() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }

            const animate = () => {
                if (!this.isNavigating || this.progress >= 85) return;

                // Slow down as we approach 85%
                const increment = (85 - this.progress) / 20;
                this.setProgress(this.progress + Math.max(0.3, increment));

                this.animationFrameId = requestAnimationFrame(animate);
            };

            // Start animation with slight delay
            setTimeout(() => {
                if (this.isNavigating) {
                    this.animationFrameId = requestAnimationFrame(animate);
                }
            }, 100);
        },

        /**
         * Animate progress from current to 100% over specified duration
         */
        async animateToComplete(duration) {
            const startProgress = this.progress;
            const targetProgress = 100;
            const startTime = Date.now();

            return new Promise(resolve => {
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const ratio = Math.min(1, elapsed / duration);

                    // Ease-out animation
                    const easedRatio = 1 - Math.pow(1 - ratio, 2);
                    const currentProgress = startProgress + (targetProgress - startProgress) * easedRatio;

                    this.setProgress(currentProgress);

                    if (ratio < 1 && this.isNavigating) {
                        requestAnimationFrame(animate);
                    } else {
                        resolve();
                    }
                };

                requestAnimationFrame(animate);
            });
        },

        /**
         * Show overlay (before navigation)
         */
        showOverlay() {
            if (!this.overlay) return;
            this.overlay.classList.add('active');
        },

        /**
         * Hide overlay (after page load)
         */
        hideOverlay() {
            if (!this.overlay) return;
            this.overlay.classList.remove('active');
        },

        /**
         * Show progress bar
         */
        showProgress() {
            if (!this.progressBar) return;
            this.progressBar.style.width = '0%';
            this.progressBar.classList.add('active');
            this.progressBar.classList.remove('complete');
        },

        /**
         * Set progress percentage
         */
        setProgress(percent) {
            this.progress = Math.min(100, Math.max(0, percent));
            if (this.progressBar) {
                this.progressBar.style.width = `${this.progress}%`;
            }
        },

        /**
         * Hide progress bar
         */
        hideProgress() {
            if (!this.progressBar) return;

            // Stop any running animation
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            this.progressBar.classList.add('complete');
            setTimeout(() => {
                this.progressBar.classList.remove('active', 'complete');
                this.progressBar.style.width = '0%';
            }, 400);
        },

        /**
         * Cancel current navigation
         */
        cancel() {
            if (this.currentController) {
                this.currentController.abort();
                this.currentController = null;
            }
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this.hideProgress();
            this.hideOverlay();
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
        const overlay = document.getElementById('navigation-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }

        // Reset navigation state
        if (window.NavigationProgress) {
            window.NavigationProgress.isNavigating = false;
            window.NavigationProgress.hideProgress();
        }
    });

    // Export globally
    window.NavigationProgress = NavigationProgress;

})();
