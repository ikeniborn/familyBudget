/**
 * Dexie Database Definition
 * IndexedDB schema for Family Budget
 *
 * ВАЖНО: amount fields хранятся как integer (cents)
 * Migration: PGlite NUMERIC → Dexie integer (multiply by 100)
 */

import Dexie, { type Table } from 'dexie';
import { logger } from '../utils/logger';
import type {
  LocalArticle,
  LocalArticleHierarchy,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalBudgetFact,
  LocalPendingOperation,
  LocalSyncConflict,
  LocalRecurringPlan,
  LocalShoppingList,
  LocalShoppingListItem,
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  LocalSyncMetadata,
  LocalSchemaMigration
} from '../types/models';

/**
 * Default schema version
 * Increment this when adding new migrations
 */
const DEFAULT_SCHEMA_VERSION = 5;  // v5: created_at index on pendingOperations

/**
 * Cached database version (to avoid redundant Dexie.exists() calls)
 */
let cachedVersion: number | null = null;

/**
 * Dynamically determine database version
 * - If DB exists: use Math.max(existing version, DEFAULT_SCHEMA_VERSION)
 * - If DB new: use DEFAULT_SCHEMA_VERSION
 * - Caches result to avoid redundant checks
 *
 * Prevents VersionError when downgrading code version
 */
async function getDatabaseVersion(): Promise<number> {
  // Return cached version if available
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  const dbName = 'FamilyBudgetDB';
  const exists = await Dexie.exists(dbName);

  if (!exists) {
    cachedVersion = DEFAULT_SCHEMA_VERSION;
    return cachedVersion;
  }

  // Temporarily open DB to get current version
  const tempDb = new Dexie(dbName);
  try {
    await tempDb.open();
    const currentVersion = tempDb.verno;
    tempDb.close();

    // Use maximum of current and default (prevents downgrade)
    cachedVersion = Math.max(currentVersion, DEFAULT_SCHEMA_VERSION);
    return cachedVersion;
  } catch (error) {
    logger.warn('[Dexie] Failed to get existing version, using default', error);
    cachedVersion = DEFAULT_SCHEMA_VERSION;
    return cachedVersion;
  }
}

/**
 * Clear version cache (used when database is deleted)
 * @internal
 */
export function clearVersionCache(): void {
  cachedVersion = null;
}

/**
 * Family Budget Dexie Database
 * Version 1: Initial schema (migrated from PGlite v7)
 * Version 2: Shopping lists creator_id schema fix
 * Version 3: Remove user_id from Stores/ProductGroups (global reference data)
 * Version 4: No-op — acknowledges native v4 created by Dexie SchemaDiff workaround
 * Version 5: Add created_at index to pendingOperations for efficient sorted queries
 */
export class FamilyBudgetDB extends Dexie {
  // Reference Data Tables
  articles!: Table<LocalArticle, number>;
  articleHierarchy!: Table<LocalArticleHierarchy, [number, number]>;
  financialCenters!: Table<LocalFinancialCenter, number>;
  costCenters!: Table<LocalCostCenter, number>;

  // Transactional Data Tables
  budgetFacts!: Table<LocalBudgetFact, number>;
  pendingOperations!: Table<LocalPendingOperation, number>;
  syncConflicts!: Table<LocalSyncConflict, number>;
  recurringPlans!: Table<LocalRecurringPlan, number>;

  // Shopping Lists Tables
  shoppingLists!: Table<LocalShoppingList, number>;
  shoppingListItems!: Table<LocalShoppingListItem, number>;
  stores!: Table<LocalStore, number>;
  productGroups!: Table<LocalProductGroup, number>;
  productGroupHierarchy!: Table<LocalProductGroupHierarchy, [number, number]>;

  // Metadata Tables
  syncMetadata!: Table<LocalSyncMetadata, string>;
  schemaMigrations!: Table<LocalSchemaMigration, number>;

  constructor(_version: number) {
    super('FamilyBudgetDB');

    /**
     * Version 1: Initial schema (migrated from PGlite v7)
     * Version 2: Shopping lists creator_id schema fix
     * Version 3: Remove user_id from Stores/ProductGroups (global reference data)
     * Version 4: No-op — acknowledges native v4 created by Dexie SchemaDiff workaround
     *
     * ВАЖНО: Indexes определяют как быстро можно искать данные
     * Формат: 'primaryKey, index1, index2, [compound+index]'
     *
     * Compound indexes: [field1+field2] - для query с двумя полями
     * Example: [user_id+date] для быстрого поиска "user's facts in date range"
     */

    // Version 1-2: Legacy schemas (kept for migration path)
    this.version(1).stores({
      articles: 'id, user_id, type, parent_id, is_active',
      articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth',
      financialCenters: 'id, user_id, is_active',
      costCenters: 'id, user_id, is_active',
      budgetFacts: 'temp_id, id, user_id, article_id, financial_center_id, cost_center_id, date, sync_status, [user_id+date], [user_id+sync_status]',
      pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at',
      syncConflicts: '++id, entity_type, temp_id, entity_id',
      recurringPlans: 'id, user_id, article_id, financial_center_id, is_active',
      shoppingLists: 'temp_id, id, user_id, creator_id, is_completed, sync_status',
      shoppingListItems: 'temp_id, id, creator_id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]',
      stores: 'id, user_id, name',
      productGroups: 'id, user_id, parent_id, name',
      productGroupHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth',
      syncMetadata: 'entity_type, last_sync_timestamp',
      schemaMigrations: 'version, applied_at'
    });

    this.version(2).stores({
      shoppingLists: 'temp_id, id, user_id, creator_id, is_completed, sync_status'
    });

    // Version 3: Fix Stores/ProductGroups schema (remove user_id - global reference data)
    this.version(3).stores({
      shoppingLists: 'temp_id, id, creator_id, is_active, sync_status',
      stores: 'id, name, is_active',
      productGroups: 'id, parent_id, name, is_active'
    }).upgrade(async tx => {
      // Migration: Rebuild stores and productGroups without user_id
      // Data will be re-synced from server on next initialReferenceSync
      logger.info('[Dexie Migration v3] Rebuilding Stores and Product Groups schema...');

      // Clear old data (will be re-synced)
      await tx.table('stores').clear();
      await tx.table('productGroups').clear();

      logger.info('[Dexie Migration v3] ✅ Schema migration complete. Data will be re-synced.');
    });

    // Version 4: No-op migration — acknowledges native v4 browsers
    // Background: Dexie SchemaDiff auto-incremented v3→v4 for users who had
    // the old v1 schema (before creator_id was added in commit 48fe5552).
    // This version prevents repeated SchemaDiff warnings.
    this.version(4).stores({});

    // Version 5: Add created_at index to pendingOperations for efficient sorted queries
    this.version(5).stores({
      pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at, created_at'
    });
  }
}

// Singleton instance with async initialization
let dbInstance: FamilyBudgetDB | null = null;

/**
 * Initialize database with dynamic version detection
 * Call this before using the database
 */
export async function initializeDatabase(): Promise<FamilyBudgetDB> {
  if (dbInstance) {
    return dbInstance;
  }

  const version = await getDatabaseVersion();
  dbInstance = new FamilyBudgetDB(version);

  logger.info(`[Dexie] Database initialized with version ${version}`);
  return dbInstance;
}

/**
 * Get database instance (synchronous)
 * Throws if database not initialized
 */
export function getDatabase(): FamilyBudgetDB {
  if (!dbInstance) {
    throw new Error('[Dexie] Database not initialized! Call initializeDatabase() first.');
  }
  return dbInstance;
}

// Proxy object for backward compatibility
// Allows accessing db.articles, db.budgetFacts, etc. before initialization
// Will throw error when trying to use methods if not initialized
export const db: FamilyBudgetDB = new Proxy({} as FamilyBudgetDB, {
  get(_target, prop) {
    // Skip symbols and prototype methods to avoid unexpected behavior
    if (typeof prop === 'symbol' || prop === 'constructor' || prop === '__proto__') {
      return undefined;
    }

    const instance = getDatabase(); // Throws if not initialized

    // Runtime validation: ensure property exists on instance
    if (!(prop in instance)) {
      throw new Error(`[Dexie] Property '${String(prop)}' does not exist on FamilyBudgetDB`);
    }

    return instance[prop as keyof FamilyBudgetDB];
  }
});

/**
 * Helper: Validate constraint (type check)
 * Dexie не поддерживает CHECK constraints, нужна JavaScript validation
 */
export function validateType(type: string, allowedValues: readonly string[]): boolean {
  return allowedValues.includes(type);
}

/**
 * Helper: Validate amount (positive number)
 */
export function validateAmount(amount: number): boolean {
  return typeof amount === 'number' && !isNaN(amount) && amount > 0;
}
