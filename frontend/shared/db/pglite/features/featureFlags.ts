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
