/**
 * PGlite Integration Module v1.3.0
 * Public API - Hybrid Bundle (Named + Default Exports)
 *
 * Offline-first local database powered by @electric-sql/pglite
 * Собирается в IIFE формат для использования через window.PGlite
 *
 * @version 1.3.0
 * @date 2026-01-23
 */

// ============================================================================
// Named Exports (for ES Module consumers: other TypeScript files)
// ============================================================================

// Main Manager
export { PGliteManager, getPGliteManager } from './PGliteManager';
export type { DiagnosticData } from './PGliteManager';

// Core
export * from './core/PGliteState';
export * from './core/stateManager';
export * from './core/dbInitializer';
export * from './core/migrationManager';

// Operations
export * from './operations/schemaOperations';
export * from './operations/bulkOperations';

// Features
export * from './features/featureFlags';

// Utils
export { logger, configureLogger } from './utils/logger';

// Types
export type * from './types/dependencies';
export type * from './types/models';
export type * from './types/errors';
export type * from './types/pglite';

// ============================================================================
// Default Export (for IIFE consumers: window.PGlite)
// ============================================================================

import { PGliteManager as PGliteManagerClass, getPGliteManager as getPGliteManagerFn } from './PGliteManager';
import * as CoreState from './core/PGliteState';
import * as StateManager from './core/stateManager';
import * as DbInitializer from './core/dbInitializer';
import * as MigrationManager from './core/migrationManager';
import * as SchemaOperations from './operations/schemaOperations';
import * as BulkOperations from './operations/bulkOperations';
import * as FeatureFlags from './features/featureFlags';
import { logger as loggerInstance, configureLogger as configureLoggerFn } from './utils/logger';

const PGliteAPI = {
  // Main Manager
  PGliteManager: PGliteManagerClass,
  getPGliteManager: getPGliteManagerFn,

  // Core
  ...CoreState,
  ...StateManager,
  ...DbInitializer,
  ...MigrationManager,

  // Operations
  ...SchemaOperations,
  ...BulkOperations,

  // Features
  ...FeatureFlags,

  // Utils
  logger: loggerInstance,
  configureLogger: configureLoggerFn
};

export default PGliteAPI;

// Expose to window global for IIFE bundle
if (typeof window !== 'undefined') {
  (window as any).PGlite = PGliteAPI;
}
