/**
 * Navigation Progress Module v2.0
 * Pre-fetch + Navigate approach
 *
 * Flow:
 * 1. Intercept link click
 * 2. Show progress bar
 * 3. Fetch page (get real progress from ReadableStream)
 * 4. When 100% → window.location.href (browser loads from cache)
 * 5. All inline scripts work (real page load)
 *
 * @version 2.0.0
 */

(function() {
    'use strict';

    const NavigationProgress = {
        // DOM elements
        progressBar: null,
        currentController: null,

        // Configuration
        config: {
            timeout: 30000,           // 30 seconds max
            minDisplayTime: 100,      // Minimum visible time for UX
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
            if (!this.progressBar) {
                console.warn('[NavigationProgress] Progress bar element not found');
                return;
            }

            // Intercept all clicks on document (capture phase)
            document.addEventListener('click', this.handleClick.bind(this), true);

            debugLog('[NavigationProgress] v2.0 Initialized (Pre-fetch + Navigate)');
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
                debugLog('[NavigationProgress] Mobile menu closed');
            }
        },

        /**
         * Handle click events
         */
        handleClick(event) {
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
         * Navigate to URL with progress (Pre-fetch + Navigate approach)
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

                // Complete progress
                this.setProgress(100);

                // Wait for minimum display time (UX)
                const elapsed = Date.now() - this.startTime;
                const remaining = Math.max(0, this.config.minDisplayTime - elapsed);
                await this.delay(remaining);

                // Navigate normally - browser loads from HTTP cache (instant)
                // All inline scripts will execute properly
                this.isNavigating = false;
                window.location.href = url;

            } catch (error) {
                if (error.name === 'AbortError') {
                    debugLog('[NavigationProgress] Navigation cancelled');
                    return;
                }

                console.error('[NavigationProgress] Pre-fetch failed:', error);
                this.hideProgress();
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

            // If no Content-Length or no body, use animated fallback
            if (!total || !response.body) {
                this.startAnimatedProgress();
                // Still consume the response to warm cache
                await response.text();
                return;
            }

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
                    // Calculate and update progress (5-95% range, reserve 100% for navigation)
                    const percentComplete = 5 + (loaded / total) * 90;
                    this.setProgress(Math.min(95, percentComplete));
                }
            }

            // Response fully consumed → HTTP cache warmed
        },

        /**
         * Start animated progress (fallback when Content-Length unknown)
         */
        startAnimatedProgress() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }

            const animate = () => {
                if (!this.isNavigating || this.progress >= 90) return;

                // Slow down as we approach 90%
                const increment = (90 - this.progress) / 20;
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

    // Export globally
    window.NavigationProgress = NavigationProgress;

})();
