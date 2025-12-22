/**
 * Navigation Progress Module
 * Intercepts internal navigation and shows real loading progress.
 *
 * Features:
 * - Intercepts clicks on internal links
 * - Uses fetch with ReadableStream for real progress tracking
 * - Falls back to animated progress if Content-Length unknown
 * - Replaces page content smoothly
 * - Handles errors gracefully
 *
 * @version 1.0.0
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
            minDisplayTime: 150,      // Minimum visible time for UX
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

            // Handle browser back/forward
            window.addEventListener('popstate', this.handlePopState.bind(this));

            // Listen for navigation-complete event to reinitialize widgets
            window.addEventListener('page-navigation-complete', this.onNavigationComplete.bind(this));

            debugLog('[NavigationProgress] Initialized');
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
         * Handle browser back/forward navigation
         */
        handlePopState(event) {
            // Only handle if we have a state object (from our pushState)
            if (event.state && event.state.url) {
                this.navigateTo(event.state.url, false);
            } else if (!event.state) {
                // Browser back without state - reload current URL
                this.navigateTo(window.location.pathname + window.location.search, false);
            }
        },

        /**
         * Navigate to URL with progress
         */
        async navigateTo(url, updateHistory = true) {
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
                // Fetch the page
                const response = await this.fetchWithProgress(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Get HTML content
                const html = await response.text();

                // Complete progress
                this.setProgress(100);

                // Wait for minimum display time
                const elapsed = Date.now() - this.startTime;
                const remaining = Math.max(0, this.config.minDisplayTime - elapsed);

                await this.delay(remaining);

                // Replace page content
                this.replacePage(html, url, updateHistory);

            } catch (error) {
                if (error.name === 'AbortError') {
                    debugLog('[NavigationProgress] Navigation cancelled');
                    return;
                }

                console.error('[NavigationProgress] Navigation failed:', error);
                this.hideProgress();
                this.isNavigating = false;

                // Show error toast
                if (typeof showToast === 'function') {
                    showToast('Ошибка загрузки страницы', 'error');
                }

                // For network errors, fall back to normal navigation
                if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed')) {
                    window.location.href = url;
                }
            }
        },

        /**
         * Fetch URL with real progress tracking
         */
        async fetchWithProgress(url) {
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
                return response;
            }

            // Read response with progress tracking
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;
            let useFallback = false;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                loaded += value.length;

                // Gzip/Brotli fix: if loaded exceeds total by too much, switch to fallback
                if (loaded > total * 1.5) {
                    if (!useFallback) {
                        useFallback = true;
                        this.startAnimatedProgress();
                    }
                } else {
                    // Calculate and update progress (5-95% range, reserve 100% for parsing)
                    const percentComplete = 5 + (loaded / total) * 90;
                    this.setProgress(Math.min(95, percentComplete));
                }
            }

            // Combine chunks into single response
            const blob = new Blob(chunks);
            const text = await blob.text();

            // Create new response with text
            return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
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
         * Replace page content with new HTML
         */
        replacePage(html, url, updateHistory) {
            try {
                // Parse HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Extract key elements
                const newTitle = doc.querySelector('title')?.textContent || document.title;
                const newMain = doc.querySelector('#main-content');

                // Update title
                document.title = newTitle;

                // Update main content
                if (newMain) {
                    const currentMain = document.getElementById('main-content');
                    if (currentMain) {
                        currentMain.innerHTML = newMain.innerHTML;
                    }
                }

                // Update history
                if (updateHistory) {
                    window.history.pushState({ url: url }, newTitle, url);
                }

                // Scroll to top
                window.scrollTo(0, 0);

                // Dispatch navigation complete event
                const oldUrl = window.location.href;
                window.dispatchEvent(new CustomEvent('page-navigation-complete', {
                    detail: { url: url, fromUrl: oldUrl }
                }));

                // Hide progress bar
                this.hideProgress();
                this.isNavigating = false;

                debugLog('[NavigationProgress] Page replaced:', url);

            } catch (error) {
                console.error('[NavigationProgress] Failed to replace page:', error);
                // Fallback to normal navigation
                window.location.href = url;
            }
        },

        /**
         * Called when navigation completes - reinitialize scripts
         */
        onNavigationComplete(event) {
            debugLog('[NavigationProgress] Navigation complete, reinitializing scripts');

            // Re-trigger HTMX on new content
            if (typeof htmx !== 'undefined') {
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    htmx.process(mainContent);
                }
            }

            // Update active nav links
            this.updateActiveNavLinks();

            // Refresh HTMX widgets if available
            if (typeof HTMXWidgets !== 'undefined') {
                HTMXWidgets.refreshAllDebounced();
            }
        },

        /**
         * Update navbar active states
         */
        updateActiveNavLinks() {
            const currentPath = window.location.pathname;

            // Desktop menu and mobile menu
            const menuSelectors = '#navbar-center-menu a, #mobile-menu-content a';
            document.querySelectorAll(menuSelectors).forEach(link => {
                const href = link.getAttribute('href');
                if (!href) return;

                const isActive = href === currentPath ||
                    (href !== '/' && currentPath.startsWith(href));

                if (isActive) {
                    link.classList.add('active');
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                }
            });
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
