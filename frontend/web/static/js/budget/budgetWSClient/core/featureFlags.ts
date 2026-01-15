/**
 * Feature Flags for budgetWSClient Migration
 *
 * Enables gradual rollout of TypeScript implementation
 * with A/B testing capability.
 *
 * Phase 1.6: Feature Flags System
 */

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

export {}; // Force module scope

/**
 * Feature flags for gradual migration phases
 */
export interface WSFeatureFlags {
  useNewConnection: boolean;      // Phase 1: Core Connection Manager
  useNewEventHandlers: boolean;   // Phase 2: Event Handlers
  useNewHealthCheck: boolean;     // Phase 3: Health Check & RTT
  useNewMultiTab: boolean;        // Phase 4: Multi-Tab Synchronization
  useNewMobile: boolean;          // Phase 5: Mobile Handling
  useNewFallback: boolean;        // Phase 6: Long Polling Fallback
  useNewStatus: boolean;          // Phase 7: Status Indicator
}

/**
 * Get feature flags from localStorage
 * @returns Current feature flags state
 */
export function getFeatureFlags(): WSFeatureFlags {
  return {
    useNewConnection: localStorage.getItem('ws_new_connection') === 'true',
    useNewEventHandlers: localStorage.getItem('ws_new_handlers') === 'true',
    useNewHealthCheck: localStorage.getItem('ws_new_health') === 'true',
    useNewMultiTab: localStorage.getItem('ws_new_multitab') === 'true',
    useNewMobile: localStorage.getItem('ws_new_mobile') === 'true',
    useNewFallback: localStorage.getItem('ws_new_fallback') === 'true',
    useNewStatus: localStorage.getItem('ws_new_status') === 'true',
  };
}

/**
 * Enable a specific feature flag
 * @param feature - Feature flag to enable
 */
export function enableFeature(feature: keyof WSFeatureFlags): void {
  const key = featureFlagToStorageKey(feature);
  localStorage.setItem(key, 'true');
  debugLog(`[FeatureFlags] Enabled: ${feature} (${key})`);
}

/**
 * Disable a specific feature flag
 * @param feature - Feature flag to disable
 */
export function disableFeature(feature: keyof WSFeatureFlags): void {
  const key = featureFlagToStorageKey(feature);
  localStorage.removeItem(key);
  debugLog(`[FeatureFlags] Disabled: ${feature} (${key})`);
}

/**
 * A/B testing: Enable feature for percentage of users
 * Uses deterministic hashing to ensure consistency per user
 *
 * @param feature - Feature flag to enable
 * @param percentage - Percentage of users (0-100)
 */
export function enableForPercentage(feature: keyof WSFeatureFlags, percentage: number): void {
  if (percentage < 0 || percentage > 100) {
    throw new Error(`Invalid percentage: ${percentage}. Must be 0-100.`);
  }

  const userId = getUserId();
  const hash = hashCode(userId + feature); // Hash user+feature for consistent bucketing
  const bucket = Math.abs(hash) % 100;

  if (bucket < percentage) {
    enableFeature(feature);
    debugLog(`[FeatureFlags] A/B Test: User ${userId} in ${percentage}% bucket for ${feature}`);
  } else {
    disableFeature(feature);
    debugLog(`[FeatureFlags] A/B Test: User ${userId} NOT in ${percentage}% bucket for ${feature}`);
  }
}

/**
 * Get all feature flags status
 * @returns Object with all flags and their states
 */
export function getFeatureFlagsStatus(): {
  flags: WSFeatureFlags;
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
  const features: Array<keyof WSFeatureFlags> = [
    'useNewConnection',
    'useNewEventHandlers',
    'useNewHealthCheck',
    'useNewMultiTab',
    'useNewMobile',
    'useNewFallback',
    'useNewStatus',
  ];

  features.forEach(feature => disableFeature(feature));
  debugLog('[FeatureFlags] All features reset to disabled');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert feature flag enum to localStorage key
 * Example: "useNewConnection" → "ws_new_connection"
 */
function featureFlagToStorageKey(feature: keyof WSFeatureFlags): string {
  // Mapping from feature flag to localStorage key
  const keyMap: Record<keyof WSFeatureFlags, string> = {
    useNewConnection: 'ws_new_connection',
    useNewEventHandlers: 'ws_new_handlers',
    useNewHealthCheck: 'ws_new_health',
    useNewMultiTab: 'ws_new_multitab',
    useNewMobile: 'ws_new_mobile',
    useNewFallback: 'ws_new_fallback',
    useNewStatus: 'ws_new_status',
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
 * Generate anonymous user ID using cryptographically secure random numbers
 */
function generateAnonymousId(): string {
  const timestamp = Date.now().toString(36);

  // Use crypto.getRandomValues() for cryptographically secure random generation
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // Convert to base36 string (similar to Math.random().toString(36))
  const randomPart = Array.from(randomBytes)
    .map(byte => byte.toString(36))
    .join('')
    .substring(0, 13);

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
  (window as any).wsFeatureFlags = {
    get: getFeatureFlags,
    getStatus: getFeatureFlagsStatus,
    enable: enableFeature,
    disable: disableFeature,
    enableForPercentage,
    resetAll: resetAllFeatures,
  };

  debugLog('[FeatureFlags] Debugging interface available at window.wsFeatureFlags');
}
