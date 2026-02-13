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
 * Info Logging Cleanup (2026-01-13):
 * - Removed .info() calls from code to reduce console noise
 * - Affected modules: PUSH_BANNER, WS_STATE, API, LISTS_INIT, WEBAUTHN, WEBAUTHN_EXPORTS, ADMIN_LOGS
 * - Total removed: 46 info-level log calls (31 initial + 15 admin_logs)
 * - Preserved: All .error(), .warn(), .debug() calls remain for debugging
 * - Logger infrastructure remains intact - only explicit .info() calls were removed
 *
 * @version 1.1.0
 * @date 2026-01-13
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
        // NOTE: Info-level logs removed from code for these modules (2026-01-13):
        // PUSH_BANNER, API, WS_STATE, LISTS_INIT (no longer in code, only error/warn/debug remain)
        modules: {
            PWA: true,                 // Progressive Web App lifecycle
            SW: true,                  // Service Worker events
            DB: isDevelopment,         // IndexedDB operations (verbose in dev only)
            SYNC: true,                // Offline sync queue
            API: true,                 // API request/response (info logs removed from code)
            PERF: isDevelopment,       // Performance monitoring (dev only)
            FORM: true,                // Form submission/validation
            WORKER: isDevelopment,     // Web Workers (dev only)
            PLAN: true,                // Recurring plan operations
            CSV: true,                 // CSV import/export
            WS_DIAG: true,             // WebSocket diagnostics modal
            WS_RTT: true,              // WebSocket RTT measurement logging
            WS_STATE: true,            // WebSocket badge state (info logs removed from code)
            NAV: true,                 // Navigation detection for RTT filtering
            RTT_FILTER: true,          // RTT filtering logic
            CACHE: isDevelopment,      // Cache metrics collection (dev only)
            DUPLICATE_SEARCH: true,    // Shopping list duplicate detection
            ITEM_SAVE: true,           // Shopping list item save operations
            LISTS: true,               // Shopping lists general operations
            MODAL_KB: isDevelopment,   // Modal keyboard adaptation
            PUSH_BANNER: true,         // Push permission banner (info logs removed from code)
            ADMIN_LOGS: true,          // Admin logs page (info logs removed from code)
            CONFLICT: true,            // Conflict resolution (task-009: LWW strategy)
            DEXIE: isDevelopment       // Dexie database operations (dev only)
        },

        // Environment info (for debugging)
        environment: {
            hostname: hostname,
            isProduction: isProduction,
            isDevelopment: isDevelopment
            // НЕ включаем userAgent в глобальный конфиг (fingerprinting risk)
            // userAgent может быть получен отдельно при необходимости
        }
    };

    // Log configuration (only if logging enabled)
    if (window.LOGGING_CONFIG.enabled) {
        // Logging configured
    }

    // Expose helper to change config at runtime (for debugging)
    window.setLoggingLevel = function(module, enabled) {
        if (window.LOGGING_CONFIG && window.LOGGING_CONFIG.modules.hasOwnProperty(module)) {
            window.LOGGING_CONFIG.modules[module] = enabled;
        } else {
            console.error(`[LOGGING] Unknown module: ${module}`);
        }
    };

    // Expose helper to enable/disable all logging
    window.setLoggingEnabled = function(enabled) {
        if (window.LOGGING_CONFIG) {
            window.LOGGING_CONFIG.enabled = enabled;
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
