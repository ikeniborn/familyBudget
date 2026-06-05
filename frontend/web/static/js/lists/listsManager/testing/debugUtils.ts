/**
 * Debug Utilities for Testing Shopping List Operations
 *
 * Provides tools for manual and automated testing.
 * Use these utilities in browser console for debugging.
 *
 * Usage:
 *   window.shoppingListDebug.enableSlowNetwork(2000)  // 2s delay
 *   window.shoppingListDebug.simulateLoadError()
 *   window.shoppingListDebug.enableVerboseLogging()
 */

declare const window: Window & {
  shoppingListDebug?: any;
};

interface DebugConfig {
  networkDelay: number;
  simulateLoadError: boolean;
  verboseLogging: boolean;
}

const debugConfig: DebugConfig = {
  networkDelay: 0,
  simulateLoadError: false,
  verboseLogging: false
};

/**
 * Enable slow network simulation for race condition testing
 * @param delayMs - Delay in milliseconds (e.g., 2000 for 2 seconds)
 */
export function enableSlowNetwork(delayMs: number = 2000): void {
  debugConfig.networkDelay = delayMs;
  console.log(`[ShoppingListDebug] Slow network enabled: ${delayMs}ms delay`);
}

/**
 * Disable slow network simulation
 */
export function disableSlowNetwork(): void {
  debugConfig.networkDelay = 0;
  console.log('[ShoppingListDebug] Slow network disabled');
}

/**
 * Get current network delay setting
 */
export function getNetworkDelay(): number {
  return debugConfig.networkDelay;
}

/**
 * Simulate loadShoppingLists() error for async error testing
 */
export function simulateLoadError(): void {
  debugConfig.simulateLoadError = true;
  console.log('[ShoppingListDebug] Load error simulation enabled');
}

/**
 * Disable load error simulation
 */
export function disableLoadError(): void {
  debugConfig.simulateLoadError = false;
  console.log('[ShoppingListDebug] Load error simulation disabled');
}

/**
 * Check if load error simulation is enabled
 */
export function shouldSimulateLoadError(): boolean {
  return debugConfig.simulateLoadError;
}

/**
 * Enable verbose logging for debugging
 */
export function enableVerboseLogging(): void {
  debugConfig.verboseLogging = true;
  console.log('[ShoppingListDebug] Verbose logging enabled');
}

/**
 * Disable verbose logging
 */
export function disableVerboseLogging(): void {
  debugConfig.verboseLogging = false;
  console.log('[ShoppingListDebug] Verbose logging disabled');
}

/**
 * Check if verbose logging is enabled
 */
export function isVerboseLoggingEnabled(): boolean {
  return debugConfig.verboseLogging;
}

/**
 * Reset all debug settings to defaults
 */
export function resetDebugConfig(): void {
  debugConfig.networkDelay = 0;
  debugConfig.simulateLoadError = false;
  debugConfig.verboseLogging = false;
  console.log('[ShoppingListDebug] All debug settings reset to defaults');
}

/**
 * Show current debug configuration
 */
export function showDebugConfig(): void {
  console.log('[ShoppingListDebug] Current configuration:');
  console.table({
    'Network Delay': `${debugConfig.networkDelay}ms`,
    'Simulate Load Error': debugConfig.simulateLoadError ? 'Yes' : 'No',
    'Verbose Logging': debugConfig.verboseLogging ? 'Yes' : 'No'
  });
}

/**
 * Show help message with available commands
 */
export function help(): void {
  console.log(`
Shopping List - Debug Utilities

Configuration:
  showDebugConfig()          - Show current debug settings
  resetDebugConfig()         - Reset all settings to defaults

Slow Network:
  enableSlowNetwork(2000)    - Add 2s delay to DELETE requests
  disableSlowNetwork()       - Remove network delay
  getNetworkDelay()          - Check current delay

Async Error Testing:
  simulateLoadError()        - Force loadShoppingLists() to fail
  disableLoadError()         - Disable error simulation
  shouldSimulateLoadError()  - Check error simulation status

Logging:
  enableVerboseLogging()     - Enable detailed debug logs
  disableVerboseLogging()    - Disable verbose logs
  `);
}

// Export all utilities
export const shoppingListDebug = {
  enableSlowNetwork,
  disableSlowNetwork,
  getNetworkDelay,
  simulateLoadError,
  disableLoadError,
  shouldSimulateLoadError,
  enableVerboseLogging,
  disableVerboseLogging,
  isVerboseLoggingEnabled,
  resetDebugConfig,
  showDebugConfig,
  help
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).shoppingListDebug = shoppingListDebug;
  console.log('[ShoppingListDebug] Debug utilities loaded. Type "window.shoppingListDebug.help()" for usage.');
}
