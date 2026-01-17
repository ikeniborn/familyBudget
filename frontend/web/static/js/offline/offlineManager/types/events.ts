/**
 * Custom Event Types for OfflineManager
 * Type definitions for events dispatched during offline sync operations
 */

/**
 * Detail payload for 'offline-sync-complete' event
 * Dispatched when sync operation completes (manual or automatic)
 */
export interface OfflineSyncCompleteDetail {
  /** Number of successfully synced items */
  synced: number;
  /** Number of failed items */
  failed: number;
  /** Timestamp when sync completed (ms since epoch) */
  timestamp: number;
}

/**
 * Typed CustomEvent for offline-sync-complete
 */
export type OfflineSyncCompleteEvent = CustomEvent<OfflineSyncCompleteDetail>;

/**
 * Helper function to create typed offline-sync-complete event
 */
export function createOfflineSyncCompleteEvent(
  detail: OfflineSyncCompleteDetail
): OfflineSyncCompleteEvent {
  return new CustomEvent('offline-sync-complete', { detail });
}
