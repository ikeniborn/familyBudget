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
const DEFAULT_SCHEMA_VERSION = 1;

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

  constructor(version: number) {
    super('FamilyBudgetDB');

    /**
     * Dynamic version from getDatabaseVersion()
     *
     * ВАЖНО: Indexes определяют как быстро можно искать данные
     * Формат: 'primaryKey, index1, index2, [compound+index]'
     *
     * Compound indexes: [field1+field2] - для query с двумя полями
     * Example: [user_id+date] для быстрого поиска "user's facts in date range"
     */
    this.version(version).stores({
      // Reference Data
      articles: 'id, user_id, type, parent_id, is_active',
      articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth',
      financialCenters: 'id, user_id, is_active',
      costCenters: 'id, user_id, is_active',

      // Transactional Data
      // ВАЖНО: amount хранится как integer (cents), не decimal
      // PRIMARY KEY: temp_id (offline-first: temp_id always exists, id filled after sync)
      budgetFacts: 'temp_id, id, user_id, article_id, financial_center_id, cost_center_id, date, sync_status, [user_id+date], [user_id+sync_status]',
      pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at',
      syncConflicts: '++id, entity_type, temp_id, entity_id',
      recurringPlans: 'id, user_id, article_id, financial_center_id, is_active',

      // Shopping Lists
      // PRIMARY KEY: temp_id (same offline-first pattern as budgetFacts)
      shoppingLists: 'temp_id, id, user_id, is_completed, sync_status',
      shoppingListItems: 'temp_id, id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]',
      stores: 'id, user_id, name',
      productGroups: 'id, user_id, parent_id, name',
      productGroupHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth',

      // Metadata
      syncMetadata: 'entity_type, last_sync_timestamp',
      schemaMigrations: 'version, applied_at'
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
 * Helper: Convert dollar amount to cents (for storage)
 * Example: toCents(123.45) → 12345
 *
 * ВАЖНО: Использовать Math.round() для корректного округления float
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Helper: Convert cents to dollar amount (for display)
 * Example: fromCents(12345) → 123.45
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

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
