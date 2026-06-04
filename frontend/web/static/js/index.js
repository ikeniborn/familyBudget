/**
 * Main entry point for Family Budget web application
 *
 * Imports and initializes all modules in correct order.
 *
 * Phase 2: ES Modules Migration
 * - Replaces multiple <script> tags with single bundle
 * - Enables tree-shaking and dependency optimization
 * - Provides proper module isolation
 *
 * Build: npm run bundle
 * Watch: npm run watch
 */
// ============================================================================
// Core Utilities
// ============================================================================
// Phase 2.2: listsManager (foundation complete)
import * as listsManager from './lists/listsManager/index';
// Phase 2.4: csvImporter (foundation complete)
import * as csvImporter from './lists/csvImporter/index';
// ============================================================================
// Application Initialization
// ============================================================================
/**
 * Initialize application
 *
 * Called automatically on DOM ready.
 */
async function initializeApp() {
    debugLog('[APP] Initializing Family Budget application...');
    try {
        // Phase 2.2: Initialize lists manager (foundation)
        debugLog('[APP] listsManager module loaded');
        debugLog('[APP] listsManager state functions available:', {
            getState: typeof listsManager.getState,
            updateState: typeof listsManager.updateState,
            resetState: typeof listsManager.resetState
        });
        // Phase 2.4: Initialize csvImporter (foundation)
        debugLog('[APP] csvImporter module loaded');
        debugLog('[APP] csvImporter state functions available:', {
            getState: typeof csvImporter.getState,
            updateState: typeof csvImporter.updateState,
            resetState: typeof csvImporter.resetState
        });
        // Phase 2.3: Initialize WebSocket connection (v11.2.2)
        if (window.budgetWSClient && typeof window.budgetWSClient.connect === 'function') {
            debugLog('[APP] Initializing WebSocket connection');
            await window.budgetWSClient.connect();
            debugLog('[APP] WebSocket initialized:', {
                isConnected: window.budgetWSClient.isConnected,
                multiTabInitialized: window.budgetWSClient._multiTabInitialized
            });
        } else {
            console.warn('[APP] budgetWSClient not available');
        }
        // TODO Phase 2.2: Complete listsManager initialization
        // await listsManager.initializeListsManager();
        // TODO Phase 2.6: Remove after full migration (backward compatibility)
        // For now, expose on window for legacy code
        window.listsManager = listsManager;
        window.csvImporter = csvImporter;
        // Note: budgetWSClient loaded separately via build-all.js
        debugLog('[APP] Application initialized successfully (Phase 2.1-2.4 complete)');
    }
    catch (error) {
        console.error('[APP] Application initialization failed', error);
        throw error;
    }
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Get WebSocket URL based on current protocol
 *
 * TODO Phase 2.3: Uncomment when budgetWSClient is available
 */
/*
function getWebSocketURL(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/budget`;
}
*/
// ============================================================================
// Auto-Initialize on DOM Ready
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
}
else {
    // DOM already loaded
    initializeApp();
}
// ============================================================================
// Exports (for external access)
// ============================================================================
export { listsManager, csvImporter };
//# sourceMappingURL=index.js.map