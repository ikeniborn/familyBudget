/**
 * Data models for PGlite
 * Phase 1: Reference Data (Articles, Financial Centers, Cost Centers)
 * Phase 2: Transactional Data (Budget Facts, Pending Operations, Sync Conflicts)
 */

/**
 * Article (budget category) - income or expense
 */
export interface LocalArticle {
  id: number;
  user_id: number;
  parent_id: number | null;
  name: string;
  type: 'income' | 'expense';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Financial Center (bank account, wallet, card)
 */
export interface LocalFinancialCenter {
  id: number;
  user_id: number;
  name: string;
  type: 'account' | 'wallet' | 'card';
  currency: string;
  is_active: boolean;
  created_at: Date;
}

/**
 * Cost Center (project, department)
 */
export interface LocalCostCenter {
  id: number;
  user_id: number;
  name: string;
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
