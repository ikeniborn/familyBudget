/**
 * PGlite Integration Module v1.3.0
 * Public API - Barrel export for public API
 *
 * Offline-first local database powered by @electric-sql/pglite
 * Собирается в IIFE формат для использования через window.PGlite
 *
 * @version 1.3.0
 * @date 2026-01-23
 */

// Main Manager
export { PGliteManager, getPGliteManager, __resetPGliteManager_TEST_ONLY__ } from './PGliteManager';
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
