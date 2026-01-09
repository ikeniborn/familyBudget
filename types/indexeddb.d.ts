/**
 * IndexedDB Schema Types
 * Family Budget PWA
 *
 * Type definitions for offline storage in IndexedDB.
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

/// <reference types="./models" />

/**
 * Offline fact (local IndexedDB)
 * Extends BudgetFact with offline-specific fields
 */
interface OfflineFact extends BudgetFact {
  tempId: string; // Required for IndexedDB keyPath
  synced: boolean;
  syncAttempts?: number;
  lastSyncAttempt?: string | null;
  serverId?: number | null; // Server ID after successful sync
  is_synced: boolean;
}

/**
 * Offline transfer (local IndexedDB)
 * Extends Transfer with offline-specific fields
 */
interface OfflineTransfer extends Transfer {
  tempId: string; // Required for IndexedDB keyPath
  synced: boolean;
  syncAttempts?: number;
  lastSyncAttempt?: string | null;
  serverId?: string | null; // Server ID after successful sync
  is_synced: boolean;
}

/**
 * Offline recurring plan (local IndexedDB)
 * Extends RecurringPlan with offline-specific fields
 */
interface OfflinePlan extends RecurringPlan {
  tempId: string; // Required for IndexedDB keyPath
  synced: boolean;
  syncAttempts?: number;
  lastSyncAttempt?: string | null;
  serverId?: number | null; // Server ID after successful sync
  is_synced: boolean;
}

/**
 * Offline shopping list (local IndexedDB)
 * Extends ShoppingList with offline-specific fields
 */
interface OfflineShoppingList extends ShoppingList {
  tempId: string; // Required for IndexedDB keyPath
  synced: boolean;
  syncAttempts?: number;
  lastSyncAttempt?: string | null;
  serverId?: number | null; // Server ID after successful sync
  is_synced: boolean;
}

/**
 * Offline shopping list item (local IndexedDB)
 * Extends ShoppingListItem with offline-specific fields
 */
interface OfflineShoppingListItem extends ShoppingListItem {
  tempId: string; // Required for IndexedDB keyPath
  synced: boolean;
  syncAttempts?: number;
  lastSyncAttempt?: string | null;
  serverId?: number | null; // Server ID after successful sync
  is_synced: boolean;
}

/**
 * Sync queue entry for pending operations
 */
interface SyncQueueEntry {
  id?: number; // Auto-increment keyPath
  operation: 'create' | 'update' | 'delete';
  entityType: 'fact' | 'transfer' | 'plan' | 'recurring';
  tempId: string;
  data: any; // Original entity data
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  syncAttempts: number;
  lastSyncAttempt?: string | null;
  error?: string | null;
  created_at: string;
}

/**
 * Sync queue entry for shopping lists/items
 */
interface SyncQueueShoppingEntry {
  id?: number; // Auto-increment keyPath
  operation: 'create' | 'update' | 'delete';
  entityType: 'list' | 'item';
  tempId: string;
  data: any; // Original entity data
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  syncAttempts: number;
  lastSyncAttempt?: string | null;
  error?: string | null;
  created_at: string;
}

/**
 * Data cache entry for reference data (articles, accounts, etc.)
 */
interface DataCacheEntry<T = any> {
  key: string; // Cache key (e.g., 'articles', 'financial_centers')
  data: T; // Cached data
  timestamp: string; // ISO 8601 timestamp
  expiresAt?: string | null; // Optional expiration time
}

/**
 * Sync metadata for tracking sync state
 */
interface SyncMetadata {
  key: string; // Metadata key (e.g., 'last_full_sync', 'last_incremental_sync')
  value: any; // Metadata value
  updated_at: string; // ISO 8601 timestamp
}

/**
 * IndexedDB store names
 */
type IndexedDBStoreName =
  | 'offline_facts'
  | 'offline_transfers'
  | 'offline_plans'
  | 'offline_recurring_plans'
  | 'offline_shopping_lists'
  | 'offline_shopping_list_items'
  | 'sync_queue'
  | 'sync_queue_shopping'
  | 'data_cache'
  | 'cached_stores'
  | 'cached_product_groups'
  | 'sync_metadata';

/**
 * IndexedDB schema version
 */
type IndexedDBVersion = 5;

/**
 * IndexedDB schema definition
 */
interface IndexedDBSchema {
  facts: OfflineFact;
  transfers: OfflineTransfer;
  plans: OfflinePlan;
  recurringPlans: OfflinePlan;
  shoppingLists: OfflineShoppingList;
  shoppingListItems: OfflineShoppingListItem;
  syncQueue: SyncQueueEntry;
  syncQueueShopping: SyncQueueShoppingEntry;
  dataCache: DataCacheEntry;
  cachedStores: Store;
  cachedProductGroups: ProductGroup;
  syncMetadata: SyncMetadata;
}
