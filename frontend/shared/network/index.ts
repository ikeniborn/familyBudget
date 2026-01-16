/**
 * Network Detection Module v3.0.0
 * Public API - IIFE Bundle
 *
 * Модульная TypeScript реализация SmartNetworkDetector с ZERO dependencies.
 * Собирается в IIFE формат для использования через window.NetworkModule
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

// TypeScript marker (required for .ts files in IIFE format)
export {};

// ============================================================================
// Imports
// ============================================================================

// Core State
import {
  createInitialState,
  getState,
  updateState,
  resetState,
  loadOfflineState,
  saveOfflineState
} from './core/NetworkState';

// Lifecycle
import {
  init,
  destroy,
  dispatchRestoredState
} from './core/lifecycle';

// Detection Engine
import {
  setStatus,
  checkConnectivity,
  handleOnline,
  handleOffline
} from './core/detectionEngine';

// Heartbeat
import {
  startHeartbeat,
  stopHeartbeat,
  getNextCheckDelay,
  scheduleNextHeartbeat,
  startAutoRecoveryCheck,
  stopAutoRecoveryCheck
} from './features/heartbeat';

// Connection Quality
import {
  hasNetworkInformation,
  getConnectionInfo,
  getAdaptiveTimeout,
  handleConnectionChange
} from './features/connectionQuality';

// Error Tracking
import {
  onRequestSuccess,
  onRequestFailure
} from './features/errorTracking';

// Auto-Offline Mode
import {
  enableAutoOfflineMode,
  disableAutoOfflineMode,
  isOfflineModeEnabled
} from './features/autoOffline';

// Utilities
import { _networkLog, _networkWarn } from './utils/logger';

// Window Adapter (100% backward compatibility)
import { SmartNetworkDetector } from './adapters/windowExports';

// Types
import type {
  NetworkStatus,
  ConnectionInfo,
  DetailedStatus
} from './types';

// ============================================================================
// IIFE Wrapper
// ============================================================================

(function(window) {
  'use strict';

  // Convenience utilities (defined here to avoid circular dependencies)

  const getStatus = (): NetworkStatus => {
    return getState().status;
  };

  const isOnline = (): boolean => {
    return getState().status === 'online';
  };

  const isFullyOnline = (): boolean => {
    const state = getState();
    return state.status === 'online' && !state.autoOfflineMode;
  };

  const getDetailedStatus = (): DetailedStatus => {
    const state = getState();
    const connectionInfo: ConnectionInfo | null = getConnectionInfo();

    return {
      status: state.status,
      isOnline: state.status === 'online',
      autoOfflineMode: state.autoOfflineMode,
      consecutiveFailures: state.consecutiveFailures,
      lastCheck: state.lastCheck,
      lastHeartbeat: state.lastHeartbeat,
      connectionInfo
    };
  };

  // ==========================================================================
  // Export to window global (100% backward compatibility)
  // ==========================================================================

  // Primary API: SmartNetworkDetector class (v2.0.0 compatible)
  (window as any).SmartNetworkDetector = SmartNetworkDetector;

  // Secondary API: NetworkModule namespace (modular access)
  (window as any).NetworkModule = {
    // Lifecycle
    init,
    destroy,
    dispatchRestoredState,

    // Detection
    setStatus,
    checkConnectivity,
    handleOnline,
    handleOffline,

    // State Management
    getState,
    updateState,
    resetState,
    createInitialState,
    loadOfflineState,
    saveOfflineState,

    // Heartbeat
    startHeartbeat,
    stopHeartbeat,
    getNextCheckDelay,
    scheduleNextHeartbeat,
    startAutoRecoveryCheck,
    stopAutoRecoveryCheck,

    // Connection Quality
    hasNetworkInformation,
    getConnectionInfo,
    getAdaptiveTimeout,
    handleConnectionChange,

    // Error Tracking
    onRequestSuccess,
    onRequestFailure,

    // Auto-Offline
    enableAutoOfflineMode,
    disableAutoOfflineMode,
    isOfflineModeEnabled,

    // Utilities
    getStatus,
    isOnline,
    isFullyOnline,
    getDetailedStatus,
    _networkLog,
    _networkWarn
  };

})(window);
