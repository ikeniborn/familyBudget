/**
 * Telegram Mini App (webapp) - Entry Point
 *
 * Phase 2.5: Foundation Complete
 *
 * CURRENT STATUS:
 * - storage.ts: TelegramStorage class ✅ MIGRATED
 * - Legacy .js files remain for gradual migration
 *
 * Module structure:
 * - storage.ts (205 lines) - Telegram CloudStorage wrapper
 * - auth.js (157 lines) - Authentication (legacy)
 * - api.js (216 lines) - API client (legacy)
 * - ui.js (222 lines) - UI utilities (legacy)
 * - validators.js (225 lines) - Form validation (legacy)
 * - theme.js (114 lines) - Theme management (legacy)
 * - app.js (165 lines) - Main app logic (legacy)
 *
 * Total: 1,373 lines legacy, 205 lines migrated
 *
 * Usage:
 * ```typescript
 * import { TelegramStorage } from '@webapp/index';
 * 
 * const storage = new TelegramStorage(window.Telegram.WebApp);
 * await storage.setItem('key', 'value');
 * ```
 */

// ============================================================================
// Storage Module (Phase 2.5: Complete)
// ============================================================================

export { default as TelegramStorage } from './storage';

// ============================================================================
// Future Modules (legacy .js files, to be migrated)
// ============================================================================

/*
// Authentication
export { Auth } from './auth';
export type { AuthOptions, AuthResult } from './auth';

// API Client
export { API } from './api';
export type { APIOptions, APIResponse } from './api';

// UI Utilities
export { UI } from './ui';
export type { UIOptions, ToastOptions } from './ui';

// Validators
export { Validators } from './validators';
export type { ValidationRule, ValidationResult } from './validators';

// Theme Management
export { Theme } from './theme';
export type { ThemeMode, ThemeOptions } from './theme';

// App Logic
export { App } from './app';
export type { AppOptions, AppConfig } from './app';
*/

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize Telegram Mini App
 *
 * Called automatically on DOM ready.
 */
async function initializeWebApp(): Promise<void> {
  console.log('[WebApp] Initializing Telegram Mini App...');

  try {
    // Phase 2.5: Only TelegramStorage module available
    console.log('[WebApp] TelegramStorage module loaded');

    // Legacy .js files loaded via <script> tags in HTML
    // TODO Phase 3.x: Migrate legacy files to TypeScript modules

    console.log('[WebApp] Webapp initialized (Phase 2.5 foundation)');
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
