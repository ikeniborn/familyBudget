/**
 * Event Handlers Module
 * Handles WebSocket event types and integration with listsManager
 *
 * Extracted from budgetWSClient.js:1786-1875 (EVENT HANDLERS)
 */

// Global debugLog function (declared in index.html)
declare const debugLog: (...args: any[]) => void;

import { notifyHandlers } from './eventRegistration';
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
} from '../types/events';

/**
 * Handle fact_created event
 */
export function handleFactCreated(data: FactCreatedEvent): void {
  notifyHandlers('fact_created', data);
}

/**
 * Handle fact_updated event
 */
export function handleFactUpdated(data: FactUpdatedEvent): void {
  notifyHandlers('fact_updated', data);
}

/**
 * Handle fact_deleted event
 */
export function handleFactDeleted(data: FactDeletedEvent): void {
  notifyHandlers('fact_deleted', data);
}

/**
 * Handle plan_created event
 */
export function handlePlanCreated(data: PlanCreatedEvent): void {
  notifyHandlers('plan_created', data);
}

/**
 * Handle plan_updated event
 */
export function handlePlanUpdated(data: PlanUpdatedEvent): void {
  notifyHandlers('plan_updated', data);
}

/**
 * Handle plan_deleted event
 */
export function handlePlanDeleted(data: PlanDeletedEvent): void {
  notifyHandlers('plan_deleted', data);
}

/**
 * Handle transfer_created event
 */
export function handleTransferCreated(data: TransferCreatedEvent): void {
  notifyHandlers('transfer_created', data);
}

/**
 * Handle transfer_deleted event
 */
export function handleTransferDeleted(data: TransferDeletedEvent): void {
  notifyHandlers('transfer_deleted', data);
}

/**
 * Handle item_created event (shopping lists)
 */
export function handleItemCreated(data: ItemCreatedEvent): void {
  notifyHandlers('item_created', data);
  callListsManagerUI('addItemToUI', data);
}

/**
 * Handle item_updated event (shopping lists)
 */
export function handleItemUpdated(data: ItemUpdatedEvent): void {
  notifyHandlers('item_updated', data);
  callListsManagerUI('updateItemInUI', data);
}

/**
 * Handle item_deleted event (shopping lists)
 */
export function handleItemDeleted(data: ItemDeletedEvent): void {
  notifyHandlers('item_deleted', data);
  if ((window as any).listsManager) {
    (window as any).listsManager.removeItemFromUI(data.id, data.shopping_list_id);
  }
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
}

export function handleFinancialCenterUpdated(data: FinancialCenterUpdatedEvent): void {
  notifyHandlers('financial_center_updated', data);
}

export function handleFinancialCenterDeleted(data: FinancialCenterDeletedEvent): void {
  notifyHandlers('financial_center_deleted', data);
}

export function handleCostCenterCreated(data: CostCenterCreatedEvent): void {
  notifyHandlers('cost_center_created', data);
}

export function handleCostCenterUpdated(data: CostCenterUpdatedEvent): void {
  notifyHandlers('cost_center_updated', data);
}

export function handleCostCenterDeleted(data: CostCenterDeletedEvent): void {
  notifyHandlers('cost_center_deleted', data);
}

export function handleStoreCreated(data: StoreCreatedEvent): void {
  notifyHandlers('store_created', data);
}

export function handleStoreUpdated(data: StoreUpdatedEvent): void {
  notifyHandlers('store_updated', data);
}

export function handleStoreDeleted(data: StoreDeletedEvent): void {
  notifyHandlers('store_deleted', data);
}

export function handleProductGroupCreated(data: ProductGroupCreatedEvent): void {
  notifyHandlers('product_group_created', data);
}

export function handleProductGroupUpdated(data: ProductGroupUpdatedEvent): void {
  notifyHandlers('product_group_updated', data);
}

export function handleProductGroupDeleted(data: ProductGroupDeletedEvent): void {
  notifyHandlers('product_group_deleted', data);
}

/**
 * Handle generic event
 */
export function handleEvent(eventType: string, data: unknown): void {
  notifyHandlers(eventType, data);
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
 * Call listsManager UI method
 */
function callListsManagerUI(method: string, data: unknown): void {
  if ((window as any).listsManager && typeof (window as any).listsManager[method] === 'function') {
    (window as any).listsManager[method](data);
  }
}
