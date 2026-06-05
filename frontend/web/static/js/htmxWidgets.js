/**
 * HTMX Widget Manager
 * Standardizes dashboard widget refresh patterns.
 *
 * Usage:
 *   <script src="/static/js/htmxWidgets.js"></script>
 *
 *   // Refresh all widgets
 *   HTMXWidgets.refreshAll();
 *
 *   // Refresh specific widget
 *   HTMXWidgets.refreshWidget('quick-stats');
 *
 * Widgets:
 *   - quick-stats: Quick statistics summary
 *   - account-balances: Account balances
 *   - recent-transactions: Recent transactions list
 */

(function() {
    'use strict';

    const HTMXWidgets = {
        // Debounce state
        _debounceTimers: {},
        _debounceDelay: 300, // ms - prevents multiple rapid refreshes

        // Widget configurations
        widgets: {
            'quick-stats': {
                url: '/api/v1/analytics/quick-stats-html',
                target: '#quick-stats',
                swap: 'innerHTML'
            },
            'account-balances': {
                url: '/api/v1/analytics/account-balances-html',
                target: '#account-balances',
                swap: 'innerHTML'
            },
            'recent-transactions': {
                url: '/api/v1/facts/recent-html?limit=10',
                target: '#recent-transactions',
                swap: 'innerHTML'
            }
        },

        /**
         * Refresh a single widget by its ID
         * @param {string} widgetId - Widget identifier (e.g., 'quick-stats')
         * @returns {boolean} - true if refresh was initiated, false if widget not found
         */
        refreshWidget(widgetId) {
            const config = this.widgets[widgetId];
            if (!config) {
                console.warn('[HTMXWidgets] Unknown widget:', widgetId);
                return false;
            }

            const targetElement = document.querySelector(config.target);
            if (!targetElement) {
                console.debug('[HTMXWidgets] Target not found:', config.target);
                return false;
            }

            if (typeof htmx === 'undefined') {
                console.error('[HTMXWidgets] htmx is not loaded');
                return false;
            }

            htmx.ajax('GET', config.url, {
                target: config.target,
                swap: config.swap
            });

            return true;
        },

        /**
         * Refresh all dashboard widgets
         * Only refreshes widgets that exist on the current page
         */
        refreshAll() {
            Object.keys(this.widgets).forEach(widgetId => {
                this.refreshWidget(widgetId);
            });
        },

        /**
         * Refresh quick stats and account balances (without transactions)
         * Useful after balance changes
         */
        refreshStats() {
            this.refreshWidget('quick-stats');
            this.refreshWidget('account-balances');
        },

        /**
         * Refresh recent transactions only
         */
        refreshTransactions() {
            this.refreshWidget('recent-transactions');
        },

        /**
         * Refresh a single widget with debouncing
         * Prevents multiple rapid refreshes of the same widget
         * @param {string} widgetId - Widget identifier
         */
        refreshWidgetDebounced(widgetId) {
            clearTimeout(this._debounceTimers[widgetId]);
            this._debounceTimers[widgetId] = setTimeout(() => {
                this.refreshWidget(widgetId);
            }, this._debounceDelay);
        },

        /**
         * Refresh all widgets with debouncing
         * Each widget is debounced independently
         */
        refreshAllDebounced() {
            Object.keys(this.widgets).forEach(widgetId => {
                this.refreshWidgetDebounced(widgetId);
            });
        },

        /**
         * Cancel pending debounced refresh for a widget
         * @param {string} widgetId - Widget identifier
         */
        cancelDebouncedRefresh(widgetId) {
            clearTimeout(this._debounceTimers[widgetId]);
        },

        /**
         * Cancel all pending debounced refreshes
         */
        cancelAllDebouncedRefreshes() {
            Object.keys(this._debounceTimers).forEach(widgetId => {
                clearTimeout(this._debounceTimers[widgetId]);
            });
            this._debounceTimers = {};
        },

        /**
         * Initialize event listeners for automatic refresh
         * Called automatically when script loads
         */
        init() {
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });

            // Show an error alert inside a widget when its HTMX load fails.
            // htmx:responseError = non-2xx response; htmx:sendError = network failure.
            // Scoped to known widget IDs so unrelated HTMX targets are untouched.
            const widgetIds = new Set(Object.keys(this.widgets));
            const errorHTML = `
                <div class="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                         class="stroke-current shrink-0 w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Ошибка загрузки. Попробуйте обновить страницу.</span>
                </div>`;

            const handleError = (event) => {
                const elt = event.detail && event.detail.elt;
                if (elt && widgetIds.has(elt.id)) {
                    elt.innerHTML = errorHTML;
                }
            };

            document.body.addEventListener('htmx:responseError', handleError);
            document.body.addEventListener('htmx:sendError', handleError);
        }
    };

    // Auto-init when DOM is ready
    if (document.readyState !== 'loading') {
        HTMXWidgets.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => HTMXWidgets.init());
    }

    // Expose to global scope
    window.HTMXWidgets = HTMXWidgets;

})();
