/**
 * Conditional Logger Utility
 *
 * Provides logging that only outputs in development mode.
 * In production builds, console statements are no-ops for performance.
 */

// Detect environment (production bundles set NODE_ENV via Vite)
const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Logger class with conditional output
 */
class Logger {
    private prefix: string;

    constructor(prefix: string = '[FactsManager]') {
        this.prefix = prefix;
    }

    /**
     * Log informational message (only in development)
     */
    log(...args: any[]): void {
        if (isDevelopment) {
            console.log(this.prefix, ...args);
        }
    }

    /**
     * Log warning message (only in development)
     */
    warn(...args: any[]): void {
        if (isDevelopment) {
            console.warn(this.prefix, ...args);
        }
    }

    /**
     * Log error message (always logged, even in production)
     */
    error(...args: any[]): void {
        // Errors are always logged for debugging in production
        console.error(this.prefix, ...args);
    }

    /**
     * Log debug message (only in development, low priority)
     */
    debug(...args: any[]): void {
        if (isDevelopment) {
            console.debug(this.prefix, ...args);
        }
    }
}

// Export singleton instances for different modules
export const factsLogger = new Logger('[FactsManager]');
export const factsControllerLogger = new Logger('[FactsController]');

// Export Logger class for custom instances
export { Logger };
