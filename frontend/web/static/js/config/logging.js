/**
 * Logging Configuration
 *
 * Environment-based logging control for Family Budget application.
 *
 * Features:
 * - Automatic environment detection (production/staging/development)
 * - Module-specific enable/disable
 * - Log level control (debug/info/warn/error)
 * - Zero logging overhead in production
 *
 * Environment Detection:
 * - Production: If hostname contains production domain (logging mostly disabled)
 * - Development: localhost or 127.0.0.1 (all logging enabled)
 * - Staging: Other hostnames (info logging enabled, debug disabled)
 *
 * @version 1.0.0
 * @date 2025-12-26
 */

(function() {
    'use strict';

    // Detect environment based on hostname
    const hostname = window.location.hostname;
    const isProduction = hostname.includes('your-production-domain.com');  // TODO: Replace with actual production domain
    const isDevelopment = hostname === 'localhost' ||
                          hostname === '127.0.0.1' ||
                          hostname.startsWith('192.168.');

    // Logging configuration
    window.LOGGING_CONFIG = {
        // Global enable/disable
        enabled: !isProduction,  // Disable all logging in production

        // Log levels (hierarchical: debug < info < warn < error)
        levels: {
            debug: isDevelopment,      // Verbose logging (development only)
            info: !isProduction,       // General information (development + staging)
            warn: true,                // Warnings (always enabled)
            error: true                // Errors (always enabled, not configurable)
        },

        // Module-specific control
        modules: {
            PWA: true,                 // Progressive Web App lifecycle
            SW: true,                  // Service Worker events
            DB: isDevelopment,         // IndexedDB operations (verbose in dev only)
            SYNC: true,                // Offline sync queue
            API: true,                 // API request/response
            PERF: isDevelopment,       // Performance monitoring (dev only)
            FORM: true,                // Form submission/validation
            WORKER: isDevelopment,     // Web Workers (dev only)
            PLAN: true,                // Recurring plan operations
            CSV: true,                 // CSV import/export
            WS_DIAG: true              // WebSocket diagnostics modal
        },

        // Environment info (for debugging)
        environment: {
            hostname: hostname,
            isProduction: isProduction,
            isDevelopment: isDevelopment,
            userAgent: navigator.userAgent
        }
    };

    // Log configuration (only if logging enabled)
    if (window.LOGGING_CONFIG.enabled) {
        console.log('%c[LOGGING] Configuration loaded', 'color: #4CAF50; font-weight: bold');
        console.log('[LOGGING] Environment:', window.LOGGING_CONFIG.environment);
        console.log('[LOGGING] Enabled levels:', {
            debug: window.LOGGING_CONFIG.levels.debug,
            info: window.LOGGING_CONFIG.levels.info,
            warn: window.LOGGING_CONFIG.levels.warn,
            error: window.LOGGING_CONFIG.levels.error
        });
        console.log('[LOGGING] Enabled modules:', Object.keys(window.LOGGING_CONFIG.modules).filter(
            k => window.LOGGING_CONFIG.modules[k]
        ).join(', '));
    }

    // Expose helper to change config at runtime (for debugging)
    window.setLoggingLevel = function(module, enabled) {
        if (window.LOGGING_CONFIG && window.LOGGING_CONFIG.modules.hasOwnProperty(module)) {
            window.LOGGING_CONFIG.modules[module] = enabled;
            console.log(`[LOGGING] Module ${module} logging ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            console.error(`[LOGGING] Unknown module: ${module}`);
        }
    };

    // Expose helper to enable/disable all logging
    window.setLoggingEnabled = function(enabled) {
        if (window.LOGGING_CONFIG) {
            window.LOGGING_CONFIG.enabled = enabled;
            console.log(`[LOGGING] All logging ${enabled ? 'enabled' : 'disabled'}`);
        }
    };

    // Expose helper to get logging stats
    window.getLoggingStatus = function() {
        if (!window.LOGGING_CONFIG) {
            return { enabled: false };
        }

        const enabledModules = Object.keys(window.LOGGING_CONFIG.modules).filter(
            k => window.LOGGING_CONFIG.modules[k]
        );

        return {
            enabled: window.LOGGING_CONFIG.enabled,
            environment: window.LOGGING_CONFIG.environment,
            levels: window.LOGGING_CONFIG.levels,
            enabledModules: enabledModules,
            totalModules: Object.keys(window.LOGGING_CONFIG.modules).length
        };
    };
})();
