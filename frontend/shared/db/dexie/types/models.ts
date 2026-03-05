/**
 * Data models for Dexie.js
 * ВАЖНО: Типы идентичны Dexie моделям для обеспечения совместимости
 * Phase 1: Reference Data (Articles, Financial Centers, Cost Centers)
 * Phase 2: Transactional Data (Budget Facts, Pending Operations, Sync Conflicts)
 * Phase 3: Shopping Lists
 */

/**
 * Article (budget category) - income or expense
 */
export interface LocalArticle {
  id: number;
  user_id: number;
  parent_id: number | null;
  name: string;
  type: 'income' | 'expense' | 'debit' | 'credit';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Financial Center (bank account, wallet, card)
 * Matches backend model FinancialCenter (SCD Type 1)
 */
export interface LocalFinancialCenter {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  code: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Cost Center (project, department)
 */
export interface LocalCostCenter {
  id: number;
  user_id: number;
  name: string;
  financial_center_id: number | null;
  is_active: boolean;
  created_at: Date;
}

/**
 * Article Hierarchy (closure table for article tree)
 */
export interface LocalArticleHierarchy {
  ancestor_id: number;
  descendant_id: number;
  depth: number;
}

/**
 * Sync Metadata (tracks last sync per entity type)
 */
export interface LocalSyncMetadata {
  entity_type: string;
  last_sync_timestamp: Date | null;
  sync_version: number;
  total_records: number;
}

/**
 * Schema Migration record
 */
export interface LocalSchemaMigration {
  version: number;
  applied_at: Date;
}

// Phase 2: Transactional Data (re-export from fact.ts)
export type {
  LocalBudgetFact,
  LocalPendingOperation,
  LocalSyncConflict,
  LocalRecurringPlan,
  FactFilters
} from './fact';

// Phase 4: Recurring Plans Filters (re-export from operations)
export type { RecurringPlanFilters } from '../operations/recurringOperations';

// Phase 3: Shopping Lists (re-export from shopping.ts)
export type {
  LocalStore,
  LocalProductGroup,
  LocalProductGroupHierarchy,
  LocalShoppingList,
  ShoppingListWithStats,
  LocalShoppingListItem,
  ShoppingListFilters,
  ShoppingListItemFilters,
  StoreFilters,
  ProductGroupFilters
} from './shopping';
