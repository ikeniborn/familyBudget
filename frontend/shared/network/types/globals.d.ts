/**
 * Global Type Definitions
 * TypeScript declarations for window globals
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

import type { SmartNetworkDetector } from '../adapters/windowExports';
import type { NetworkStatus, ConnectionInfo, DetailedStatus } from './index';

declare global {
  interface Window {
    /**
     * SmartNetworkDetector class (v2.0.0 compatible)
     * Usage: const detector = new window.SmartNetworkDetector(options);
     */
    SmartNetworkDetector: typeof SmartNetworkDetector;

    /**
     * NetworkModule namespace (modular access)
     * Usage: window.NetworkModule.init();
     */
    NetworkModule: {
      // Lifecycle
      init: () => void;
      destroy: () => void;
      dispatchRestoredState: () => void;

      // Detection
      setStatus: (newStatus: NetworkStatus, options?: any) => NetworkStatus;
      checkConnectivity: (force?: boolean) => Promise<NetworkStatus>;
      handleOnline: () => Promise<void>;
      handleOffline: () => void;

      // State Management
      getState: () => any;
      updateState: (updates: any) => void;
      resetState: (options?: any) => void;
      createInitialState: (options?: any) => any;
      loadOfflineState: () => void;
      saveOfflineState: () => void;

      // Heartbeat
      startHeartbeat: () => void;
      stopHeartbeat: () => void;
      getNextCheckDelay: () => number;
      scheduleNextHeartbeat: () => void;
      startAutoRecoveryCheck: () => void;
      stopAutoRecoveryCheck: () => void;

      // Connection Quality
      hasNetworkInformation: () => boolean;
      getConnectionInfo: () => ConnectionInfo | null;
      getAdaptiveTimeout: () => number;
      handleConnectionChange: () => Promise<void>;

      // Error Tracking
      onRequestSuccess: () => void;
      onRequestFailure: () => void;

      // Auto-Offline
      enableAutoOfflineMode: () => void;
      disableAutoOfflineMode: () => Promise<void>;
      isOfflineModeEnabled: () => boolean;

      // Utilities
      getStatus: () => NetworkStatus;
      isOnline: () => boolean;
      isFullyOnline: () => boolean;
      getDetailedStatus: () => DetailedStatus;
      _networkLog: (...args: any[]) => void;
      _networkWarn: (...args: any[]) => void;
    };

    /**
     * Debug mode flag (set in HTML templates)
     */
    DEBUG_MODE?: boolean;
  }

  /**
   * Navigator extensions for Network Information API
   * Supported browsers: Chrome, Edge, Yandex Browser
   * NOT supported: Safari, Firefox
   */
  interface Navigator {
    connection?: {
      effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
      downlink: number;
      rtt: number;
      saveData: boolean;
      addEventListener(type: 'change', listener: () => void): void;
      removeEventListener(type: 'change', listener: () => void): void;
    };
  }
}

export {};
