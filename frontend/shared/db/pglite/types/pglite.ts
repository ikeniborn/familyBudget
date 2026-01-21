/**
 * Type definitions for PGlite query results
 * Provides type-safe wrappers for database queries
 */

/**
 * Generic PGlite query result
 */
export interface PGliteResult<T = unknown> {
  rows: T[];
  rowCount: number;
  affectedRows?: number;
}

/**
 * PGlite transaction interface
 */
export interface PGliteTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<PGliteResult<T>>;
  exec(sql: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Helper type for extracting row type from query result
 */
export type RowType<T> = T extends PGliteResult<infer R> ? R : never;

// =============================================================================
// Diagnostic Query Result Types
// =============================================================================

/**
 * Result of COUNT(*) queries
 * Used in getDiagnosticData() for table statistics
 */
export interface CountResult {
  count: number;
}

/**
 * Result of pg_database_size() query
 * Used in getDiagnosticData() for database size calculation
 */
export interface SizeResult {
  size_bytes: number;
}
