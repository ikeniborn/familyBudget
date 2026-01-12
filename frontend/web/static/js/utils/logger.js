"use strict";
/**
 * Centralized Logger Class
 *
 * Provides environment-aware logging with module-specific control.
 *
 * Usage:
 * ```typescript
 * const logAPI = new Logger('[API]', 'API');
 * logAPI.info('Request started');
 * logAPI.time('API call');
 * // ... operation ...
 * logAPI.timeEnd('API call');
 * ```
 *
 * @version 2.0.0
 * @date 2026-01-05
 */
class Logger {
    /**
     * Create a logger instance
     * @param prefix - Log prefix (e.g., '[API]', '[DB]', '[SYNC]')
     * @param moduleKey - Module key for configuration (e.g., 'API', 'DB', 'SYNC')
     */
    constructor(prefix, moduleKey) {
        this.prefix = prefix;
        this.moduleKey = moduleKey;
    }
    /**
     * Check if logging is enabled for this module
     */
    get isEnabled() {
        return window.LOGGING_CONFIG?.enabled === true &&
            window.LOGGING_CONFIG?.modules[this.moduleKey] === true;
    }
    /**
     * Check if specific log level is enabled
     * @param level - Log level ('debug', 'info', 'warn', 'error')
     */
    isLevelEnabled(level) {
        return this.isEnabled && window.LOGGING_CONFIG?.levels[level] === true;
    }
    /**
     * Debug level logging (verbose, development only)
     * @param args - Arguments to log
     */
    debug(...args) {
        if (this.isLevelEnabled('debug') && console.debug) {
            console.debug(this.prefix, ...args);
        }
    }
    /**
     * Info level logging (general information)
     * @param args - Arguments to log
     */
    info(...args) {
        if (this.isLevelEnabled('info')) {
            console.log(this.prefix, ...args);
            // Send to LogsCollector if available (for admin logs page)
            if (window.logsCollector) {
                window.logsCollector.captureLog('info', this.prefix, args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), new Date().toISOString());
            }
        }
    }
    /**
     * Warning level logging (always enabled)
     * @param args - Arguments to log
     */
    warn(...args) {
        if (this.isEnabled) {
            console.warn(this.prefix, ...args);
            // Send to LogsCollector if available (for admin logs page)
            if (window.logsCollector) {
                window.logsCollector.captureLog('warning', this.prefix, args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), new Date().toISOString());
            }
        }
    }
    /**
     * Error level logging (always enabled, not affected by config)
     * @param args - Arguments to log
     */
    error(...args) {
        // Errors always logged regardless of config
        console.error(this.prefix, ...args);
        // Send to LogsCollector if available (for admin logs page)
        if (window.logsCollector) {
            window.logsCollector.captureLog('error', this.prefix, args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), new Date().toISOString());
        }
    }
    /**
     * Group related log messages
     * @param label - Group label
     */
    group(label) {
        if (this.isEnabled && console.group) {
            console.group(`${this.prefix} ${label}`);
        }
    }
    /**
     * Group related log messages (collapsed by default)
     * @param label - Group label
     */
    groupCollapsed(label) {
        if (this.isEnabled && console.groupCollapsed) {
            console.groupCollapsed(`${this.prefix} ${label}`);
        }
    }
    /**
     * End current group
     */
    groupEnd() {
        if (this.isEnabled && console.groupEnd) {
            console.groupEnd();
        }
    }
    /**
     * Start a timer with label
     * @param label - Timer label
     */
    time(label) {
        if (this.isEnabled && console.time) {
            console.time(`${this.prefix} ${label}`);
        }
    }
    /**
     * End a timer and log elapsed time
     * @param label - Timer label
     */
    timeEnd(label) {
        if (this.isEnabled && console.timeEnd) {
            console.timeEnd(`${this.prefix} ${label}`);
        }
    }
    /**
     * Log a table (for structured data)
     * @param data - Data to display as table
     */
    table(data) {
        if (this.isEnabled && console.table) {
            console.log(this.prefix);
            console.table(data);
        }
    }
    /**
     * Log with custom styling (browser only)
     * @param message - Message to log
     * @param style - CSS style string
     */
    styled(message, style) {
        if (this.isEnabled) {
            console.log(`%c${this.prefix} ${message}`, style);
        }
    }
}
// Export to window for global access
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    // Create pre-configured loggers for common modules
    window.logPWA = new Logger('[PWA]', 'PWA');
    window.logSW = new Logger('[SW]', 'SW');
    window.logDB = new Logger('[DB]', 'DB');
    window.logSync = new Logger('[SYNC]', 'SYNC');
    window.logAPI = new Logger('[API]', 'API');
    window.logPerf = new Logger('[PERF]', 'PERF');
    window.logForm = new Logger('[FORM]', 'FORM');
    window.logWorker = new Logger('[WORKER]', 'WORKER');
    window.logPlan = new Logger('[PLAN]', 'PLAN');
    window.logCSV = new Logger('[CSV]', 'CSV');
    window.logWSRTT = new Logger('[WS_RTT]', 'WS_RTT');
    window.logWSState = new Logger('[WS_STATE]', 'WS_STATE');
    // Navigation and RTT filtering loggers
    window.logNav = new Logger('[NAV]', 'NAV');
    window.logRTTFilter = new Logger('[RTT_FILTER]', 'RTT_FILTER');
    // Shopping Lists loggers
    window.logDuplicateSearch = new Logger('[DUPLICATE_SEARCH]', 'DUPLICATE_SEARCH');
    window.logItemSave = new Logger('[ITEM_SAVE]', 'ITEM_SAVE');
    window.logLists = new Logger('[LISTS]', 'LISTS');
    // Modal Keyboard Adaptation logger
    window.logModalKB = new Logger('[MODAL_KB]', 'MODAL_KB');
    // Log logger initialization (only if logging enabled)
    if (window.LOGGING_CONFIG?.enabled) {
        console.log('[LOGGER] Centralized logging initialized');
        console.log('[LOGGER] Available loggers:', {
            PWA: 'window.logPWA',
            SW: 'window.logSW',
            DB: 'window.logDB',
            SYNC: 'window.logSync',
            API: 'window.logAPI',
            PERF: 'window.logPerf',
            FORM: 'window.logForm',
            WORKER: 'window.logWorker',
            PLAN: 'window.logPlan',
            CSV: 'window.logCSV',
            WS_RTT: 'window.logWSRTT',
            WS_STATE: 'window.logWSState',
            NAV: 'window.logNav',
            RTT_FILTER: 'window.logRTTFilter',
            DUPLICATE_SEARCH: 'window.logDuplicateSearch',
            ITEM_SAVE: 'window.logItemSave',
            LISTS: 'window.logLists',
            MODAL_KB: 'window.logModalKB'
        });
    }
}
//# sourceMappingURL=logger.js.map