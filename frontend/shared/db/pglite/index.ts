/**
 * PGlite Integration Module
 * Barrel export for public API
 */

// Main Manager
export { PGliteManager, getPGliteManager } from './PGliteManager';

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
