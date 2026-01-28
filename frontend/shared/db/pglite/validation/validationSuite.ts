/**
 * Validation Suite for PGlite Readiness
 *
 * PHASE 4: Comprehensive validation before marking PGlite as "ready"
 *
 * Tests:
 * 1. Schema Version - Verify migrations ran successfully
 * 2. Reference Data - Check articles, FCs, CCs loaded
 * 3. Query Tests - Validate SELECT, JOIN, aggregations work
 * 4. Performance - Ensure queries meet performance targets
 *
 * Returns ValidationResults with detailed diagnostics.
 */

import type { ValidationResults } from '../core/PGliteState';
import type { PGliteManager } from '../PGliteManager';
import { logger } from '../utils/logger';

/**
 * Expected schema version (должен совпадать с последней миграцией)
 * Synced with migrationManager.ts (v7: Add Missing Financial Center Columns)
 */
const EXPECTED_SCHEMA_VERSION = 7;

/**
 * Performance thresholds (milliseconds)
 * Updated: More realistic thresholds for browser environment with IndexedDB
 */
const PERFORMANCE_THRESHOLDS = {
  avgQueryTimeMs: 100,  // Average query < 100ms (realistic for IndexedDB)
  maxQueryTimeMs: 200   // Max query < 200ms (was 100ms)
};

/**
 * Run comprehensive validation suite
 *
 * @param pglite - PGliteManager instance
 * @returns ValidationResults with detailed diagnostics
 */
export async function runValidationSuite(pglite: PGliteManager): Promise<ValidationResults> {
  const startTime = Date.now();
  const errors: string[] = [];

  logger.info('[VALIDATION] Starting validation suite...');

  // Test 1: Schema Version
  const schemaValid = await validateSchema(pglite, errors);

  // Test 2: Reference Data Loaded
  const referenceDataLoaded = await validateReferenceData(pglite, errors);

  // Test 3: Query Tests
  const queryTestsPassed = await validateQueries(pglite, errors);

  // Test 4: Performance Benchmarks
  const { performanceAcceptable, avgQueryTimeMs, maxQueryTimeMs } = await validatePerformance(pglite, errors);

  // Collect diagnostic details
  const details = await collectDiagnosticDetails(pglite, avgQueryTimeMs, maxQueryTimeMs);

  const allPassed = schemaValid && referenceDataLoaded && queryTestsPassed && performanceAcceptable;

  const results: ValidationResults = {
    allPassed,
    schemaValid,
    referenceDataLoaded,
    queryTestsPassed,
    performanceAcceptable,
    timestamp: new Date(),
    details,
    errors
  };

  logger.info('[VALIDATION] Suite completed', {
    allPassed,
    durationMs: Date.now() - startTime,
    errors
  });

  return results;
}

/**
 * Test 1: Validate schema version
 */
async function validateSchema(pglite: PGliteManager, errors: string[]): Promise<boolean> {
  try {
    const currentVersion = await pglite.getSchemaVersion();

    if (currentVersion !== EXPECTED_SCHEMA_VERSION) {
      errors.push(`Schema version mismatch: ${currentVersion} !== ${EXPECTED_SCHEMA_VERSION}`);
      return false;
    }

    logger.info('[VALIDATION] ✅ Schema version correct', { version: currentVersion });
    return true;
  } catch (error) {
    const errorMsg = `Schema validation failed: ${error}`;
    errors.push(errorMsg);
    logger.error('[VALIDATION] Schema validation error', error);
    return false;
  }
}

/**
 * Test 2: Validate reference data loaded
 */
async function validateReferenceData(pglite: PGliteManager, errors: string[]): Promise<boolean> {
  try {
    const db = pglite.getDatabase();
    if (!db) throw new Error('Database not initialized');

    // Query counts directly (no user_id filter needed for validation)
    const articlesCount = await db.query('SELECT COUNT(*) as count FROM local_articles');
    const financialCentersCount = await db.query('SELECT COUNT(*) as count FROM local_financial_centers');
    const costCentersCount = await db.query('SELECT COUNT(*) as count FROM local_cost_centers');

    const articles = parseInt((articlesCount.rows[0] as { count: string }).count);
    const financialCenters = parseInt((financialCentersCount.rows[0] as { count: string }).count);
    const costCenters = parseInt((costCentersCount.rows[0] as { count: string }).count);

    // Check minimum data loaded
    if (articles === 0) {
      errors.push('No articles loaded');
      return false;
    }

    if (financialCenters === 0) {
      errors.push('No financial centers loaded');
      return false;
    }

    if (costCenters === 0) {
      errors.push('No cost centers loaded');
      return false;
    }

    logger.info('[VALIDATION] ✅ Reference data loaded', {
      articles,
      financialCenters,
      costCenters
    });

    return true;
  } catch (error) {
    const errorMsg = `Reference data validation failed: ${error}`;
    errors.push(errorMsg);
    logger.error('[VALIDATION] Reference data error', error);
    return false;
  }
}

/**
 * Test 3: Validate query functionality
 */
async function validateQueries(pglite: PGliteManager, errors: string[]): Promise<boolean> {
  try {
    // Test 1: Simple SELECT
    const articles = await pglite.queryArticles();
    if (!articles || articles.length === 0) {
      errors.push('Simple SELECT failed');
      return false;
    }

    // Test 2: JOIN (hierarchy query)
    const hierarchy = await pglite.queryArticleHierarchy(articles[0].id);
    if (!hierarchy) {
      errors.push('Hierarchy JOIN query failed');
      return false;
    }

    // Test 3: Sync metadata query
    const syncMetadata = await pglite.getSyncMetadata('articles');
    if (!syncMetadata) {
      errors.push('Sync metadata query failed');
      return false;
    }

    logger.info('[VALIDATION] ✅ Query tests passed');
    return true;
  } catch (error) {
    const errorMsg = `Query tests failed: ${error}`;
    errors.push(errorMsg);
    logger.error('[VALIDATION] Query test error', error);
    return false;
  }
}

/**
 * Test 4: Validate performance
 */
async function validatePerformance(
  pglite: PGliteManager,
  errors: string[]
): Promise<{ performanceAcceptable: boolean; avgQueryTimeMs: number; maxQueryTimeMs: number }> {
  try {
    const iterations = 10;
    const queryTimes: number[] = [];

    // Run benchmark: 10 iterations of queryArticles
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await pglite.queryArticles();
      const duration = performance.now() - start;
      queryTimes.push(duration);
    }

    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / iterations;
    const maxQueryTime = Math.max(...queryTimes);

    // Check thresholds
    if (avgQueryTime > PERFORMANCE_THRESHOLDS.avgQueryTimeMs) {
      errors.push(`Average query time too slow: ${avgQueryTime.toFixed(2)}ms > ${PERFORMANCE_THRESHOLDS.avgQueryTimeMs}ms`);
      return { performanceAcceptable: false, avgQueryTimeMs: avgQueryTime, maxQueryTimeMs: maxQueryTime };
    }

    if (maxQueryTime > PERFORMANCE_THRESHOLDS.maxQueryTimeMs) {
      errors.push(`Max query time too slow: ${maxQueryTime.toFixed(2)}ms > ${PERFORMANCE_THRESHOLDS.maxQueryTimeMs}ms`);
      return { performanceAcceptable: false, avgQueryTimeMs: avgQueryTime, maxQueryTimeMs: maxQueryTime };
    }

    logger.info('[VALIDATION] ✅ Performance acceptable', {
      avgMs: avgQueryTime.toFixed(2),
      maxMs: maxQueryTime.toFixed(2)
    });

    return { performanceAcceptable: true, avgQueryTimeMs: avgQueryTime, maxQueryTimeMs: maxQueryTime };
  } catch (error) {
    const errorMsg = `Performance validation failed: ${error}`;
    errors.push(errorMsg);
    logger.error('[VALIDATION] Performance test error', error);
    return { performanceAcceptable: false, avgQueryTimeMs: 0, maxQueryTimeMs: 0 };
  }
}

/**
 * Collect diagnostic details
 *
 * Note: Uses COUNT(*) queries without user_id filtering.
 * For diagnostics, we only need to verify data is loaded, not user-specific counts.
 */
async function collectDiagnosticDetails(
  pglite: PGliteManager,
  avgQueryTimeMs: number,
  maxQueryTimeMs: number
) {
  try {
    const db = pglite.getDatabase();
    if (!db) throw new Error('Database not initialized');

    // Direct COUNT queries (no user_id filtering for diagnostics)
    const articlesResult = await db.query('SELECT COUNT(*) as count FROM local_articles');
    const fcResult = await db.query(
      'SELECT COUNT(*) as count FROM local_financial_centers WHERE is_active = true'
    );
    const ccResult = await db.query(
      'SELECT COUNT(*) as count FROM local_cost_centers WHERE is_active = true'
    );

    const articleCount = parseInt((articlesResult.rows[0] as { count: string }).count);
    const financialCenterCount = parseInt((fcResult.rows[0] as { count: string }).count);
    const costCenterCount = parseInt((ccResult.rows[0] as { count: string }).count);

    const schemaVersion = await pglite.getSchemaVersion();

    logger.info('[VALIDATION] Diagnostic counts', {
      articleCount,
      financialCenterCount,
      costCenterCount
    });

    return {
      schemaVersion,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      articleCount,
      financialCenterCount,
      costCenterCount,
      hierarchyCount: 0,
      avgQueryTimeMs,
      maxQueryTimeMs
    };
  } catch (error) {
    logger.error('[VALIDATION] Error collecting diagnostics', error);
    return {
      schemaVersion: 0,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      articleCount: 0,
      financialCenterCount: 0,
      costCenterCount: 0,
      hierarchyCount: 0,
      avgQueryTimeMs,
      maxQueryTimeMs
    };
  }
}
