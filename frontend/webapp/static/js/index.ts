/**
 * Main entry point for Telegram Mini App (webapp)
 *
 * Phase 2.5: ES Modules Migration
 *
 * Current structure:
 * - storage.ts: TelegramStorage class (TypeScript module)
 * - auth.js, api.js, ui.js, etc.: Legacy JavaScript classes
 *
 * Future migration path:
 * 1. Convert .js files to .ts modules
 * 2. Add barrel exports for logical groupings
 * 3. Remove global window exposure
 *
 * For now, this entry point only exports the TypeScript module (storage).
 * Legacy .js files remain as separate script tags until full migration.
 */

// ============================================================================
// Storage (TypeScript module)
// ============================================================================

export { default as TelegramStorage } from './storage';

// ============================================================================
// Future exports (after .js → .ts migration)
// ============================================================================

/*
export { Auth } from './auth';
export { API } from './api';
export { UI } from './ui';
export { Validators } from './validators';
export { Theme } from './theme';
*/

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize webapp
 *
 * Called automatically on DOM ready.
 */
async function initializeWebApp(): Promise<void> {
  console.log('[WebApp] Initializing Telegram Mini App...');

  try {
    // Storage module is available
    console.log('[WebApp] TelegramStorage module loaded');

    // TODO: Initialize other modules after migration
    // const auth = new Auth();
    // await auth.validate();

    console.log('[WebApp] Webapp initialized successfully (Phase 2.5 foundation)');
  } catch (error) {
    console.error('[WebApp] Webapp initialization failed', error);
    throw error;
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWebApp);
} else {
  initializeWebApp();
}
