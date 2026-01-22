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

/** Default enable conflict resolution (task-009) */
export const DEFAULT_ENABLE_CONFLICT_RESOLUTION = true;

/** Minimum pruning retention in days (task-010) */
export const MIN_PRUNING_RETENTION_DAYS = 30;

/** Maximum pruning retention in days (task-010) */
export const MAX_PRUNING_RETENTION_DAYS = 365;

/** Default pruning retention in days (task-010) */
export const DEFAULT_PRUNING_RETENTION_DAYS = 90;

/** Default enable auto-pruning (task-010) */
export const DEFAULT_ENABLE_AUTO_PRUNING = false;

// =============================================================================
// Types
// =============================================================================

export interface PGliteFeatureFlags {
  enabled: boolean;                  // Main toggle for PGlite
  debug: boolean;                    // Debug logging
  factsWindow: number;               // Data window in days (default: 90)
  autoSyncInterval: number;          // Auto-sync interval in ms (default: 300000 = 5 min)
  enableConflictResolution: boolean; // Enable conflict resolution LWW (task-009, default: true)
  enableAutoPruning: boolean;        // Enable automatic data pruning (task-010, default: false)
  pruningRetentionDays: number;      // Pruning retention window in days (task-010, default: 90)
}

/**
 * Get PGliteFeatureFlags from localStorage
 */
export function getPGliteFeatureFlags(): PGliteFeatureFlags {
  // eslint-disable-next-line no-undef
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Get conflict resolution setting (default: enabled)
  const conflictResolutionSetting = localStorage.getItem('pgliteEnableConflictResolution');
  const enableConflictResolution = conflictResolutionSetting === null
    ? DEFAULT_ENABLE_CONFLICT_RESOLUTION
    : conflictResolutionSetting === 'true';

  // Get auto-pruning setting (default: disabled) (task-010)
  const enableAutoPruning = localStorage.getItem('pgliteEnableAutoPruning') === 'true';
  const pruningRetentionDays = parseInt(
    localStorage.getItem('pgliteRetentionDays') || DEFAULT_PRUNING_RETENTION_DAYS.toString(),
    10
  );

  return {
    enabled: localStorage.getItem('enablePGlite') === 'true',
    debug: isDevelopment && localStorage.getItem('pgliteDebug') !== 'false',
    factsWindow: parseInt(localStorage.getItem('pgliteFactsWindow') || DEFAULT_FACTS_WINDOW_DAYS.toString(), 10),
    autoSyncInterval: parseInt(localStorage.getItem('pgliteAutoSync') || DEFAULT_AUTO_SYNC_INTERVAL_MS.toString(), 10),
    enableConflictResolution,
    enableAutoPruning,
    pruningRetentionDays: Math.max(
      MIN_PRUNING_RETENTION_DAYS,
      Math.min(MAX_PRUNING_RETENTION_DAYS, pruningRetentionDays)
    )
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

/**
 * Set conflict resolution enabled state (task-009)
 *
 * @param enabled - Enable or disable conflict resolution
 */
export function setConflictResolutionEnabled(enabled: boolean): void {
  localStorage.setItem('pgliteEnableConflictResolution', enabled ? 'true' : 'false');

  if (window.showToast) {
    const message = enabled
      ? 'Conflict resolution включен. Конфликты будут разрешаться автоматически (LWW).'
      : 'Conflict resolution отключен. Конфликты будут игнорироваться.';

    window.showToast(message, 'info');
  }
}

/**
 * Set auto-pruning enabled state (task-010)
 *
 * @param enabled - Enable or disable automatic data pruning
 */
export function setPruningEnabled(enabled: boolean): void {
  localStorage.setItem('pgliteEnableAutoPruning', enabled ? 'true' : 'false');

  if (window.showToast) {
    const message = enabled
      ? 'Автоматическая очистка включена. Старые данные будут удаляться еженедельно.'
      : 'Автоматическая очистка отключена.';

    window.showToast(message, 'info');
  }
}

/**
 * Set pruning retention window (task-010)
 *
 * @param days - Number of days to retain synced data (MIN_PRUNING_RETENTION_DAYS to MAX_PRUNING_RETENTION_DAYS)
 * @throws Error if retention < factsWindow or out of range
 */
export function setPruningRetentionDays(days: number): void {
  const flags = getPGliteFeatureFlags();

  // Validation: retention >= factsWindow
  if (days < flags.factsWindow) {
    throw new Error(
      `Retention (${days}) must be >= Facts Window (${flags.factsWindow})`
    );
  }

  if (days < MIN_PRUNING_RETENTION_DAYS || days > MAX_PRUNING_RETENTION_DAYS) {
    throw new Error(
      `Retention must be between ${MIN_PRUNING_RETENTION_DAYS} and ${MAX_PRUNING_RETENTION_DAYS} days`
    );
  }

  localStorage.setItem('pgliteRetentionDays', days.toString());

  if (window.showToast) {
    window.showToast(`Окно хранения обновлено до ${days} дней`, 'success');
  }
}

/**
 * Get pruning retention start date (task-010)
 *
 * @returns ISO date string (YYYY-MM-DD) representing the start of the retention window
 */
export function getPruningRetentionStart(): string {
  const flags = getPGliteFeatureFlags();
  const date = new Date();
  date.setDate(date.getDate() - flags.pruningRetentionDays);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}
