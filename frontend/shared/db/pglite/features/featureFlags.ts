/**
 * Feature flags for PGlite integration
 */

/// <reference path="../types/globals.d.ts" />

// =============================================================================
// Constants
// =============================================================================

/** Minimum facts window in days */
export const MIN_FACTS_WINDOW_DAYS = 30;

/** Maximum facts window in days */
export const MAX_FACTS_WINDOW_DAYS = 365;

/** Default facts window in days */
export const DEFAULT_FACTS_WINDOW_DAYS = 90;

/** Minimum auto-sync interval in milliseconds (1 minute) */
export const MIN_AUTO_SYNC_INTERVAL_MS = 60000;

/** Default auto-sync interval in milliseconds (5 minutes) */
export const DEFAULT_AUTO_SYNC_INTERVAL_MS = 300000;

/** Default toast notification duration in milliseconds */
export const DEFAULT_TOAST_DURATION_MS = 10000;

/** Maximum number of facts to return in a single query */
export const MAX_FACTS_QUERY_LIMIT = 1000;

/** Default maximum retry attempts for pending operations */
export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

// =============================================================================
// Types
// =============================================================================

export interface PGliteFeatureFlags {
  enabled: boolean;          // Main toggle for PGlite
  debug: boolean;            // Debug logging
  factsWindow: number;       // Data window in days (default: 90)
  autoSyncInterval: number;  // Auto-sync interval in ms (default: 300000 = 5 min)
}

/**
 * Get PGliteFeatureFlags from localStorage
 */
export function getPGliteFeatureFlags(): PGliteFeatureFlags {
  // eslint-disable-next-line no-undef
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return {
    enabled: localStorage.getItem('enablePGlite') === 'true',
    debug: isDevelopment && localStorage.getItem('pgliteDebug') !== 'false',
    factsWindow: parseInt(localStorage.getItem('pgliteFactsWindow') || DEFAULT_FACTS_WINDOW_DAYS.toString(), 10),
    autoSyncInterval: parseInt(localStorage.getItem('pgliteAutoSync') || DEFAULT_AUTO_SYNC_INTERVAL_MS.toString(), 10)
  };
}

/**
 * Check if PGlite is enabled
 */
export function isPGliteEnabled(): boolean {
  return localStorage.getItem('enablePGlite') === 'true';
}

/**
 * Set PGlite enabled state
 *
 * @param enabled - Enable or disable PGlite
 */
export function setPGliteEnabled(enabled: boolean): void {
  localStorage.setItem('enablePGlite', enabled ? 'true' : 'false');

  // Show notification via global showToast (from base.html)
  if (window.showToast) {
    const message = enabled
      ? 'PGlite включен. Обновите страницу для инициализации offline режима.'
      : 'PGlite отключен. Обновите страницу для online-only режима.';

    window.showToast(message, 'info');
  }
}

/**
 * Set PGlite facts window (days)
 *
 * @param days - Number of days to sync (MIN_FACTS_WINDOW_DAYS to MAX_FACTS_WINDOW_DAYS)
 */
export function setPGliteFactsWindow(days: number): void {
  if (days < MIN_FACTS_WINDOW_DAYS || days > MAX_FACTS_WINDOW_DAYS) {
    throw new Error(`Facts window must be between ${MIN_FACTS_WINDOW_DAYS} and ${MAX_FACTS_WINDOW_DAYS} days`);
  }

  localStorage.setItem('pgliteFactsWindow', days.toString());

  // No reload needed, will apply on next sync
  if (window.showToast) {
    window.showToast(`Facts window обновлен до ${days} дней`, 'success');
  }
}

/**
 * Set PGlite auto-sync interval (milliseconds)
 *
 * @param intervalMs - Auto-sync interval in milliseconds (minimum: MIN_AUTO_SYNC_INTERVAL_MS)
 */
export function setPGliteAutoSyncInterval(intervalMs: number): void {
  if (intervalMs < MIN_AUTO_SYNC_INTERVAL_MS) {
    throw new Error(`Auto-sync interval must be at least ${MIN_AUTO_SYNC_INTERVAL_MS}ms (1 minute)`);
  }

  localStorage.setItem('pgliteAutoSync', intervalMs.toString());

  if (window.showToast) {
    const minutes = Math.round(intervalMs / MIN_AUTO_SYNC_INTERVAL_MS);
    window.showToast(`Auto-sync интервал обновлен до ${minutes} минут`, 'success');
  }
}
