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
         * Initialize event listeners for automatic refresh
         * Called automatically when script loads
         */
        init() {
            // Refresh on network recovery
            window.addEventListener('online', () => {
                console.debug('[HTMXWidgets] Network online - refreshing widgets');
                this.refreshAll();
            });

            // Refresh on custom network-status-change event
            window.addEventListener('network-status-change', (event) => {
                if (event.detail && event.detail.status === 'online') {
                    console.debug('[HTMXWidgets] Network status change to online - refreshing widgets');
                    this.refreshAll();
                }
            });
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
