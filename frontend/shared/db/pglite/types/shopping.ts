/**
 * Shopping Lists data models for PGlite Phase 3
 * Reference Data (stores, product groups) + Transactional Data (lists, items)
 */

import type { ShoppingConflictDetection } from './conflicts';

// ========================================
// REFERENCE DATA (Read-Only from Server)
// ========================================

/**
 * Store (shopping location) - reference data
 */
export interface LocalStore {
  id: number;
  name: string;
  address: string | null;
  code: string | null;
  is_active: boolean;
  created_at: Date;
}

/**
 * Product Group (category with hierarchy) - reference data
 */
export interface LocalProductGroup {
  id: number;
  parent_id: number | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: Date;
}

/**
 * Product Group Hierarchy (Closure Table) - reference data
 */
export interface LocalProductGroupHierarchy {
  ancestor_id: number;
  descendant_id: number;
  depth: number;
}

// ========================================
// TRANSACTIONAL DATA (User Mutations)
// ========================================

/**
 * Shopping List (Header table) - client-side representation
 */
export interface LocalShoppingList {
  id: number | null;          // Server ID (null for pending creates)
  temp_id: string;            // Client-side UUID
  creator_id: number;         // Audit only (NOT for filtering)

  // Business attributes
  name: string;
  description: string | null;
  is_active: boolean;

  // Sync tracking
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  sync_hash: string | null;
  content_hash: string | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;

  // Conflict resolution (populated when sync detects conflict)
  conflict_data?: ShoppingConflictDetection;
}

/**
 * Shopping List Item (Line table) - client-side representation
 */
export interface LocalShoppingListItem {
  id: number | null;
  temp_id: string;
  creator_id: number;

  // Foreign keys (temp_id for offline creates)
  shopping_list_temp_id: string;
  store_id: number;
  product_group_id: number;

  // Business attributes
  product_name: string;
  quantity: number | null;
  unit: string | null;
  comment: string | null;

  // Completion status
  is_completed: boolean;
  completed_at: Date | null;

  // Sync tracking (LWW + optimistic locking)
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  sync_hash: string | null;
  content_hash: string | null;
  version: number;

  // Soft delete
  deleted_at: Date | null;
  last_modified_by: number | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;

  // Conflict resolution (populated when sync detects conflict)
  conflict_data?: ShoppingConflictDetection;
}

// ========================================
// FILTERS
// ========================================

/**
 * Filters for querying shopping lists
 */
export interface ShoppingListFilters {
  is_active?: boolean;
  sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
}

/**
 * Filters for querying shopping list items
 */
export interface ShoppingListItemFilters {
  shopping_list_temp_id?: string;
  store_id?: number;
  product_group_id?: number;
  is_completed?: boolean;
  sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
  deleted?: boolean;  // true = only deleted, false = only active, undefined = all
}

/**
 * Filters for querying stores
 */
export interface StoreFilters {
  is_active?: boolean;
}

/**
 * Filters for querying product groups
 */
export interface ProductGroupFilters {
  parent_id?: number | null;
  is_active?: boolean;
}
