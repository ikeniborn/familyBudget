/**
 * Dexie Database Definition
 * IndexedDB schema for Family Budget
 *
 * ВАЖНО: amount fields хранятся как integer (cents)
 * Migration: PGlite NUMERIC → Dexie integer (multiply by 100)
 */

import Dexie, { type Table, type Transaction } from 'dexie';
import { logger } from '../utils/logger';
import { hashStringToInt53 } from '../utils/hash';
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
const DEFAULT_SCHEMA_VERSION = 4;  // Migrate temp_id from UUID (string) to numeric (int53)

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

  constructor(_version: number) {
    super('FamilyBudgetDB');

    /**
     * Version 1: Initial schema (migrated from PGlite v7)
     * Version 2: Shopping lists creator_id schema fix
     * Version 3: Remove user_id from Stores/ProductGroups (global reference data)
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

    // Version 4: Migrate temp_id from UUID (string) to numeric (int53)
    this.version(4).stores({
      // Indexes unchanged (Dexie auto-handles number type for temp_id)
      budgetFacts: 'temp_id, id, user_id, article_id, financial_center_id, cost_center_id, date, sync_status, [user_id+date], [user_id+sync_status]',
      shoppingLists: 'temp_id, id, creator_id, is_active, sync_status',
      shoppingListItems: 'temp_id, id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]'
    }).upgrade(async tx => {
      logger.info('[Dexie Migration v4] Migrating temp_id: string (UUID) → number (int53)...');

      try {
        // CRITICAL ORDER: Migrate parent tables BEFORE child tables (FK integrity)

        // 1. Migrate budgetFacts (no foreign keys)
        await migrateTempIds(tx, 'budgetFacts');

        // 2. Migrate shoppingLists (parent table)
        await migrateTempIds(tx, 'shoppingLists');

        // 3. Migrate shoppingListItems (child table with FK to shoppingLists)
        // IMPORTANT: Must be AFTER shoppingLists migration
        await migrateShoppingListItems(tx);

        logger.info('[Dexie Migration v4] ✅ Migration complete. All temp_id fields are now numeric.');
      } catch (error) {
        logger.error('[Dexie Migration v4] ❌ Migration failed:', error);
        throw error; // Rollback migration
      }
    });
  }
}

/**
 * Migrate table temp_id from UUID string to numeric (generic)
 *
 * IMPORTANT: temp_id is primary key! Cannot use .update() on primary key.
 * Strategy: .bulkPut() creates new records with numeric temp_id (replaces old UUID records)
 *
 * @param tx - Dexie transaction
 * @param tableName - Table name to migrate
 */
async function migrateTempIds(tx: Transaction, tableName: string): Promise<void> {
  const table = tx.table(tableName);
  const records = await table.toArray();

  if (records.length === 0) {
    logger.info(`[Migration v4] ${tableName}: No records to migrate (skipped)`);
    return;
  }

  // Map records: UUID temp_id → numeric temp_id
  const migratedRecords = records.map((record: any) => {
    // Validate temp_id exists and is string (UUID)
    if (!record.temp_id || typeof record.temp_id !== 'string') {
      logger.warn(`[Migration v4] ${tableName}: Invalid temp_id type for record`, record);
      return null;
    }

    // Convert UUID → numeric
    const numericTempId = hashStringToInt53(record.temp_id);

    return {
      ...record,
      temp_id: numericTempId
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null); // Remove null entries

  // Replace records (bulkPut overwrites by primary key)
  // Old UUID records are deleted, new numeric records are created
  await table.bulkPut(migratedRecords);

  logger.info(`[Migration v4] ${tableName}: ${migratedRecords.length}/${records.length} records migrated`);
}

/**
 * Migrate shoppingListItems with foreign key integrity
 *
 * CRITICAL: Must preserve foreign key relationship (shopping_list_temp_id → shoppingLists.temp_id)
 * Strategy:
 * 1. Build UUID → numeric mapping from shoppingLists (BEFORE migration)
 * 2. Migrate items: update both temp_id AND shopping_list_temp_id
 * 3. Use .bulkPut() to replace records
 *
 * @param tx - Dexie transaction
 */
async function migrateShoppingListItems(tx: Transaction): Promise<void> {
  const itemsTable = tx.table('shoppingListItems');
  const listsTable = tx.table('shoppingLists');

  const items = await itemsTable.toArray();
  const lists = await listsTable.toArray();

  if (items.length === 0) {
    logger.info('[Migration v4] shoppingListItems: No records to migrate (skipped)');
    return;
  }

  // Build UUID → numeric mapping for foreign key
  // IMPORTANT: Use current lists (already migrated) to get numeric temp_ids
  const listTempIdMap = new Map<string | number, number>();

  for (const list of lists) {
    const numericTempId = typeof list.temp_id === 'number'
      ? list.temp_id
      : hashStringToInt53(list.temp_id);

    // Map both old UUID and new numeric (for robustness)
    if (typeof list.temp_id === 'string') {
      listTempIdMap.set(list.temp_id, numericTempId); // UUID → numeric
    }
    listTempIdMap.set(numericTempId, numericTempId); // numeric → numeric
  }

  // Migrate items with foreign key update
  const migratedItems = items
    .map((item: any) => {
      // Validate temp_id
      if (!item.temp_id || typeof item.temp_id !== 'string') {
        logger.warn('[Migration v4] shoppingListItems: Invalid temp_id for item', item);
        return null;
      }

      // Validate shopping_list_temp_id
      if (!item.shopping_list_temp_id) {
        logger.warn('[Migration v4] shoppingListItems: Missing shopping_list_temp_id for item', item);
        return null;
      }

      // Get numeric FK (from mapping)
      const numericListTempId = listTempIdMap.get(item.shopping_list_temp_id);

      if (numericListTempId === undefined) {
        logger.error(`[Migration v4] shoppingListItems: Orphaned item ${item.temp_id} (parent: ${item.shopping_list_temp_id} not found)`);
        return null; // Skip orphaned items
      }

      // Convert item temp_id to numeric
      const numericItemTempId = hashStringToInt53(item.temp_id);

      return {
        ...item,
        temp_id: numericItemTempId,
        shopping_list_temp_id: numericListTempId // Update FK
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Replace records (bulkPut overwrites by primary key)
  await itemsTable.bulkPut(migratedItems);

  const orphanedCount = items.length - migratedItems.length;
  logger.info(`[Migration v4] shoppingListItems: ${migratedItems.length}/${items.length} records migrated (${orphanedCount} orphaned skipped)`);
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
