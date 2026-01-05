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

// Phase 2.3: budgetWSClient (foundation complete)
import * as budgetWSClient from './budget/budgetWSClient/index';

// Phase 2.4: csvImporter (foundation complete)
import * as csvImporter from './lists/csvImporter/index';

// Phase 2.4: offlineManager (foundation complete)
import * as offlineManager from './offline/offlineManager/index';

// ============================================================================
// Shared Utilities
// ============================================================================

// budgetShared is bundled separately (budgetShared.bundle.js)
// import * as BudgetShared from '@shared/budgetShared';

// ============================================================================
// Logger
// ============================================================================

// TODO: Import Logger when available
// import Logger from './utils/logger';

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize application
 *
 * Called automatically on DOM ready.
 */
async function initializeApp(): Promise<void> {
  console.log('[APP] Initializing Family Budget application...');

  try {
    // Phase 2.2: Initialize lists manager (foundation)
    console.log('[APP] listsManager module loaded');
    console.log('[APP] listsManager state functions available:', {
      getState: typeof listsManager.getState,
      updateState: typeof listsManager.updateState,
      resetState: typeof listsManager.resetState
    });

    // Phase 2.3: Initialize budgetWSClient (foundation)
    console.log('[APP] budgetWSClient module loaded');
    console.log('[APP] budgetWSClient state functions available:', {
      getState: typeof budgetWSClient.getState,
      updateState: typeof budgetWSClient.updateState,
      resetState: typeof budgetWSClient.resetState
    });

    // Phase 2.4: Initialize csvImporter (foundation)
    console.log('[APP] csvImporter module loaded');
    console.log('[APP] csvImporter state functions available:', {
      getState: typeof csvImporter.getState,
      updateState: typeof csvImporter.updateState,
      resetState: typeof csvImporter.resetState
    });

    // Phase 2.4: Initialize offlineManager (foundation)
    console.log('[APP] offlineManager module loaded');
    console.log('[APP] offlineManager state functions available:', {
      getState: typeof offlineManager.getState,
      updateState: typeof offlineManager.updateState,
      resetState: typeof offlineManager.resetState
    });

    // TODO Phase 2.3+: Initialize WebSocket connection
    // const wsClient = new BudgetWSClient(getWebSocketURL());
    // await wsClient.connect();

    // TODO Phase 2.4: Initialize offline manager
    // const offlineManager = new OfflineManager();
    // await offlineManager.initialize();

    // TODO Phase 2.2: Complete listsManager initialization
    // await listsManager.initializeListsManager();

    // TODO Phase 2.6: Remove after full migration (backward compatibility)
    // For now, expose on window for legacy code
    (window as any).listsManager = listsManager;
    (window as any).budgetWSClient = budgetWSClient;
    (window as any).csvImporter = csvImporter;
    (window as any).offlineManager = offlineManager;

    console.log('[APP] Application initialized successfully (Phase 2.1-2.4 complete)');
  } catch (error) {
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
} else {
  // DOM already loaded
  initializeApp();
}

// ============================================================================
// Exports (for external access)
// ============================================================================

export {
  listsManager,
  budgetWSClient,
  csvImporter,
  offlineManager
};
