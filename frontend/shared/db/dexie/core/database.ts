/**
 * Dexie Database Definition
 * IndexedDB schema for Family Budget
 *
 * ВАЖНО: amount fields хранятся как integer (cents)
 * Migration: PGlite NUMERIC → Dexie integer (multiply by 100)
 */

import Dexie, { type Table } from 'dexie';
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

  constructor() {
    super('FamilyBudgetDB');

    /**
     * Version 1: Initial schema
     *
     * ВАЖНО: Indexes определяют как быстро можно искать данные
     * Формат: 'primaryKey, index1, index2, [compound+index]'
     *
     * Compound indexes: [field1+field2] - для query с двумя полями
     * Example: [user_id+date] для быстрого поиска "user's facts in date range"
     */
    this.version(1).stores({
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

// Singleton instance
export const db = new FamilyBudgetDB();

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
