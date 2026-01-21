/**
 * Feature flags for PGlite integration
 */

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
    factsWindow: parseInt(localStorage.getItem('pgliteFactsWindow') || '90', 10),
    autoSyncInterval: parseInt(localStorage.getItem('pgliteAutoSync') || '300000', 10)
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
  if ((window as any).showToast) {
    const message = enabled
      ? 'PGlite включен. Обновите страницу для инициализации offline режима.'
      : 'PGlite отключен. Обновите страницу для online-only режима.';

    (window as any).showToast(message, 'info', 10000); // 10 seconds
  }
}

/**
 * Set PGlite facts window (days)
 *
 * @param days - Number of days to sync (30, 90, 180, 365)
 */
export function setPGliteFactsWindow(days: number): void {
  if (days < 30 || days > 365) {
    throw new Error('Facts window must be between 30 and 365 days');
  }

  localStorage.setItem('pgliteFactsWindow', days.toString());

  // No reload needed, will apply on next sync
  if ((window as any).showToast) {
    (window as any).showToast(`Facts window обновлен до ${days} дней`, 'success');
  }
}

/**
 * Set PGlite auto-sync interval (milliseconds)
 *
 * @param intervalMs - Auto-sync interval in milliseconds
 */
export function setPGliteAutoSyncInterval(intervalMs: number): void {
  if (intervalMs < 60000) { // minimum 1 minute
    throw new Error('Auto-sync interval must be at least 60000ms (1 minute)');
  }

  localStorage.setItem('pgliteAutoSync', intervalMs.toString());

  if ((window as any).showToast) {
    const minutes = Math.round(intervalMs / 60000);
    (window as any).showToast(`Auto-sync интервал обновлен до ${minutes} минут`, 'success');
  }
}
