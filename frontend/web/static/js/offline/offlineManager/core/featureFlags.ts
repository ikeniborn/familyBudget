/**
 * Feature Flags for offlineManager Migration
 *
 * Enables gradual rollout of TypeScript implementation
 * with A/B testing capability.
 *
 * Based on budgetWSClient/core/featureFlags.ts pattern
 */

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

export {}; // Force module scope

/**
 * Feature flags for gradual migration phases
 */
export interface OfflineFeatureFlags {
  useNewCoreState: boolean;        // Phase 1: Core State (already implemented)
  useNewFactsOps: boolean;         // Phase 2: Facts Operations
  useNewTransfersOps: boolean;     // Phase 3: Transfers Operations
  useNewPlansOps: boolean;         // Phase 4: Plans Operations
  useNewSyncEngine: boolean;       // Phase 5: Sync Engine
  useNewNetworkState: boolean;     // Phase 6: Network State
  useNewWebSocket: boolean;        // Phase 7: WebSocket Integration
  useNewUI: boolean;               // Phase 8: Toast/UI System
}

/**
 * Get feature flags from localStorage
 * @returns Current feature flags state
 */
export function getFeatureFlags(): OfflineFeatureFlags {
  return {
    useNewCoreState: localStorage.getItem('offline_new_core') === 'true',
    useNewFactsOps: localStorage.getItem('offline_new_facts') === 'true',
    useNewTransfersOps: localStorage.getItem('offline_new_transfers') === 'true',
    useNewPlansOps: localStorage.getItem('offline_new_plans') === 'true',
    useNewSyncEngine: localStorage.getItem('offline_new_sync') === 'true',
    useNewNetworkState: localStorage.getItem('offline_new_network') === 'true',
    useNewWebSocket: localStorage.getItem('offline_new_websocket') === 'true',
    useNewUI: localStorage.getItem('offline_new_ui') === 'true',
  };
}

/**
 * Enable a specific feature flag
 * @param feature - Feature flag to enable
 */
export function enableFeature(feature: keyof OfflineFeatureFlags): void {
  const key = featureFlagToStorageKey(feature);
  localStorage.setItem(key, 'true');
  debugLog(`[OfflineFeatureFlags] Enabled: ${feature} (${key})`);
}

/**
 * Disable a specific feature flag
 * @param feature - Feature flag to disable
 */
export function disableFeature(feature: keyof OfflineFeatureFlags): void {
  const key = featureFlagToStorageKey(feature);
  localStorage.removeItem(key);
  debugLog(`[OfflineFeatureFlags] Disabled: ${feature} (${key})`);
}

/**
 * A/B testing: Enable feature for percentage of users
 * Uses deterministic hashing to ensure consistency per user
 *
 * @param feature - Feature flag to enable
 * @param percentage - Percentage of users (0-100)
 */
export function enableForPercentage(feature: keyof OfflineFeatureFlags, percentage: number): void {
  if (percentage < 0 || percentage > 100) {
    throw new Error(`Invalid percentage: ${percentage}. Must be 0-100.`);
  }

  const userId = getUserId();
  const hash = hashCode(userId + feature); // Hash user+feature for consistent bucketing
  const bucket = Math.abs(hash) % 100;

  if (bucket < percentage) {
    enableFeature(feature);
    debugLog(`[OfflineFeatureFlags] A/B Test: User ${userId} in ${percentage}% bucket for ${feature}`);
  } else {
    disableFeature(feature);
    debugLog(`[OfflineFeatureFlags] A/B Test: User ${userId} NOT in ${percentage}% bucket for ${feature}`);
  }
}

/**
 * Get all feature flags status
 * @returns Object with all flags and their states
 */
export function getFeatureFlagsStatus(): {
  flags: OfflineFeatureFlags;
  enabledCount: number;
  totalCount: number;
} {
  const flags = getFeatureFlags();
  const enabledCount = Object.values(flags).filter(Boolean).length;
  const totalCount = Object.keys(flags).length;

  return {
    flags,
    enabledCount,
    totalCount,
  };
}

/**
 * Reset all feature flags to default (disabled)
 */
export function resetAllFeatures(): void {
  const features: Array<keyof OfflineFeatureFlags> = [
    'useNewCoreState',
    'useNewFactsOps',
    'useNewTransfersOps',
    'useNewPlansOps',
    'useNewSyncEngine',
    'useNewNetworkState',
    'useNewWebSocket',
    'useNewUI',
  ];

  features.forEach(feature => disableFeature(feature));
  debugLog('[OfflineFeatureFlags] All features reset to disabled');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert feature flag enum to localStorage key
 * Example: "useNewFactsOps" → "offline_new_facts"
 */
function featureFlagToStorageKey(feature: keyof OfflineFeatureFlags): string {
  // Mapping from feature flag to localStorage key
  const keyMap: Record<keyof OfflineFeatureFlags, string> = {
    useNewCoreState: 'offline_new_core',
    useNewFactsOps: 'offline_new_facts',
    useNewTransfersOps: 'offline_new_transfers',
    useNewPlansOps: 'offline_new_plans',
    useNewSyncEngine: 'offline_new_sync',
    useNewNetworkState: 'offline_new_network',
    useNewWebSocket: 'offline_new_websocket',
    useNewUI: 'offline_new_ui',
  };

  return keyMap[feature];
}

/**
 * Get user ID from cookie or generate anonymous ID
 */
function getUserId(): string {
  // Try to get from cookie
  const userIdCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('user_id='));

  if (userIdCookie) {
    return userIdCookie.split('=')[1];
  }

  // Try to get from session storage
  const sessionUserId = sessionStorage.getItem('user_id');
  if (sessionUserId) {
    return sessionUserId;
  }

  // Generate anonymous ID (persistent per browser)
  let anonymousId = localStorage.getItem('anonymous_user_id');
  if (!anonymousId) {
    anonymousId = generateAnonymousId();
    localStorage.setItem('anonymous_user_id', anonymousId);
  }

  return anonymousId;
}

/**
 * Generate anonymous user ID
 */
function generateAnonymousId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `anon_${timestamp}_${randomPart}`;
}

/**
 * Simple hash code implementation for consistent bucketing
 * Based on Java String.hashCode()
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// ============================================================================
// Window Exports (for debugging in console)
// ============================================================================

if (typeof window !== 'undefined') {
  (window as any).offlineFeatureFlags = {
    get: getFeatureFlags,
    getStatus: getFeatureFlagsStatus,
    enable: enableFeature,
    disable: disableFeature,
    enableForPercentage,
    resetAll: resetAllFeatures,
  };

  debugLog('[OfflineFeatureFlags] Debugging interface available at window.offlineFeatureFlags');
}
