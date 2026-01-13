/**
 * State Manager for Offline Operations
 * High-level state operations and initialization
 *
 * This module provides state management functions that build on top of OfflineState.ts
 * It handles initialization, network status checks, and UI callbacks.
 */

import { getState, updateState, initializeState as initState } from './OfflineState';
import type { IIndexedDBManager, INetworkDetector, IWorkerWrapper, IBudgetWSClient } from '../types/dependencies';

/**
 * Initialize Offline Manager with dependencies
 * Call this ONCE during app initialization
 *
 * @param db - IndexedDB manager (required)
 * @param networkDetector - Network status detector (optional)
 * @param workerWrapper - Web Worker wrapper for heavy processing (optional)
 * @param wsClient - WebSocket client for real-time updates (optional)
 */
export async function initializeOfflineManager(
  db: IIndexedDBManager,
  networkDetector?: INetworkDetector,
  workerWrapper?: IWorkerWrapper,
  wsClient?: IBudgetWSClient
): Promise<void> {
  // Initialize state with dependencies
  initState(db, networkDetector, workerWrapper, wsClient);

  // Mark as initialized
  updateState({ isInitialized: true });
}

/**
 * Check if network is online
 * Uses SmartNetworkDetector if available, otherwise falls back to navigator.onLine
 *
 * @returns true if network is online
 */
export function isOnline(): boolean {
  const state = getState();

  if (state.networkDetector) {
    return state.networkDetector.isOnline();
  }

  // Fallback to browser's navigator.onLine
  return navigator.onLine;
}

/**
 * Get detailed network status
 *
 * @returns Network status object
 */
export function getNetworkStatus(): { online: boolean; auto: boolean } {
  const state = getState();

  if (state.networkDetector) {
    return state.networkDetector.getStatus();
  }

  // Fallback to simple online/offline
  return { online: navigator.onLine, auto: false };
}

/**
 * Set UI refresh callback
 * This callback is called when data changes (from WebSocket events)
 *
 * @param callback - Callback function (event, data) => void
 */
export function setRefreshUICallback(callback: (event: string, data: any) => void): void {
  updateState({ refreshUICallback: callback });
}

/**
 * Get UI refresh callback
 *
 * @returns Current UI refresh callback or null
 */
export function getRefreshUICallback(): ((event: string, data: any) => void) | null {
  const state = getState();
  return state.refreshUICallback;
}

/**
 * Check if OfflineManager is initialized
 *
 * @returns true if initialized
 */
export function isInitialized(): boolean {
  const state = getState();
  return state.isInitialized;
}

/**
 * Check if sync is in progress
 *
 * @returns true if sync is currently running
 */
export function isSyncInProgress(): boolean {
  const state = getState();
  return state.syncInProgress;
}
