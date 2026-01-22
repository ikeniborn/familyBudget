/**
 * ShoppingConflictManager - Conflict detection and resolution for Shopping Lists
 * Task-013: Conflict Resolution Modal UI
 *
 * Detects conflicts during Shopping Lists PGlite sync, computes field-by-field diffs,
 * and applies resolution strategies (server/client/merge).
 */

import type { PGlite } from '@electric-sql/pglite';
import type { LocalShoppingList, LocalShoppingListItem } from './types/shopping';
import type {
  ShoppingConflictDetection,
  ConflictType,
  ResolutionStrategy,
  FieldDiff,
  FieldValue,
} from './types/conflicts';
import {
  SHOPPING_LIST_FIELDS,
  SHOPPING_LIST_ITEM_FIELDS,
} from './types/conflicts';
import { logger } from './utils/logger';

const LOG_PREFIX = '[SHOPPING_CONFLICT]';

/**
 * Floating point comparison epsilon for number equality
 */
const FLOAT_EPSILON = 0.001;

/**
 * ShoppingConflictManager class
 * Handles conflict detection, diff computation, resolution, and logging for Shopping Lists
 */
export class ShoppingConflictManager {
  constructor(private db: PGlite) {}

  // ========================================
  // CONFLICT DETECTION
  // ========================================

  /**
   * Detect conflict for a single shopping list
   * Compare sync_hash and sync_status to identify conflicts
   *
   * @param localList - Local shopping list
   * @param serverList - Server shopping list from delta sync
   * @returns Conflict detection result or null if no conflict
   */
  async detectListConflict(
    localList: LocalShoppingList,
    serverList: LocalShoppingList
  ): Promise<ShoppingConflictDetection | null> {
    // No conflict if local is synced
    if (localList.sync_status === 'synced') {
      return null;
    }

    // No conflict if sync_hash matches
    if (localList.sync_hash === serverList.sync_hash) {
      return null;
    }

    // Conflict detected - compute field diffs
    const changedFields = this.computeListDiff(localList, serverList);

    // No conflict if no fields actually differ (shouldn't happen, but defensive)
    if (changedFields.filter(f => f.isDifferent).length === 0) {
      logger.warn(`${LOG_PREFIX} sync_hash differs but no field changes detected`, {
        temp_id: localList.temp_id,
        localHash: localList.sync_hash,
        serverHash: serverList.sync_hash,
      });
      return null;
    }

    const conflict: ShoppingConflictDetection = {
      entityType: 'shopping_list',
      entityId: serverList.id,
      tempId: localList.temp_id,
      conflictType: this.determineConflictType(localList, serverList),
      localRecord: localList,
      serverRecord: serverList,
      localUpdatedAt: new Date(localList.updated_at),
      serverUpdatedAt: new Date(serverList.updated_at),
      changedFields,
    };

    logger.info(`${LOG_PREFIX} List conflict detected`, {
      temp_id: localList.temp_id,
      id: serverList.id,
      conflictType: conflict.conflictType,
      changedFieldCount: changedFields.filter(f => f.isDifferent).length,
    });

    return conflict;
  }

  /**
   * Detect conflict for a single shopping list item
   * Compare sync_hash and sync_status to identify conflicts
   *
   * @param localItem - Local shopping list item
   * @param serverItem - Server shopping list item from delta sync
   * @returns Conflict detection result or null if no conflict
   */
  async detectItemConflict(
    localItem: LocalShoppingListItem,
    serverItem: LocalShoppingListItem
  ): Promise<ShoppingConflictDetection | null> {
    // No conflict if local is synced
    if (localItem.sync_status === 'synced') {
      return null;
    }

    // No conflict if sync_hash matches
    if (localItem.sync_hash === serverItem.sync_hash) {
      return null;
    }

    // Conflict detected - compute field diffs
    const changedFields = this.computeItemDiff(localItem, serverItem);

    // No conflict if no fields actually differ (defensive)
    if (changedFields.filter(f => f.isDifferent).length === 0) {
      logger.warn(`${LOG_PREFIX} sync_hash differs but no field changes detected (item)`, {
        temp_id: localItem.temp_id,
        localHash: localItem.sync_hash,
        serverHash: serverItem.sync_hash,
      });
      return null;
    }

    const conflict: ShoppingConflictDetection = {
      entityType: 'shopping_list_item',
      entityId: serverItem.id,
      tempId: localItem.temp_id,
      conflictType: this.determineConflictType(localItem, serverItem),
      localRecord: localItem,
      serverRecord: serverItem,
      localUpdatedAt: new Date(localItem.updated_at),
      serverUpdatedAt: new Date(serverItem.updated_at),
      changedFields,
    };

    logger.info(`${LOG_PREFIX} Item conflict detected`, {
      temp_id: localItem.temp_id,
      id: serverItem.id,
      conflictType: conflict.conflictType,
      changedFieldCount: changedFields.filter(f => f.isDifferent).length,
    });

    return conflict;
  }

  // ========================================
  // DIFF COMPUTATION
  // ========================================

  /**
   * Compute field-by-field diff for shopping list
   * Compare all configured fields from SHOPPING_LIST_FIELDS
   *
   * @param local - Local version
   * @param server - Server version
   * @returns Array of field diffs
   */
  computeListDiff(
    local: LocalShoppingList,
    server: LocalShoppingList
  ): FieldDiff[] {
    return SHOPPING_LIST_FIELDS.map(field => {
      const localValue = local[field.fieldName] as FieldValue;
      const serverValue = server[field.fieldName] as FieldValue;

      return {
        fieldName: field.fieldName as string,
        fieldLabel: field.fieldLabel,
        localValue,
        serverValue,
        dataType: field.dataType,
        isDifferent: !this.valuesEqual(localValue, serverValue, field.dataType),
      };
    });
  }

  /**
   * Compute field-by-field diff for shopping list item
   * Compare all configured fields from SHOPPING_LIST_ITEM_FIELDS
   *
   * @param local - Local version
   * @param server - Server version
   * @returns Array of field diffs
   */
  computeItemDiff(
    local: LocalShoppingListItem,
    server: LocalShoppingListItem
  ): FieldDiff[] {
    return SHOPPING_LIST_ITEM_FIELDS.map(field => {
      const localValue = local[field.fieldName] as FieldValue;
      const serverValue = server[field.fieldName] as FieldValue;

      return {
        fieldName: field.fieldName as string,
        fieldLabel: field.fieldLabel,
        localValue,
        serverValue,
        dataType: field.dataType,
        isDifferent: !this.valuesEqual(localValue, serverValue, field.dataType),
      };
    });
  }

  /**
   * Compare two values for equality, handling nulls and dates
   *
   * @param a - First value
   * @param b - Second value
   * @param dataType - Data type for proper comparison
   * @returns True if values are equal
   */
  private valuesEqual(a: FieldValue, b: FieldValue, dataType: string): boolean {
    // Null equality
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;

    // Date comparison
    if (dataType === 'date') {
      const dateA = a instanceof Date ? a : new Date(a as string | number);
      const dateB = b instanceof Date ? b : new Date(b as string | number);
      return dateA.getTime() === dateB.getTime();
    }

    // Number comparison (handle float precision)
    if (dataType === 'number' && typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < FLOAT_EPSILON;
    }

    // String/boolean/reference comparison
    return a === b;
  }

  // ========================================
  // CONFLICT TYPE DETERMINATION
  // ========================================

  /**
   * Determine conflict type based on sync_status and deleted_at
   *
   * @param local - Local record
   * @param server - Server record
   * @returns Conflict type
   */
  private determineConflictType(
    local: LocalShoppingList | LocalShoppingListItem,
    server: LocalShoppingList | LocalShoppingListItem
  ): ConflictType {
    const isLocalDeleted = local.sync_status === 'deleted' ||
      ('deleted_at' in local && local.deleted_at !== null);
    const isServerDeleted = server.sync_status === 'deleted' ||
      ('deleted_at' in server && server.deleted_at !== null);

    if (isLocalDeleted && !isServerDeleted) {
      return 'delete_update'; // Local deleted, server updated
    }

    if (!isLocalDeleted && isServerDeleted) {
      return 'update_delete'; // Local updated, server deleted
    }

    return 'update_update'; // Both updated
  }

  // ========================================
  // RESOLUTION APPLICATION
  // ========================================

  /**
   * Apply server resolution - update local record with server data
   *
   * @param conflict - Conflict detection result
   */
  async applyServerResolution(conflict: ShoppingConflictDetection): Promise<void> {
    try {
      if (conflict.entityType === 'shopping_list') {
        await this.applyServerResolutionForList(conflict);
      } else {
        await this.applyServerResolutionForItem(conflict);
      }

      // Log resolution
      await this.logResolution(conflict, 'server');

      logger.info(`${LOG_PREFIX} Applied server resolution`, {
        entityType: conflict.entityType,
        temp_id: conflict.tempId,
      });
    } catch (error) {
      logger.error(`${LOG_PREFIX} Failed to apply server resolution`, { error });
      throw error;
    }
  }

  /**
   * Apply client resolution - keep local version, mark for re-upload
   *
   * @param conflict - Conflict detection result
   */
  async applyClientResolution(conflict: ShoppingConflictDetection): Promise<void> {
    try {
      // Mark local record as pending for re-upload
      if (conflict.entityType === 'shopping_list') {
        await this.db.query(`
          UPDATE local_shopping_lists
          SET sync_status = $1
          WHERE temp_id = $2
        `, ['pending', conflict.tempId]);
      } else {
        await this.db.query(`
          UPDATE local_shopping_list_items
          SET sync_status = $1
          WHERE temp_id = $2
        `, ['pending', conflict.tempId]);
      }

      // Log resolution
      await this.logResolution(conflict, 'client');

      logger.info(`${LOG_PREFIX} Applied client resolution (kept local, marked pending)`, {
        entityType: conflict.entityType,
        temp_id: conflict.tempId,
      });
    } catch (error) {
      logger.error(`${LOG_PREFIX} Failed to apply client resolution`, { error });
      throw error;
    }
  }

  /**
   * Apply server resolution for shopping list
   * Update all business fields + sync fields
   *
   * @param conflict - Conflict detection result
   */
  private async applyServerResolutionForList(
    conflict: ShoppingConflictDetection
  ): Promise<void> {
    const server = conflict.serverRecord as LocalShoppingList;

    await this.db.query(`
      UPDATE local_shopping_lists SET
        id = $1,
        creator_id = $2,
        name = $3,
        description = $4,
        is_active = $5,
        sync_status = $6,
        sync_hash = $7,
        content_hash = $8,
        updated_at = $9::timestamp,
        synced_at = $10::timestamp
      WHERE temp_id = $11
    `, [
      server.id,
      server.creator_id,
      server.name,
      server.description,
      server.is_active,
      'synced', // Mark as synced after applying server version
      server.sync_hash,
      server.content_hash,
      server.updated_at,
      new Date(), // Set synced_at to now
      conflict.tempId,
    ]);
  }

  /**
   * Apply server resolution for shopping list item
   * Update all business fields + sync fields
   *
   * @param conflict - Conflict detection result
   */
  private async applyServerResolutionForItem(
    conflict: ShoppingConflictDetection
  ): Promise<void> {
    const server = conflict.serverRecord as LocalShoppingListItem;

    await this.db.query(`
      UPDATE local_shopping_list_items SET
        id = $1,
        creator_id = $2,
        shopping_list_temp_id = $3,
        store_id = $4,
        product_group_id = $5,
        product_name = $6,
        quantity = $7,
        unit = $8,
        comment = $9,
        position = $10,
        is_completed = $11,
        completed_at = $12::timestamp,
        sync_status = $13,
        sync_hash = $14,
        content_hash = $15,
        version = $16,
        deleted_at = $17::timestamp,
        last_modified_by = $18,
        updated_at = $19::timestamp,
        synced_at = $20::timestamp
      WHERE temp_id = $21
    `, [
      server.id,
      server.creator_id,
      server.shopping_list_temp_id,
      server.store_id,
      server.product_group_id,
      server.product_name,
      server.quantity,
      server.unit,
      server.comment,
      server.position,
      server.is_completed,
      server.completed_at,
      'synced', // Mark as synced after applying server version
      server.sync_hash,
      server.content_hash,
      server.version,
      server.deleted_at,
      server.last_modified_by,
      server.updated_at,
      new Date(), // Set synced_at to now
      conflict.tempId,
    ]);
  }

  // ========================================
  // MERGE RESOLUTION (Task-014)
  // ========================================

  /**
   * Apply merge resolution - smart merge with OR logic for is_completed, MAX for quantity
   *
   * @param conflict - Conflict detection result
   */
  async applyMergeResolution(conflict: ShoppingConflictDetection): Promise<void> {
    try {
      if (conflict.entityType === 'shopping_list') {
        await this.applyMergeResolutionForList(conflict);
      } else {
        await this.applyMergeResolutionForItem(conflict);
      }

      // Log resolution
      await this.logResolution(conflict, 'merge');

      logger.info(`${LOG_PREFIX} Applied merge resolution`, {
        entityType: conflict.entityType,
        temp_id: conflict.tempId,
      });
    } catch (error) {
      logger.error(`${LOG_PREFIX} Failed to apply merge resolution`, { error });
      throw error;
    }
  }

  /**
   * Apply merge resolution for shopping list - LWW (Last-Write-Wins)
   *
   * @param conflict - Conflict detection result
   */
  private async applyMergeResolutionForList(
    conflict: ShoppingConflictDetection
  ): Promise<void> {
    const local = conflict.localRecord as LocalShoppingList;
    const server = conflict.serverRecord as LocalShoppingList;

    // LWW: Use server if server.updated_at > local.updated_at
    const serverWins = new Date(server.updated_at) > new Date(local.updated_at);

    if (serverWins) {
      // Server wins - apply server version
      await this.applyServerResolutionForList(conflict);
    } else {
      // Client wins - mark as pending for re-upload
      await this.db.query(`
        UPDATE local_shopping_lists
        SET sync_status = $1
        WHERE temp_id = $2
      `, ['pending', conflict.tempId]);
    }
  }

  /**
   * Apply merge resolution for shopping list item - Smart field merge
   *
   * Merge strategy:
   * - is_completed: OR logic (true if either version completed)
   * - quantity: MAX value (higher quantity wins)
   * - position: Server is source of truth
   * - completed_at: Earliest timestamp if is_completed = true
   * - Other fields: Server wins
   *
   * @param conflict - Conflict detection result
   */
  private async applyMergeResolutionForItem(
    conflict: ShoppingConflictDetection
  ): Promise<void> {
    const local = conflict.localRecord as LocalShoppingListItem;
    const server = conflict.serverRecord as LocalShoppingListItem;

    // Smart merge logic
    const mergedIsCompleted = local.is_completed || server.is_completed;
    const mergedQuantity = this.mergeQuantity(local.quantity, server.quantity);
    const mergedCompletedAt = this.mergeCompletedAt(local, server, mergedIsCompleted);

    await this.db.query(`
      UPDATE local_shopping_list_items SET
        id = $1,
        creator_id = $2,
        shopping_list_temp_id = $3,
        store_id = $4,
        product_group_id = $5,
        product_name = $6,
        quantity = $7,
        unit = $8,
        comment = $9,
        position = $10,
        is_completed = $11,
        completed_at = $12::timestamp,
        sync_status = $13,
        sync_hash = $14,
        content_hash = $15,
        version = $16,
        deleted_at = $17::timestamp,
        last_modified_by = $18,
        updated_at = $19::timestamp,
        synced_at = $20::timestamp
      WHERE temp_id = $21
    `, [
      server.id,                    // Identity: server wins
      server.creator_id,            // Identity: server wins
      server.shopping_list_temp_id, // Reference: server wins
      server.store_id,              // Reference: server wins
      server.product_group_id,      // Reference: server wins
      server.product_name,          // Business: server wins
      mergedQuantity,               // Smart merge: MAX
      server.unit,                  // Business: server wins
      server.comment,               // Business: server wins
      server.position,              // Ordering: server wins (source of truth)
      mergedIsCompleted,            // Smart merge: OR
      mergedCompletedAt,            // Smart merge: earliest timestamp
      'synced',                     // Mark as synced after merge
      server.sync_hash,             // Sync: use server hash
      server.content_hash,          // Sync: use server hash
      server.version,               // Sync: use server version
      server.deleted_at,            // Soft delete: server wins
      server.last_modified_by,      // Audit: server wins
      server.updated_at,            // Timestamp: server wins
      new Date(),                   // Set synced_at to now
      conflict.tempId,
    ]);
  }

  /**
   * Merge quantity using MAX logic
   * Null is treated as 0 for comparison
   *
   * @param localQty - Local quantity
   * @param serverQty - Server quantity
   * @returns Maximum quantity
   */
  private mergeQuantity(
    localQty: number | null,
    serverQty: number | null
  ): number | null {
    // If both null, return null
    if (localQty === null && serverQty === null) {
      return null;
    }

    // Treat null as 0 for comparison
    const local = localQty ?? 0;
    const server = serverQty ?? 0;

    return Math.max(local, server);
  }

  /**
   * Merge completed_at using OR logic with earliest timestamp
   * If either version is completed, use earliest completed_at
   *
   * @param local - Local record
   * @param server - Server record
   * @param mergedIsCompleted - Merged is_completed value
   * @returns Merged completed_at timestamp
   */
  private mergeCompletedAt(
    local: LocalShoppingListItem,
    server: LocalShoppingListItem,
    mergedIsCompleted: boolean
  ): Date | null {
    // If merged is not completed, return null
    if (!mergedIsCompleted) {
      return null;
    }

    // If merged is completed, use earliest completed_at
    const localCompletedAt = local.completed_at ? new Date(local.completed_at) : null;
    const serverCompletedAt = server.completed_at ? new Date(server.completed_at) : null;

    // If both have completed_at, use earliest
    if (localCompletedAt && serverCompletedAt) {
      return localCompletedAt < serverCompletedAt ? localCompletedAt : serverCompletedAt;
    }

    // If only one has completed_at, use it
    if (localCompletedAt) return localCompletedAt;
    if (serverCompletedAt) return serverCompletedAt;

    // If neither has completed_at (shouldn't happen if is_completed=true), use current time
    return new Date();
  }

  // ========================================
  // CONFLICT LOGGING
  // ========================================

  /**
   * Log conflict resolution to local_sync_conflicts table
   * Store both versions as JSONB for audit trail
   *
   * @param conflict - Conflict detection result
   * @param strategy - Resolution strategy applied
   */
  async logResolution(
    conflict: ShoppingConflictDetection,
    strategy: ResolutionStrategy
  ): Promise<void> {
    try {
      // Serialize records (convert Dates to ISO strings)
      const localVersion = this.serializeRecord(conflict.localRecord);
      const serverVersion = this.serializeRecord(conflict.serverRecord);

      const localJson = JSON.stringify(localVersion);
      const serverJson = JSON.stringify(serverVersion);

      await this.db.query(`
        INSERT INTO local_sync_conflicts (
          entity_type, entity_id, temp_id,
          local_version, server_version,
          resolution, resolved_at, created_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, NOW())
      `, [
        conflict.entityType,
        conflict.entityId,
        conflict.tempId,
        localJson,
        serverJson,
        strategy,
        new Date(), // resolved_at
      ]);

      logger.info(`${LOG_PREFIX} Logged conflict resolution`, {
        entityType: conflict.entityType,
        temp_id: conflict.tempId,
        strategy,
      });
    } catch (error) {
      logger.error(`${LOG_PREFIX} Failed to log conflict resolution`, { error });
      // Don't throw - logging failure shouldn't block resolution
    }
  }

  /**
   * Serialize record for JSONB storage
   * Convert Date objects to ISO strings
   *
   * @param record - Record to serialize
   * @returns Serialized record
   */
  private serializeRecord(
    record: LocalShoppingList | LocalShoppingListItem
  ): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (value instanceof Date) {
        serialized[key] = value.toISOString();
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }
}
