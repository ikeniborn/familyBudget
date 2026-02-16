/**
 * Debug Utilities for Testing Shopping List Deletion
 *
 * Provides tools for manual and automated testing of deletion synchronization.
 * Use these utilities in browser console for debugging.
 *
 * Usage:
 *   window.shoppingListDebug.enableSlowNetwork(2000)  // 2s delay
 *   window.shoppingListDebug.disableDexie()
 *   window.shoppingListDebug.simulateLoadError()
 *   window.shoppingListDebug.inspectDexieCache(listId)
 */

declare const window: Window & {
  dexieManager?: any;
  shoppingListDebug?: any;
};

interface DebugConfig {
  networkDelay: number;
  dexieDisabled: boolean;
  simulateLoadError: boolean;
  verboseLogging: boolean;
}

const debugConfig: DebugConfig = {
  networkDelay: 0,
  dexieDisabled: false,
  simulateLoadError: false,
  verboseLogging: false
};

/**
 * Enable slow network simulation for race condition testing
 * @param delayMs - Delay in milliseconds (e.g., 2000 for 2 seconds)
 */
export function enableSlowNetwork(delayMs: number = 2000): void {
  debugConfig.networkDelay = delayMs;
  console.log(`[ShoppingListDebug] ✅ Slow network enabled: ${delayMs}ms delay`);
}

/**
 * Disable slow network simulation
 */
export function disableSlowNetwork(): void {
  debugConfig.networkDelay = 0;
  console.log('[ShoppingListDebug] ✅ Slow network disabled');
}

/**
 * Get current network delay setting
 */
export function getNetworkDelay(): number {
  return debugConfig.networkDelay;
}

/**
 * Temporarily disable Dexie for error resilience testing
 */
export function disableDexie(): void {
  debugConfig.dexieDisabled = true;
  console.log('[ShoppingListDebug] ✅ Dexie disabled for testing');
  console.log('[ShoppingListDebug] ℹ️  Deletion should still work without cache invalidation');
}

/**
 * Re-enable Dexie after testing
 */
export function enableDexie(): void {
  debugConfig.dexieDisabled = false;
  console.log('[ShoppingListDebug] ✅ Dexie re-enabled');
}

/**
 * Check if Dexie is disabled for testing
 */
export function isDexieDisabledForTesting(): boolean {
  return debugConfig.dexieDisabled;
}

/**
 * Simulate loadShoppingLists() error for async error testing
 */
export function simulateLoadError(): void {
  debugConfig.simulateLoadError = true;
  console.log('[ShoppingListDebug] ✅ Load error simulation enabled');
  console.log('[ShoppingListDebug] ℹ️  Next renderLandingView() will fail, should fallback to renderShoppingListCards()');
}

/**
 * Disable load error simulation
 */
export function disableLoadError(): void {
  debugConfig.simulateLoadError = false;
  console.log('[ShoppingListDebug] ✅ Load error simulation disabled');
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
  console.log('[ShoppingListDebug] ✅ Verbose logging enabled');
}

/**
 * Disable verbose logging
 */
export function disableVerboseLogging(): void {
  debugConfig.verboseLogging = false;
  console.log('[ShoppingListDebug] ✅ Verbose logging disabled');
}

/**
 * Check if verbose logging is enabled
 */
export function isVerboseLoggingEnabled(): boolean {
  return debugConfig.verboseLogging;
}

/**
 * Inspect Dexie cache for a specific shopping list
 * @param listId - Shopping list ID to inspect
 */
export async function inspectDexieCache(listId: number): Promise<void> {
  console.log(`[ShoppingListDebug] Inspecting Dexie cache for list ID: ${listId}`);

  try {
    const dexieManager = window.dexieManager;
    if (!dexieManager) {
      console.log('[ShoppingListDebug] ❌ Dexie manager not available');
      return;
    }

    const db = await dexieManager.db;
    if (!db) {
      console.log('[ShoppingListDebug] ❌ Dexie database not available');
      return;
    }

    const lists = await db.shoppingLists.where('id').equals(listId).toArray();

    if (lists.length === 0) {
      console.log(`[ShoppingListDebug] ℹ️  List ${listId} NOT found in Dexie cache`);
    } else {
      console.log(`[ShoppingListDebug] ✅ List ${listId} found in Dexie cache:`);
      console.table(lists.map((list: any) => ({
        id: list.id,
        temp_id: list.temp_id,
        name: list.name,
        is_active: list.is_active,
        sync_status: list.sync_status,
        synced_at: list.synced_at
      })));
    }
  } catch (error) {
    console.error('[ShoppingListDebug] ❌ Error inspecting Dexie cache:', error);
  }
}

/**
 * Get all shopping lists from Dexie cache
 */
export async function getAllDexieLists(): Promise<void> {
  console.log('[ShoppingListDebug] Fetching all lists from Dexie cache...');

  try {
    const dexieManager = window.dexieManager;
    if (!dexieManager) {
      console.log('[ShoppingListDebug] ❌ Dexie manager not available');
      return;
    }

    const db = await dexieManager.db;
    if (!db) {
      console.log('[ShoppingListDebug] ❌ Dexie database not available');
      return;
    }

    const lists = await db.shoppingLists.toArray();
    console.log(`[ShoppingListDebug] ✅ Found ${lists.length} lists in Dexie cache:`);
    console.table(lists.map((list: any) => ({
      id: list.id,
      temp_id: list.temp_id,
      name: list.name,
      is_active: list.is_active,
      sync_status: list.sync_status
    })));
  } catch (error) {
    console.error('[ShoppingListDebug] ❌ Error fetching Dexie lists:', error);
  }
}

/**
 * Reset all debug settings to defaults
 */
export function resetDebugConfig(): void {
  debugConfig.networkDelay = 0;
  debugConfig.dexieDisabled = false;
  debugConfig.simulateLoadError = false;
  debugConfig.verboseLogging = false;
  console.log('[ShoppingListDebug] ✅ All debug settings reset to defaults');
}

/**
 * Show current debug configuration
 */
export function showDebugConfig(): void {
  console.log('[ShoppingListDebug] Current configuration:');
  console.table({
    'Network Delay': `${debugConfig.networkDelay}ms`,
    'Dexie Disabled': debugConfig.dexieDisabled ? 'Yes' : 'No',
    'Simulate Load Error': debugConfig.simulateLoadError ? 'Yes' : 'No',
    'Verbose Logging': debugConfig.verboseLogging ? 'Yes' : 'No'
  });
}

/**
 * Show help message with available commands
 */
export function help(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║       Shopping List Deletion - Debug Utilities                ║
╚════════════════════════════════════════════════════════════════╝

Available commands:

📊 Configuration:
  showDebugConfig()          - Show current debug settings
  resetDebugConfig()         - Reset all settings to defaults

🐌 Race Condition Testing (Slow Network):
  enableSlowNetwork(2000)    - Add 2s delay to DELETE requests
  disableSlowNetwork()       - Remove network delay
  getNetworkDelay()          - Check current delay

🔧 Error Resilience Testing (Dexie):
  disableDexie()             - Disable Dexie cache temporarily
  enableDexie()              - Re-enable Dexie cache
  isDexieDisabledForTesting() - Check Dexie status

❌ Async Error Testing (Load Errors):
  simulateLoadError()        - Force loadShoppingLists() to fail
  disableLoadError()         - Disable error simulation
  shouldSimulateLoadError()  - Check error simulation status

🔍 Cache Inspection:
  inspectDexieCache(123)     - Inspect specific list in cache
  getAllDexieLists()         - Show all lists in Dexie cache

📝 Logging:
  enableVerboseLogging()     - Enable detailed debug logs
  disableVerboseLogging()    - Disable verbose logs

💡 Example Test Scenarios:

1. Race Condition Test:
   enableSlowNetwork(3000)
   // Delete a list in UI
   // Check: inspectDexieCache(listId) should show deleted

2. Error Resilience Test:
   disableDexie()
   // Delete a list in UI
   // Check: UI updates, console shows warning

3. Cross-Tab Sync Test:
   // Open 2 tabs on /lists
   // Delete in Tab 1, watch Tab 2 update

4. Async Error Test:
   simulateLoadError()
   // Delete a list that was active
   // Check: Should fallback to card view
  `);
}

// Export all utilities
export const shoppingListDebug = {
  enableSlowNetwork,
  disableSlowNetwork,
  getNetworkDelay,
  disableDexie,
  enableDexie,
  isDexieDisabledForTesting,
  simulateLoadError,
  disableLoadError,
  shouldSimulateLoadError,
  enableVerboseLogging,
  disableVerboseLogging,
  isVerboseLoggingEnabled,
  inspectDexieCache,
  getAllDexieLists,
  resetDebugConfig,
  showDebugConfig,
  help
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).shoppingListDebug = shoppingListDebug;
  console.log('[ShoppingListDebug] ✅ Debug utilities loaded. Type "window.shoppingListDebug.help()" for usage.');
}
