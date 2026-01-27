/**
 * Schema migration manager
 * Handles database schema versioning and upgrades
 */

import type { PGlite } from '@electric-sql/pglite';
import { PGliteError } from '../types/errors';
import { logger } from '../utils/logger';

// Import schema SQL files as strings
import v1ReferenceData from '../schemas/v1_referenceData.sql?raw';
import v2Transactional from '../schemas/v2_transactional.sql?raw';
import v3Shopping from '../schemas/v3_shopping.sql?raw';
import v4RecurringPlans from '../schemas/v4_recurringPlans.sql?raw';
import v5ExpandArticleTypes from '../schemas/v5_expandArticleTypes.sql?raw';

/**
 * Migration definition
 */
interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Available migrations (ordered by version)
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'Reference Data (Articles, Financial Centers, Cost Centers)',
    sql: v1ReferenceData
  },
  {
    version: 2,
    name: 'Transactional Data (Budget Facts, Pending Operations, Sync Conflicts)',
    sql: v2Transactional
  },
  {
    version: 3,
    name: 'Shopping Lists (Stores, Product Groups, Lists, Items)',
    sql: v3Shopping
  },
  {
    version: 4,
    name: 'Recurring Plans Optimization (Performance Indexes)',
    sql: v4RecurringPlans
  },
  {
    version: 5,
    name: 'Expand Article Types (Add debit/credit support)',
    sql: v5ExpandArticleTypes
  }
];

/**
 * Get current schema version
 *
 * @param db - PGlite instance
 * @returns Current schema version (0 if no migrations applied)
 */
export async function getSchemaVersion(db: PGlite): Promise<number> {
  try {
    const result = await db.query(`
      SELECT MAX(version) as version
      FROM local_schema_migrations
    `);

    const version = (result.rows[0] as { version: number } | undefined)?.version || 0;

    logger.debug('Current schema version', { version });

    return version;
  } catch (error) {
    // Table doesn't exist yet - return 0
    logger.debug('Schema migrations table not found, returning version 0');
    return 0;
  }
}

/**
 * Apply a single migration
 *
 * @param db - PGlite instance
 * @param migration - Migration to apply
 */
async function applyMigration(db: PGlite, migration: Migration): Promise<void> {
  logger.info(`Applying migration v${migration.version}: ${migration.name}`);

  try {
    // Execute migration SQL
    await db.exec(migration.sql);

    // Record migration in tracking table
    await db.query(`
      INSERT INTO local_schema_migrations (version, applied_at)
      VALUES ($1, NOW())
    `, [migration.version]);

    logger.info(`Migration v${migration.version} applied successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new PGliteError(
      `Failed to apply migration v${migration.version}: ${errorMessage}`,
      'MIGRATION_ERROR'
    );
  }
}

/**
 * Run all pending migrations
 *
 * @param db - PGlite instance
 * @returns Number of migrations applied
 */
export async function runMigrations(db: PGlite): Promise<number> {
  const currentVersion = await getSchemaVersion(db);

  logger.debug('Running migrations', {
    currentVersion,
    availableMigrations: MIGRATIONS.length
  });

  // Filter pending migrations
  const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    logger.debug('No pending migrations');
    return 0;
  }

  // Apply each migration in order
  for (const migration of pendingMigrations) {
    await applyMigration(db, migration);
  }

  logger.info(`Applied ${pendingMigrations.length} migration(s)`);

  return pendingMigrations.length;
}

/**
 * Check if schema is up to date
 *
 * @param db - PGlite instance
 * @returns True if schema is current
 */
export async function isSchemaUpToDate(db: PGlite): Promise<boolean> {
  const currentVersion = await getSchemaVersion(db);
  const latestVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version || 0;

  return currentVersion >= latestVersion;
}
