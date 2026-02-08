/**
 * Global Window Namespace Type Definitions
 * Family Budget PWA
 *
 * This file defines what's available on the window object.
 * Actual class implementations provide their own types.
 *
 * @version 2.0.0
 * @date 2026-01-05
 */

/// <reference types="./models" />
/// <reference types="./indexeddb" />
/// <reference types="./api" />
/// <reference types="./telegram" />
/// <reference types="./navigator" />

/**
 * Logging Configuration
 */
interface LoggingConfig {
  enabled: boolean;
  modules: Record<string, boolean>;
  levels: {
    debug: boolean;
    info: boolean;
    warn: boolean;
    error: boolean;
  };
}

/**
 * Feature Flags
 */
interface FeatureFlags {
  WS_RTT_THRESHOLD_MS?: number;
  [key: string]: any;
}

/**
 * Logs Collector for admin logs page
 */
interface LogsCollector {
  captureLog(level: string, prefix: string, message: string, timestamp: string): void;
}

/**
 * CSV Import Progress
 */
interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
}

/**
 * Parsed CSV Row
 */
interface ParsedCSVRow {
  productName: string;
  quantity?: number;
  unit?: string;
  store?: string;
  productGroup?: string;
}

/**
 * Window interface extensions
 *
 * Note: Class types are inferred from their implementations.
 * Only the window properties are declared here.
 */
interface Window {
  // Configuration
  DEBUG_MODE?: boolean;
  LOGGING_CONFIG?: LoggingConfig;
  FEATURE_FLAGS?: FeatureFlags;

  // User Identity
  // Primary source (set in base.html)
  userData?: {
    id: number;
    username: string;
    isAdmin: boolean;
  };

  // Legacy (deprecated, for backward compatibility only)
  currentUser?: User;

  // Core Classes (types inferred from implementations)
  Logger: any;  // Will be typed by logger.ts
  IndexedDBManager?: any;
  OfflineManager?: any;
  SmartNetworkDetector?: any;
  ConflictResolver?: any;
  PushNotificationManager?: any;
  BudgetWSClient?: any;
  ListsManager?: any;
  CSVImporter?: any;
  WorkerWrapper?: any;
  DateFormatter?: any;

  // Logger Instances (types inferred from Logger class)
  logPWA: any;
  logSW: any;
  logDB: any;
  logSync: any;
  logAPI: any;
  logPerf: any;
  logForm: any;
  logWorker: any;
  logPlan: any;
  logCSV: any;
  logWSRTT: any;
  logWSState: any;
  logNav: any;
  logRTTFilter: any;
  logDuplicateSearch: any;
  logItemSave: any;
  logLists: any;
  logModalKB: any;

  // Utility functions
  debugLog?: (...args: any[]) => void;

  // BudgetShared bundle
  BudgetShared?: {
    DateFormatter: {
      formatForDisplay(isoDate: string): string;
      formatForAPI(displayDate: string): string | null;
      today(): string;
      isValidDisplayFormat(displayDate: string): boolean;
    };
    CalendarWidget: any;
    ChoicesCategoryTree: any;
  };

  // Optional dependencies
  budgetWSClient?: any;
  offlineManager?: any;
  budgetPushManager?: any;
  logsCollector?: LogsCollector;
  htmx?: any;

  // Telegram WebApp (for webapp/)
  Telegram?: {
    WebApp: TelegramWebApp;
  };

  // Utility functions
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

  // PGlite Indicator Manager
  pgliteIndicator?: {
    update: (state: 'active' | 'syncing' | 'error') => void;
    show: () => void;
    hide: () => void;
    onSyncStart: () => void;
    onSyncComplete: () => void;
    onSyncError: (error: Error) => void;
  };
}

/**
 * Utility: Make all properties optional recursively
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
