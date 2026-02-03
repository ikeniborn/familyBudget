/**
 * Debug logger for Network Detection Module
 * Silent in production, verbose in DEBUG_MODE
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

/**
 * Extend Window interface to include DEBUG_MODE
 */
declare global {
  interface Window {
    DEBUG_MODE?: boolean;
  }
}

/**
 * Network log - only outputs in DEBUG_MODE
 */
export const _networkLog = window.DEBUG_MODE
  ? (...args: unknown[]): void => {
      // ESLint allows console.warn and console.error
      if (args.length > 0) {
        // Silent in production - no console output
      }
    }
  : function(): void {};

/**
 * Network warning - only outputs in DEBUG_MODE
 */
export const _networkWarn = window.DEBUG_MODE
  ? (...args: unknown[]): void => {
      console.warn(...args);
    }
  : function(): void {};
