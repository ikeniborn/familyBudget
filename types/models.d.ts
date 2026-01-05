/**
 * Core Data Models
 * Family Budget PWA
 *
 * Shared types for BudgetFact, Transfer, Article, etc.
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

/**
 * User model
 */
interface User {
  id: number;
  email?: string | null;
  telegram_id?: number | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_admin: boolean;
  notification_preferences?: NotificationPreferences | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Notification preferences
 */
interface NotificationPreferences {
  web_push_enabled: boolean;
  telegram_enabled: boolean;
}

/**
 * Budget transaction (fact)
 */
interface BudgetFact {
  id?: number;
  tempId?: string;
  user_id: number;
  article_id: number;
  financial_center_id?: number | null;
  cost_center_id?: number | null;
  amount: number;
  fact_date: string; // YYYY-MM-DD
  comment?: string | null;
  record_type: 'income' | 'expense';
  transfer_id?: string | null;
  sync_hash?: string | null;
  content_hash?: string | null;
  synced?: boolean;
  is_synced?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Transfer between accounts
 */
interface Transfer {
  id?: string;
  tempId?: string;
  user_id: number;
  from_financial_center_id: number;
  to_financial_center_id: number;
  amount: number;
  transfer_date: string; // YYYY-MM-DD
  comment?: string | null;
  sync_hash?: string | null;
  synced?: boolean;
  is_synced?: boolean;
  created_at?: string;
}

/**
 * Budget category (hierarchical)
 */
interface Article {
  id: number;
  name: string;
  article_type: 'income' | 'expense';
  parent_id?: number | null;
  user_id?: number;
  icon?: string | null;
  color?: string | null;
  is_active: boolean;
  depth?: number;
  path?: string | null;
  children?: Article[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Financial center (account, wallet)
 */
interface FinancialCenter {
  id: number;
  name: string;
  user_id: number;
  center_type?: string | null;
  initial_balance?: number;
  current_balance?: number;
  is_active: boolean;
  currency?: string | null;
  icon?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Cost center (project, department)
 */
interface CostCenter {
  id: number;
  name: string;
  user_id: number;
  is_active: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Recurring payment plan
 */
interface RecurringPlan {
  id?: number;
  tempId?: string;
  user_id: number;
  article_id: number;
  financial_center_id?: number | null;
  cost_center_id?: number | null;
  amount: number;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value?: number | null; // MMDD for yearly (e.g., 315 = March 15)
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  comment?: string | null;
  is_active: boolean;
  last_execution_date?: string | null;
  synced?: boolean;
  is_synced?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Shopping list
 */
interface ShoppingList {
  id?: number;
  tempId?: string;
  user_id: number;
  name: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
  is_synced?: boolean;
}

/**
 * Shopping list item
 */
interface ShoppingListItem {
  id?: number;
  tempId?: string;
  shopping_list_id: number;
  product_name: string;
  quantity?: number | null;
  unit?: string | null;
  is_checked: boolean;
  store_id?: number | null;
  product_group_id?: number | null;
  comment?: string | null;
  synced?: boolean;
  is_synced?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Store (shop location)
 */
interface Store {
  id: number;
  name: string;
  user_id: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Product Group (category for shopping items)
 */
interface ProductGroup {
  id: number;
  name: string;
  parent_id?: number | null;
  user_id: number;
  icon?: string | null;
  color?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Conflict resolution data
 */
interface ConflictData {
  localVersion: any;
  serverVersion: any;
  entityType: 'fact' | 'transfer' | 'plan' | 'list' | 'item';
  tempId: string;
}
