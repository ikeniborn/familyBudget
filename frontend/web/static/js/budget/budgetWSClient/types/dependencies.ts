/**
 * Dependency Injection interfaces for BudgetWSClient
 * ZERO DEPENDENCIES - Pure type definitions
 *
 * This module contains ONLY type definitions for external dependencies.
 * NO imports, NO business logic.
 */

export {}; // Force module scope

/**
 * Logger interface
 * Provides console-like logging functionality
 */
export interface ILogger {
  /**
   * Log informational messages
   */
  info(...args: any[]): void;

  /**
   * Log warning messages
   */
  warn(...args: any[]): void;

  /**
   * Log error messages
   */
  error(...args: any[]): void;

  /**
   * Log debug messages
   */
  debug(...args: any[]): void;
}

/**
 * Offline Manager interface
 * Provides UI refresh callbacks and network detection
 */
export interface IOfflineManager {
  /**
   * UI refresh callback for real-time updates
   * @param event - Event type (fact_created, fact_updated, etc.)
   * @param data - Event data
   */
  refreshUICallback?: (event: string, data: any) => void;

  /**
   * Network detector for auto-offline mode detection
   */
  networkDetector?: {
    autoOfflineMode: boolean;
  };
}

/**
 * Lists Manager interface
 * Provides shopping list UI update methods
 */
export interface IListsManager {
  /**
   * Add item to UI
   * @param data - Item data
   */
  addItemToUI(data: ShoppingItemData): void;

  /**
   * Update item in UI
   * @param data - Item data
   */
  updateItemInUI(data: ShoppingItemData): void;

  /**
   * Remove item from UI
   * @param itemId - Item ID
   * @param listId - Shopping list ID
   */
  removeItemFromUI(itemId: number, listId: number): void;

  /**
   * Toggle item completed status in UI
   * @param itemId - Item ID
   * @param isCompleted - Completion status
   * @param listId - Shopping list ID
   */
  toggleItemCompletedInUI(itemId: number, isCompleted: boolean, listId: number): void;
}

/**
 * Shopping Item Data
 * Represents a shopping list item from WebSocket event
 */
export interface ShoppingItemData {
  id: number;
  shopping_list_id: number;
  product_name: string;
  quantity?: number;
  unit?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}
