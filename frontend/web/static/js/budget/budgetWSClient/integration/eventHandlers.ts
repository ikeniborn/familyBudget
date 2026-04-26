/**
 * Event Handlers Module
 * Handles 14 WebSocket event types and integrations with offlineManager/listsManager
 *
 * Extracted from budgetWSClient.js:1786-1875 (EVENT HANDLERS)
 */

// Global debugLog function (declared in index.html)
declare const debugLog: (...args: any[]) => void;

import { notifyHandlers } from './eventRegistration';
import { db, generateUUID } from '@db/dexie';
import type {
  FactCreatedEvent,
  FactUpdatedEvent,
  FactDeletedEvent,
  PlanCreatedEvent,
  PlanUpdatedEvent,
  PlanDeletedEvent,
  TransferCreatedEvent,
  TransferDeletedEvent,
  ItemCreatedEvent,
  ItemUpdatedEvent,
  ItemDeletedEvent,
  ItemCompletedEvent,
  ShoppingListCreatedEvent,
  ShoppingListUpdatedEvent,
  ShoppingListDeletedEvent,
  FinancialCenterCreatedEvent,
  FinancialCenterUpdatedEvent,
  FinancialCenterDeletedEvent,
  CostCenterCreatedEvent,
  CostCenterUpdatedEvent,
  CostCenterDeletedEvent,
  StoreCreatedEvent,
  StoreUpdatedEvent,
  StoreDeletedEvent,
  ProductGroupCreatedEvent,
  ProductGroupUpdatedEvent,
  ProductGroupDeletedEvent,
  SyncInitialResponse,
  SyncIncrementalResponse,
  SyncClientChangesResponse,
} from '../types/events';
import { handleSyncInitial, handleSyncIncremental } from './syncHandler';

// ============================================================================
// Dexie helpers (non-fatal, fire-and-forget pattern from wsEventHandlers.ts)
// ============================================================================

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

async function hardDeleteFactInDexie(factId: number): Promise<void> {
  try {
    await db.budgetFacts.where('id').equals(factId).delete();
  } catch { /* non-fatal */ }
}

async function upsertFactInDexie(fact: any): Promise<void> {
  try {
    const existing = await db.budgetFacts.where('id').equals(fact.id).first();
    if (existing) {
      await db.budgetFacts.where('temp_id').equals(existing.temp_id).modify({
        ...fact,
        temp_id: existing.temp_id,
        sync_status: 'synced',
        updated_at: toDate(fact.updated_at),
      });
    } else {
      await db.budgetFacts.put({
        ...fact,
        temp_id: generateUUID(),
        sync_status: 'synced',
        created_at: toDate(fact.created_at),
        updated_at: toDate(fact.updated_at),
      } as any);
    }
  } catch { /* non-fatal */ }
}

async function upsertShoppingListInDexie(list: any): Promise<void> {
  try {
    const existing = await db.shoppingLists.where('id').equals(list.id).first();
    if (existing) {
      await db.shoppingLists.where('temp_id').equals(existing.temp_id).modify({
        ...list,
        temp_id: existing.temp_id,
        sync_status: 'synced',
        updated_at: toDate(list.updated_at),
      });
    } else {
      await db.shoppingLists.put({
        ...list,
        temp_id: generateUUID(),
        sync_status: 'synced',
        created_at: toDate(list.created_at),
        updated_at: toDate(list.updated_at),
      } as any);
    }
  } catch { /* non-fatal */ }
}

async function hardDeleteShoppingListFromDexie(listId: number): Promise<void> {
  try {
    const existing = await db.shoppingLists.where('id').equals(listId).first();
    // Cascade by every available key: items may carry only `shopping_list_id`
    // (БАГ-4 legacy rows), only `shopping_list_temp_id`, or both. Walking the
    // table once and matching on either field guarantees orphan-free delete.
    const orphanedItems = await db.shoppingListItems
      .filter(i =>
        (existing?.temp_id != null && i.shopping_list_temp_id === existing.temp_id) ||
        (i.shopping_list_id != null && i.shopping_list_id === listId)
      )
      .toArray();
    if (orphanedItems.length > 0) {
      await db.shoppingListItems.bulkDelete(
        orphanedItems.map(i => i.temp_id) as unknown as number[]
      );
    }
    if (existing) {
      await db.shoppingLists.where('temp_id').equals(existing.temp_id).delete();
    } else {
      await db.shoppingLists.where('id').equals(listId).delete();
    }
  } catch { /* non-fatal */ }
}

async function upsertShoppingItemInDexie(item: any): Promise<void> {
  try {
    const existing = await db.shoppingListItems.where('id').equals(item.id).first();
    // Resolve shopping_list_temp_id from the parent list when only the server
    // FK is known. Keeps the cascade-on-list-delete query working.
    let listTempId: string | undefined = existing?.shopping_list_temp_id;
    if (!listTempId && item.shopping_list_id != null) {
      const parent = await db.shoppingLists.where('id').equals(item.shopping_list_id).first();
      listTempId = parent?.temp_id;
    }
    if (existing) {
      await db.shoppingListItems.where('temp_id').equals(existing.temp_id).modify({
        ...item,
        temp_id: existing.temp_id,
        shopping_list_id: item.shopping_list_id ?? existing.shopping_list_id ?? null,
        shopping_list_temp_id: listTempId ?? existing.shopping_list_temp_id,
        sync_status: 'synced',
        updated_at: toDate(item.updated_at),
      });
    } else {
      await db.shoppingListItems.put({
        ...item,
        temp_id: generateUUID(),
        shopping_list_id: item.shopping_list_id ?? null,
        shopping_list_temp_id: listTempId ?? item.shopping_list_temp_id,
        sync_status: 'synced',
        created_at: toDate(item.created_at),
        updated_at: toDate(item.updated_at),
      } as any);
    }
  } catch { /* non-fatal */ }
}

async function hardDeleteShoppingItemInDexie(itemId: number): Promise<void> {
  try {
    // Primary delete via secondary `id` index.
    const deleted = await db.shoppingListItems.where('id').equals(itemId).delete();
    // Fallback: locate row by id and remove by primary key `temp_id`. Catches
    // edge cases where the secondary index missed (older Dexie schema rows or
    // rows with non-numeric id types).
    if (!deleted) {
      const stale = await db.shoppingListItems.where('id').equals(itemId).first();
      if (stale?.temp_id) {
        // primary key is temp_id (string); table typing is `<..., number>`
        await db.shoppingListItems.delete(stale.temp_id as unknown as number);
      }
    }
  } catch { /* non-fatal */ }
}

async function upsertFinancialCenterInDexie(fc: any): Promise<void> {
  try { await db.financialCenters.put(fc); } catch { /* non-fatal */ }
}

async function deleteFinancialCenterFromDexie(id: number): Promise<void> {
  try { await db.financialCenters.where('id').equals(id).delete(); } catch { /* non-fatal */ }
}

async function upsertCostCenterInDexie(cc: any): Promise<void> {
  try { await db.costCenters.put(cc); } catch { /* non-fatal */ }
}

async function deleteCostCenterFromDexie(id: number): Promise<void> {
  try { await db.costCenters.where('id').equals(id).delete(); } catch { /* non-fatal */ }
}

async function upsertStoreInDexie(store: any): Promise<void> {
  try { await db.stores.put(store); } catch { /* non-fatal */ }
}

async function deleteStoreFromDexie(id: number): Promise<void> {
  try { await db.stores.where('id').equals(id).delete(); } catch { /* non-fatal */ }
}

async function upsertProductGroupInDexie(pg: any): Promise<void> {
  try { await db.productGroups.put(pg); } catch { /* non-fatal */ }
}

async function deleteProductGroupFromDexie(id: number): Promise<void> {
  try { await db.productGroups.where('id').equals(id).delete(); } catch { /* non-fatal */ }
}

// ============================================================================

/**
 * Handle fact_created event
 */
export function handleFactCreated(data: FactCreatedEvent): void {
  notifyHandlers('fact_created', data);
  callOfflineManagerUI('fact_created', data);
  void upsertFactInDexie(data);
}

/**
 * Handle fact_updated event
 */
export function handleFactUpdated(data: FactUpdatedEvent): void {
  notifyHandlers('fact_updated', data);
  callOfflineManagerUI('fact_updated', data);
  void upsertFactInDexie(data);
}

/**
 * Handle fact_deleted event
 */
export function handleFactDeleted(data: FactDeletedEvent): void {
  notifyHandlers('fact_deleted', data);
  callOfflineManagerUI('fact_deleted', data);
  void hardDeleteFactInDexie(data.id);
}

/**
 * Handle plan_created event (stored in budgetFacts with record_type='plan')
 */
export function handlePlanCreated(data: PlanCreatedEvent): void {
  notifyHandlers('plan_created', data);
  callOfflineManagerUI('plan_created', data);
  void upsertFactInDexie(data);
}

/**
 * Handle plan_updated event
 */
export function handlePlanUpdated(data: PlanUpdatedEvent): void {
  notifyHandlers('plan_updated', data);
  callOfflineManagerUI('plan_updated', data);
  void upsertFactInDexie(data);
}

/**
 * Handle plan_deleted event
 */
export function handlePlanDeleted(data: PlanDeletedEvent): void {
  notifyHandlers('plan_deleted', data);
  callOfflineManagerUI('plan_deleted', data);
  void hardDeleteFactInDexie(data.id);
}

/**
 * Handle transfer_created event
 */
export function handleTransferCreated(data: TransferCreatedEvent): void {
  notifyHandlers('transfer_created', data);
  callOfflineManagerUI('transfer_created', data);
}

/**
 * Handle transfer_deleted event
 */
export function handleTransferDeleted(data: TransferDeletedEvent): void {
  notifyHandlers('transfer_deleted', data);
  callOfflineManagerUI('transfer_deleted', data);
}

/**
 * Handle item_created event (shopping lists)
 */
export function handleItemCreated(data: ItemCreatedEvent): void {
  notifyHandlers('item_created', data);
  callListsManagerUI('addItemToUI', data);
  void upsertShoppingItemInDexie(data);
}

/**
 * Handle item_updated event (shopping lists)
 */
export function handleItemUpdated(data: ItemUpdatedEvent): void {
  notifyHandlers('item_updated', data);
  callListsManagerUI('updateItemInUI', data);
  void upsertShoppingItemInDexie(data);
}

/**
 * Handle item_deleted event (shopping lists)
 */
export function handleItemDeleted(data: ItemDeletedEvent): void {
  notifyHandlers('item_deleted', data);
  if ((window as any).listsManager) {
    (window as any).listsManager.removeItemFromUI(data.id, data.shopping_list_id);
  }
  void hardDeleteShoppingItemInDexie(data.id);
}

/**
 * Handle item_completed event (shopping lists)
 */
export function handleItemCompleted(data: ItemCompletedEvent): void {
  notifyHandlers('item_completed', data);
  if ((window as any).listsManager) {
    (window as any).listsManager.toggleItemCompletedInUI(
      data.id,
      data.is_completed,
      data.shopping_list_id
    );
  }
}

/**
 * Handle shopping_list_created event
 */
export function handleShoppingListCreated(data: ShoppingListCreatedEvent): void {
  debugLog('[WS] Shopping list created:', data);
  notifyHandlers('shopping_list_created', data);
  void upsertShoppingListInDexie(data);

  // Refresh dashboard if on landing view
  if ((window as any).listsManager?.refreshDashboard) {
    (window as any).listsManager.refreshDashboard('created', data);
  }
}

/**
 * Handle shopping_list_updated event
 */
export function handleShoppingListUpdated(data: ShoppingListUpdatedEvent): void {
  debugLog('[WS] Shopping list updated:', data);
  notifyHandlers('shopping_list_updated', data);
  void upsertShoppingListInDexie(data);

  // Use efficient in-state stats update (no API reload) when available
  // This updates total_items/completed_items/completion_percentage in landing page cards
  if ((window as any).listsManager?.handleShoppingListUpdated) {
    (window as any).listsManager.handleShoppingListUpdated(data);
  } else if ((window as any).listsManager?.refreshDashboard) {
    // Fallback: full API reload (older implementation)
    (window as any).listsManager.refreshDashboard('updated', data);
  }
}

/**
 * Handle shopping_list_deleted event
 */
export function handleShoppingListDeleted(data: ShoppingListDeletedEvent): void {
  debugLog('[BudgetWS] Handling shopping_list_deleted event', data);
  notifyHandlers('shopping_list_deleted', data);
  void hardDeleteShoppingListFromDexie(data.id);

  // Notify lists manager if available
  if ((window as any).listsManager?.handleShoppingListDeleted) {
    (window as any).listsManager.handleShoppingListDeleted(data.id);
  }
}

// ============================================================================
// Reference-data handlers (FC / CC / Stores / Product Groups)
// ============================================================================

export function handleFinancialCenterCreated(data: FinancialCenterCreatedEvent): void {
  notifyHandlers('financial_center_created', data);
  callOfflineManagerUI('financial_center_created', data);
  void upsertFinancialCenterInDexie(data);
}

export function handleFinancialCenterUpdated(data: FinancialCenterUpdatedEvent): void {
  notifyHandlers('financial_center_updated', data);
  callOfflineManagerUI('financial_center_updated', data);
  void upsertFinancialCenterInDexie(data);
}

export function handleFinancialCenterDeleted(data: FinancialCenterDeletedEvent): void {
  notifyHandlers('financial_center_deleted', data);
  callOfflineManagerUI('financial_center_deleted', data);
  void deleteFinancialCenterFromDexie(data.id);
}

export function handleCostCenterCreated(data: CostCenterCreatedEvent): void {
  notifyHandlers('cost_center_created', data);
  callOfflineManagerUI('cost_center_created', data);
  void upsertCostCenterInDexie(data);
}

export function handleCostCenterUpdated(data: CostCenterUpdatedEvent): void {
  notifyHandlers('cost_center_updated', data);
  callOfflineManagerUI('cost_center_updated', data);
  void upsertCostCenterInDexie(data);
}

export function handleCostCenterDeleted(data: CostCenterDeletedEvent): void {
  notifyHandlers('cost_center_deleted', data);
  callOfflineManagerUI('cost_center_deleted', data);
  void deleteCostCenterFromDexie(data.id);
}

export function handleStoreCreated(data: StoreCreatedEvent): void {
  notifyHandlers('store_created', data);
  callOfflineManagerUI('store_created', data);
  void upsertStoreInDexie(data);
}

export function handleStoreUpdated(data: StoreUpdatedEvent): void {
  notifyHandlers('store_updated', data);
  callOfflineManagerUI('store_updated', data);
  void upsertStoreInDexie(data);
}

export function handleStoreDeleted(data: StoreDeletedEvent): void {
  notifyHandlers('store_deleted', data);
  callOfflineManagerUI('store_deleted', data);
  void deleteStoreFromDexie(data.id);
}

export function handleProductGroupCreated(data: ProductGroupCreatedEvent): void {
  notifyHandlers('product_group_created', data);
  callOfflineManagerUI('product_group_created', data);
  void upsertProductGroupInDexie(data);
}

export function handleProductGroupUpdated(data: ProductGroupUpdatedEvent): void {
  notifyHandlers('product_group_updated', data);
  callOfflineManagerUI('product_group_updated', data);
  void upsertProductGroupInDexie(data);
}

export function handleProductGroupDeleted(data: ProductGroupDeletedEvent): void {
  notifyHandlers('product_group_deleted', data);
  callOfflineManagerUI('product_group_deleted', data);
  void deleteProductGroupFromDexie(data.id);
}

/**
 * Handle generic event
 */
export function handleEvent(eventType: string, data: unknown): void {
  notifyHandlers(eventType, data);
}

/**
 * Handle sync_client_changes_response event (task-008)
 */
export async function handleSyncClientChangesResponse(
  data: SyncClientChangesResponse['data']
): Promise<void> {
  const { getUploadHandler } = await import('./uploadHandler');
  const uploadHandler = getUploadHandler();

  if (!uploadHandler) {
    debugLog('[UPLOAD] UploadHandler not initialized');
    return;
  }

  await uploadHandler.handleUploadResponse({
    event: 'sync_client_changes_response',
    data
  });
}

/**
 * Dispatch event to appropriate handler
 */
export function dispatchEvent(eventType: string, eventData: unknown): void {
  switch (eventType) {
    case 'fact_created':
      handleFactCreated(eventData as FactCreatedEvent);
      break;
    case 'fact_updated':
      handleFactUpdated(eventData as FactUpdatedEvent);
      break;
    case 'fact_deleted':
      handleFactDeleted(eventData as FactDeletedEvent);
      break;
    case 'plan_created':
      handlePlanCreated(eventData as PlanCreatedEvent);
      break;
    case 'plan_updated':
      handlePlanUpdated(eventData as PlanUpdatedEvent);
      break;
    case 'plan_deleted':
      handlePlanDeleted(eventData as PlanDeletedEvent);
      break;
    case 'transfer_created':
      handleTransferCreated(eventData as TransferCreatedEvent);
      break;
    case 'transfer_deleted':
      handleTransferDeleted(eventData as TransferDeletedEvent);
      break;
    case 'item_created':
      handleItemCreated(eventData as ItemCreatedEvent);
      break;
    case 'item_updated':
      handleItemUpdated(eventData as ItemUpdatedEvent);
      break;
    case 'item_deleted':
      handleItemDeleted(eventData as ItemDeletedEvent);
      break;
    case 'item_completed':
      handleItemCompleted(eventData as ItemCompletedEvent);
      break;
    case 'shopping_list_created':
      handleShoppingListCreated(eventData as ShoppingListCreatedEvent);
      break;
    case 'shopping_list_updated':
      handleShoppingListUpdated(eventData as ShoppingListUpdatedEvent);
      break;
    case 'shopping_list_deleted':
      handleShoppingListDeleted(eventData as ShoppingListDeletedEvent);
      break;
    case 'sync_initial':
      handleSyncInitial((eventData as SyncInitialResponse).data).catch(err => {
        debugLog('[SYNC] Failed to handle sync_initial', err);
      });
      break;
    case 'sync_incremental':
      handleSyncIncremental((eventData as SyncIncrementalResponse).data).catch(err => {
        debugLog('[SYNC] Failed to handle sync_incremental', err);
      });
      break;
    case 'sync_client_changes_response':
      handleSyncClientChangesResponse(
        (eventData as SyncClientChangesResponse).data
      ).catch(err => {
        debugLog('[UPLOAD] Failed to handle sync_client_changes_response', err);
      });
      break;
    case 'financial_center_created':
      handleFinancialCenterCreated(eventData as FinancialCenterCreatedEvent);
      break;
    case 'financial_center_updated':
      handleFinancialCenterUpdated(eventData as FinancialCenterUpdatedEvent);
      break;
    case 'financial_center_deleted':
      handleFinancialCenterDeleted(eventData as FinancialCenterDeletedEvent);
      break;
    case 'cost_center_created':
      handleCostCenterCreated(eventData as CostCenterCreatedEvent);
      break;
    case 'cost_center_updated':
      handleCostCenterUpdated(eventData as CostCenterUpdatedEvent);
      break;
    case 'cost_center_deleted':
      handleCostCenterDeleted(eventData as CostCenterDeletedEvent);
      break;
    case 'store_created':
      handleStoreCreated(eventData as StoreCreatedEvent);
      break;
    case 'store_updated':
      handleStoreUpdated(eventData as StoreUpdatedEvent);
      break;
    case 'store_deleted':
      handleStoreDeleted(eventData as StoreDeletedEvent);
      break;
    case 'product_group_created':
      handleProductGroupCreated(eventData as ProductGroupCreatedEvent);
      break;
    case 'product_group_updated':
      handleProductGroupUpdated(eventData as ProductGroupUpdatedEvent);
      break;
    case 'product_group_deleted':
      handleProductGroupDeleted(eventData as ProductGroupDeletedEvent);
      break;
    default:
      handleEvent(eventType, eventData);
  }
}

/**
 * Call offlineManager refreshUICallback
 */
function callOfflineManagerUI(event: string, data: unknown): void {
  if ((window as any).offlineManager && (window as any).offlineManager.refreshUICallback) {
    (window as any).offlineManager.refreshUICallback(event, data);
  }
}

/**
 * Call listsManager UI method
 */
function callListsManagerUI(method: string, data: unknown): void {
  if ((window as any).listsManager && typeof (window as any).listsManager[method] === 'function') {
    (window as any).listsManager[method](data);
  }
}
