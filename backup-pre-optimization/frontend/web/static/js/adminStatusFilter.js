/**
 * Universal Status Filter for Admin Pages
 * Handles all/active/archived button states with DaisyUI styling.
 *
 * Usage:
 *   1. Include this script: <script src="/static/js/adminStatusFilter.js"></script>
 *   2. Define your render callback: window.onStatusFilterChange = function(status) { renderTable(); }
 *   3. Call updateStatusFilter('all'), updateStatusFilter('active'), or updateStatusFilter('archived')
 *
 * Default button IDs: status-all, status-active, status-archived
 * Override by setting window.statusFilterConfig = { allId: 'my-all', activeId: 'my-active', archivedId: 'my-archived' }
 */

(function() {
    'use strict';

    // Default configuration
    const defaultConfig = {
        allId: 'status-all',
        activeId: 'status-active',
        archivedId: 'status-archived'
    };

    // Get configuration (allow override via window.statusFilterConfig)
    function getConfig() {
        return Object.assign({}, defaultConfig, window.statusFilterConfig || {});
    }

    // Update button visual states
    function updateButtonStates(status, config) {
        const buttons = {
            'all': document.getElementById(config.allId),
            'active': document.getElementById(config.activeId),
            'archived': document.getElementById(config.archivedId)
        };

        Object.entries(buttons).forEach(([key, btn]) => {
            if (!btn) return;

            if (key === status) {
                btn.classList.remove('btn-outline');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.add('btn-outline');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    // Main function to update status filter
    function updateStatusFilter(status) {
        // Validate status
        if (!['all', 'active', 'archived'].includes(status)) {
            console.warn('Invalid status:', status);
            status = 'all';
        }

        // Update global state variable if defined
        if (typeof window.currentStatusFilter !== 'undefined') {
            window.currentStatusFilter = status;
        }

        // Update button states
        const config = getConfig();
        updateButtonStates(status, config);

        // Call callback if defined
        if (typeof window.onStatusFilterChange === 'function') {
            window.onStatusFilterChange(status);
        }
    }

    // Expose to global scope
    window.updateStatusFilter = updateStatusFilter;

    // Helper: Get initial status from URL query parameter or localStorage
    window.getInitialStatusFilter = function() {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('status');
        if (['all', 'active', 'archived'].includes(fromUrl)) {
            return fromUrl;
        }
        return localStorage.getItem('adminStatusFilter') || 'all';
    };

    // Helper: Save status to localStorage
    window.saveStatusFilter = function(status) {
        localStorage.setItem('adminStatusFilter', status);
    };

})();
