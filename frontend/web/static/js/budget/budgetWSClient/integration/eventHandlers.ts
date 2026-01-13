/**
 * Event Handlers Module
 * Handles 14 WebSocket event types and integrations with offlineManager/listsManager
 *
 * Extracted from budgetWSClient.js:1786-1875 (EVENT HANDLERS)
 */

import { notifyHandlers } from './eventRegistration';

/**
 * Handle fact_created event
 */
export function handleFactCreated(data: any): void {
  notifyHandlers('fact_created', data);
  callOfflineManagerUI('fact_created', data);
}

/**
 * Handle fact_updated event
 */
export function handleFactUpdated(data: any): void {
  notifyHandlers('fact_updated', data);
  callOfflineManagerUI('fact_updated', data);
}

/**
 * Handle fact_deleted event
 */
export function handleFactDeleted(data: any): void {
  notifyHandlers('fact_deleted', data);
  callOfflineManagerUI('fact_deleted', data);
}

/**
 * Handle plan_created event
 */
export function handlePlanCreated(data: any): void {
  notifyHandlers('plan_created', data);
  callOfflineManagerUI('plan_created', data);
}

/**
 * Handle plan_updated event
 */
export function handlePlanUpdated(data: any): void {
  notifyHandlers('plan_updated', data);
  callOfflineManagerUI('plan_updated', data);
}

/**
 * Handle plan_deleted event
 */
export function handlePlanDeleted(data: any): void {
  notifyHandlers('plan_deleted', data);
  callOfflineManagerUI('plan_deleted', data);
}

/**
 * Handle transfer_created event
 */
export function handleTransferCreated(data: any): void {
  notifyHandlers('transfer_created', data);
  callOfflineManagerUI('transfer_created', data);
}

/**
 * Handle transfer_deleted event
 */
export function handleTransferDeleted(data: any): void {
  notifyHandlers('transfer_deleted', data);
  callOfflineManagerUI('transfer_deleted', data);
}

/**
 * Handle item_created event (shopping lists)
 */
export function handleItemCreated(data: any): void {
  notifyHandlers('item_created', data);
  callListsManagerUI('addItemToUI', data);
}

/**
 * Handle item_updated event (shopping lists)
 */
export function handleItemUpdated(data: any): void {
  notifyHandlers('item_updated', data);
  callListsManagerUI('updateItemInUI', data);
}

/**
 * Handle item_deleted event (shopping lists)
 */
export function handleItemDeleted(data: any): void {
  notifyHandlers('item_deleted', data);
  if ((window as any).listsManager) {
    (window as any).listsManager.removeItemFromUI(data.id, data.shopping_list_id);
  }
}

/**
 * Handle item_completed event (shopping lists)
 */
export function handleItemCompleted(data: any): void {
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
 * Handle generic event
 */
export function handleEvent(eventType: string, data: any): void {
  notifyHandlers(eventType, data);
}

/**
 * Dispatch event to appropriate handler
 */
export function dispatchEvent(eventType: string, eventData: any): void {
  switch (eventType) {
    case 'fact_created':
      handleFactCreated(eventData);
      break;
    case 'fact_updated':
      handleFactUpdated(eventData);
      break;
    case 'fact_deleted':
      handleFactDeleted(eventData);
      break;
    case 'plan_created':
      handlePlanCreated(eventData);
      break;
    case 'plan_updated':
      handlePlanUpdated(eventData);
      break;
    case 'plan_deleted':
      handlePlanDeleted(eventData);
      break;
    case 'transfer_created':
      handleTransferCreated(eventData);
      break;
    case 'transfer_deleted':
      handleTransferDeleted(eventData);
      break;
    case 'item_created':
      handleItemCreated(eventData);
      break;
    case 'item_updated':
      handleItemUpdated(eventData);
      break;
    case 'item_deleted':
      handleItemDeleted(eventData);
      break;
    case 'item_completed':
      handleItemCompleted(eventData);
      break;
    default:
      handleEvent(eventType, eventData);
  }
}

/**
 * Call offlineManager refreshUICallback
 */
function callOfflineManagerUI(event: string, data: any): void {
  if ((window as any).offlineManager && (window as any).offlineManager.refreshUICallback) {
    (window as any).offlineManager.refreshUICallback(event, data);
  }
}

/**
 * Call listsManager UI method
 */
function callListsManagerUI(method: string, data: any): void {
  if ((window as any).listsManager && typeof (window as any).listsManager[method] === 'function') {
    (window as any).listsManager[method](data);
  }
}
