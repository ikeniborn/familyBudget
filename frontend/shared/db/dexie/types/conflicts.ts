/**
 * Shopping Lists Conflict Resolution Types
 *
 * Defines types for conflict detection, diff computation, and resolution strategies
 * for Shopping Lists Dexie synchronization.
 *
 * @module conflicts
 */

import type { LocalShoppingList, LocalShoppingListItem } from './shopping';

/**
 * Type of conflict detected during synchronization
 * - update_update: Both client and server modified the same record
 * - update_delete: Client updated, server deleted
 * - delete_update: Client deleted, server updated
 */
export type ConflictType = 'update_update' | 'update_delete' | 'delete_update';

/**
 * Strategy for resolving conflicts
 * - server: Accept server version (discard local changes)
 * - client: Keep client version (re-upload to server)
 * - merge: Merge non-conflicting fields (Phase 2, not implemented in task-013)
 */
export type ResolutionStrategy = 'server' | 'client' | 'merge';

/**
 * Type of entity involved in conflict
 * - shopping_list: Shopping list record
 * - shopping_list_item: Shopping list item record
 */
export type ConflictEntityType = 'shopping_list' | 'shopping_list_item';

/**
 * Data type of a field for proper rendering in UI
 */
export type FieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'reference';

/**
 * Union type for field values based on FieldDataType
 */
export type FieldValue = string | number | boolean | Date | null;

/**
 * Represents a difference in a single field between local and server versions
 */
export interface FieldDiff {
  /** Internal field name (e.g., 'product_name') */
  fieldName: string;

  /** Human-readable label in Russian for UI display (e.g., 'Название товара') */
  fieldLabel: string;

  /** Value from local (client) version */
  localValue: FieldValue;

  /** Value from server version */
  serverValue: FieldValue;

  /** Data type for proper rendering */
  dataType: FieldDataType;

  /** Whether the values are different */
  isDifferent: boolean;
}

/**
 * Complete conflict detection result
 */
export interface ShoppingConflictDetection {
  /** Type of entity (list or item) */
  entityType: ConflictEntityType;

  /** Server-assigned ID (null if not synced yet) */
  entityId: number | null;

  /** Client-side temporary ID (UUID) */
  tempId: string;

  /** Type of conflict detected */
  conflictType: ConflictType;

  /** Local version of the record */
  localRecord: LocalShoppingList | LocalShoppingListItem;

  /** Server version of the record */
  serverRecord: LocalShoppingList | LocalShoppingListItem;

  /** Timestamp of local modification */
  localUpdatedAt: Date;

  /** Timestamp of server modification */
  serverUpdatedAt: Date;

  /** Array of field-by-field differences */
  changedFields: FieldDiff[];
}

/**
 * Result of applying a conflict resolution strategy
 */
export interface ConflictResolutionResult {
  /** Temporary ID of the resolved conflict */
  tempId: string;

  /** Type of entity that was resolved */
  entityType: ConflictEntityType;

  /** Strategy used to resolve the conflict */
  strategy: ResolutionStrategy;

  /** Timestamp when resolution was applied */
  resolvedAt: Date;

  /** Merged data (only used for 'merge' strategy in Phase 2) */
  mergedData?: Partial<LocalShoppingList | LocalShoppingListItem>;
}

/**
 * Field metadata for Shopping List entity
 */
export interface ShoppingListFieldMetadata {
  fieldName: keyof LocalShoppingList;
  fieldLabel: string;
  dataType: FieldDataType;
  /** Whether this field should be compared during conflict detection */
  compareInDiff: boolean;
}

/**
 * Field metadata for Shopping List Item entity
 */
export interface ShoppingListItemFieldMetadata {
  fieldName: keyof LocalShoppingListItem;
  fieldLabel: string;
  dataType: FieldDataType;
  /** Whether this field should be compared during conflict detection */
  compareInDiff: boolean;
}

/**
 * Field metadata configuration for Shopping Lists
 */
export const SHOPPING_LIST_FIELDS: ShoppingListFieldMetadata[] = [
  { fieldName: 'name', fieldLabel: 'Название списка', dataType: 'string', compareInDiff: true },
  { fieldName: 'description', fieldLabel: 'Описание', dataType: 'string', compareInDiff: true },
  { fieldName: 'is_active', fieldLabel: 'Активен', dataType: 'boolean', compareInDiff: true },
  { fieldName: 'updated_at', fieldLabel: 'Дата изменения', dataType: 'date', compareInDiff: true },
];

/**
 * Field metadata configuration for Shopping List Items
 */
export const SHOPPING_LIST_ITEM_FIELDS: ShoppingListItemFieldMetadata[] = [
  { fieldName: 'product_name', fieldLabel: 'Название товара', dataType: 'string', compareInDiff: true },
  { fieldName: 'quantity', fieldLabel: 'Количество', dataType: 'number', compareInDiff: true },
  { fieldName: 'unit', fieldLabel: 'Единица измерения', dataType: 'string', compareInDiff: true },
  { fieldName: 'comment', fieldLabel: 'Комментарий', dataType: 'string', compareInDiff: true },
  { fieldName: 'position', fieldLabel: 'Позиция', dataType: 'number', compareInDiff: false },
  { fieldName: 'is_completed', fieldLabel: 'Куплено', dataType: 'boolean', compareInDiff: true },
  { fieldName: 'completed_at', fieldLabel: 'Дата покупки', dataType: 'date', compareInDiff: true },
  { fieldName: 'store_id', fieldLabel: 'Магазин', dataType: 'reference', compareInDiff: true },
  { fieldName: 'product_group_id', fieldLabel: 'Категория', dataType: 'reference', compareInDiff: true },
  { fieldName: 'updated_at', fieldLabel: 'Дата изменения', dataType: 'date', compareInDiff: true },
];
