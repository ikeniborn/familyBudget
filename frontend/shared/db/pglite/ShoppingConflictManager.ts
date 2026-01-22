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
} from './types/conflicts';
import {
  SHOPPING_LIST_FIELDS,
  SHOPPING_LIST_ITEM_FIELDS,
} from './types/conflicts';
import { logger } from './utils/logger';

const LOG_PREFIX = '[SHOPPING_CONFLICT]';

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
      const localValue = local[field.fieldName];
      const serverValue = server[field.fieldName];

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
      const localValue = local[field.fieldName];
      const serverValue = server[field.fieldName];

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
  private valuesEqual(a: any, b: any, dataType: string): boolean {
    // Null equality
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;

    // Date comparison
    if (dataType === 'date') {
      const dateA = a instanceof Date ? a : new Date(a);
      const dateB = b instanceof Date ? b : new Date(b);
      return dateA.getTime() === dateB.getTime();
    }

    // Number comparison (handle float precision)
    if (dataType === 'number' && typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.001;
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
        is_completed = $10,
        completed_at = $11::timestamp,
        sync_status = $12,
        sync_hash = $13,
        content_hash = $14,
        version = $15,
        deleted_at = $16::timestamp,
        last_modified_by = $17,
        updated_at = $18::timestamp,
        synced_at = $19::timestamp
      WHERE temp_id = $20
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
