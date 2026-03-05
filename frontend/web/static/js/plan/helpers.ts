/**
 * Plan Helpers Module
 * Pure utility functions for plan.html with zero dependencies
 *
 * @module plan/helpers
 * @version 1.0.0
 * @description Utilities for data loading, article tree building, formatting, and notifications
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Article (budget category) entity from API
 */
export interface Article {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'debit' | 'credit';
  parent_id: number | null;
  is_leaf: boolean;
  financial_center_id?: number | null;
}

/**
 * User entity from API
 */
export interface User {
  id: number;
  username: string;
  first_name?: string;
  telegram_id?: string;
  full_name?: string;
}

/**
 * Financial Center (account) entity from API
 */
export interface FinancialCenter {
  id: number;
  name: string;
  is_global?: boolean;
}

/**
 * Cost Center entity from API
 */
export interface CostCenter {
  id: number;
  name: string;
  financial_center_id: number | null;
  is_global?: boolean;
}

/**
 * Article tree node with hierarchical level and children
 */
export interface ArticleNode extends Article {
  level: number;
  children: ArticleNode[];
  isLeaf: boolean;
}

/**
 * Flattened article node for rendering (preserves hierarchical order)
 */
export interface FlatArticle extends Article {
  level: number;
  isLeaf: boolean;
}

/**
 * Reminder status badge configuration
 */
export interface ReminderStatusBadge {
  text: string;
  class: string;
}

/**
 * Budget fact (plan/fact record) entity from API
 * Consolidated interface used across all plan modules
 */
export interface BudgetFact {
  id: number;
  fact_date: string; // YYYY-MM-DD
  financial_center_id: number;
  financial_center_name: string;
  cost_center_id: number | null;
  cost_center_name: string | null;
  article_id: number;
  article_name: string;
  article_type: 'expense' | 'income' | 'debit' | 'credit';
  amount: number;
  description: string | null;
  user_id: number;
  user_name: string;
  record_type: 'plan' | 'fact' | string;
  recurring_plan_id: number | null;
  is_offline_sync?: boolean;
  is_template?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Reminder entity for facts
 */
export interface Reminder {
  id: number;
  fact_id: number;
  remind_at: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
}

/**
 * Recurring plan entity from API
 */
export interface RecurringPlan {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string | null;
  financial_center_id: number;
  cost_center_id: number | null;
  article_id: number;
  amount: number;
  description: string | null;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  frequency_value: number;
  duration_type: 'indefinite' | 'until_date' | 'count';
  duration_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Analytics filters state
 */
export interface AnalyticsFilters {
  month: string; // YYYY-MM
  financial_center_id: number | null;
  article_type: string | null;
  article_id: number | null;
}

/**
 * Pagination state
 */
export interface PaginationState {
  currentPage: number; // 0-indexed
  pageSize: number;
  totalRecords: number;
}

/**
 * API response wrapper for lists
 */
export interface APIListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Imports
// ============================================================================

import { dataLayer } from '../data/DataLayer';
import { getCurrentUserId } from '@shared/utils/userHelpers';

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Load users from API
 * @returns Promise with array of users
 * @throws Error if API request fails
 */
export async function loadUsers(): Promise<User[]> {
  try {
    const response = await fetch('/api/v1/users');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Backend returns UserListResponse: {users: [...], total, limit, offset}
    const users = data.users || data; // Support both new and old format

    return users;
  } catch (error) {
    console.error('[PlanHelpers] Error loading users:', error);
    throw error;
  }
}

/**
 * Load articles (budget categories) from API
 * @returns Promise with array of articles
 * @throws Error if API request fails
 */
export async function loadArticles(): Promise<Article[]> {
  try {
    // Use DataLayer (Dexie-first with API fallback)
    const articles = await dataLayer.getArticles() as unknown as Article[];
    return articles;
  } catch (error) {
    console.error('[PlanHelpers] Error loading articles:', error);
    throw error;
  }
}

/**
 * Load financial centers (accounts) from API
 * @param includeGlobal - Include global financial centers (default: true)
 * @returns Promise with array of financial centers
 * @throws Error if API request fails
 */
export async function loadFinancialCenters(
  includeGlobal: boolean = true
): Promise<FinancialCenter[]> {
  try {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (Dexie-first with API fallback)
    const centers = await dataLayer.getFinancialCenters(userId, includeGlobal) as unknown as FinancialCenter[];
    return centers;
  } catch (error) {
    console.error('[PlanHelpers] Error loading financial centers:', error);
    throw error;
  }
}

/**
 * Load cost centers from API
 * @param includeGlobal - Include global cost centers (default: true)
 * @returns Promise with array of cost centers
 * @throws Error if API request fails
 */
export async function loadCostCenters(
  includeGlobal: boolean = true
): Promise<CostCenter[]> {
  try {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (Dexie-first with API fallback)
    const centers = await dataLayer.getCostCenters(userId, null, includeGlobal) as unknown as CostCenter[];

    return centers;
  } catch (error) {
    console.error('[PlanHelpers] Error loading cost centers:', error);
    throw error;
  }
}

// ============================================================================
// Article Tree Functions
// ============================================================================

/**
 * Build hierarchical article tree from flat array
 * Sorts articles alphabetically and preserves parent-child relationships
 *
 * @param articles - Flat array of articles from API
 * @returns Array of root article nodes with nested children
 *
 * @example
 * const articles = [
 *   {id: 1, name: 'Food', parent_id: null, type: 'expense', is_leaf: false},
 *   {id: 2, name: 'Groceries', parent_id: 1, type: 'expense', is_leaf: true}
 * ];
 * const tree = buildArticleTree(articles);
 * // => [{id: 1, name: 'Food', level: 0, children: [{id: 2, name: 'Groceries', level: 1, children: []}]}]
 */
export function buildArticleTree(articles: Article[]): ArticleNode[] {
  // Sort all articles alphabetically for proper hierarchy sorting
  const sortedArticles = [...articles].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const roots = sortedArticles.filter(a => !a.parent_id);

  function buildNode(article: Article, level: number = 0): ArticleNode {
    const children = sortedArticles
      .filter(a => a.parent_id === article.id)
      .map(child => buildNode(child, level + 1));

    return {
      ...article,
      level,
      children,
      isLeaf: children.length === 0
    };
  }

  return roots.map(root => buildNode(root));
}

/**
 * Flatten article tree to linear array preserving hierarchical order
 * Depth-first traversal maintains parent → children order
 *
 * @param nodes - Array of article tree nodes
 * @returns Flattened array of articles with level preserved
 *
 * @example
 * const tree = [{id: 1, name: 'Food', level: 0, children: [{id: 2, name: 'Groceries', level: 1, children: []}]}];
 * const flat = flattenArticleTree(tree);
 * // => [{id: 1, name: 'Food', level: 0}, {id: 2, name: 'Groceries', level: 1}]
 */
export function flattenArticleTree(nodes: ArticleNode[]): FlatArticle[] {
  const result: FlatArticle[] = [];

  function traverse(node: ArticleNode) {
    result.push({
      id: node.id,
      name: node.name,
      type: node.type,
      parent_id: node.parent_id,
      is_leaf: node.is_leaf,
      level: node.level,
      isLeaf: node.isLeaf,
      financial_center_id: node.financial_center_id
    });

    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return result;
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Get CSS class for mobile amount display based on article type
 * @param type - Article type ('expense', 'income', 'debit', 'credit')
 * @returns CSS class name for color coding
 */
// Removed duplicate functions - use TableFormatters from shared/tableUtils.ts instead:
// - getMobileAmountClass() → TableFormatters.getArticleColorClass(type, 'amount')
// - formatMobileAmount() → TableFormatters.formatAmount(amount, type)
// - formatDesktopAmount() → TableFormatters.formatAmount(amount, type)

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Update toast container position based on viewport width
 * Desktop: top-right corner, Mobile: center
 *
 * @param container - Toast container element
 */
function updateToastPosition(container: HTMLElement): void {
  if (window.innerWidth > 768) {
    // Desktop: правый верхний угол с отступами (учитываем высоту навбара)
    container.style.top = '80px';
    container.style.right = '20px';
    container.style.left = 'auto';
    container.style.transform = 'none';
  } else {
    // Mobile: центр экрана
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.right = 'auto';
    container.style.transform = 'translate(-50%, -50%)';
  }
}

/**
 * Get or create toast container element
 * Creates container if it doesn't exist and sets up resize listener
 *
 * @returns Toast container element
 */
function getOrCreateToastContainer(): HTMLElement {
  let toastContainer = document.getElementById('toast-container');

  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    document.body.appendChild(toastContainer);

    // Update position on window resize
    window.addEventListener('resize', () => updateToastPosition(toastContainer!));
  }

  return toastContainer;
}

/**
 * Create toast element with message and type
 *
 * @param messageText - Message to display
 * @param type - Toast type for styling
 * @returns Toast element
 */
function createToastElement(
  messageText: string,
  type: 'success' | 'error' | 'info' | 'warning'
): HTMLElement {
  const toast = document.createElement('div');
  const alertClass =
    type === 'error'
      ? 'alert-error'
      : type === 'success'
      ? 'alert-success'
      : type === 'warning'
      ? 'alert-warning'
      : 'alert-info';

  toast.className = `alert ${alertClass} shadow-lg max-w-md`;

  // Use DOM API instead of innerHTML for security
  const wrapper = document.createElement('div');
  const span = document.createElement('span');
  span.textContent = messageText;
  wrapper.appendChild(span);
  toast.appendChild(wrapper);

  return toast;
}

/**
 * Extract message text from various message types
 *
 * @param message - Message in various formats
 * @returns Extracted text message
 */
function extractMessageText(
  message: string | Error | { detail?: string; message?: string }
): string {
  if (typeof message === 'object' && message !== null) {
    if (message instanceof Error) {
      return message.message;
    }
    return message.detail || message.message || JSON.stringify(message);
  }
  return message;
}

/**
 * Show responsive toast notification
 * Desktop: top-right corner, Mobile: center
 *
 * @param message - Notification message (string or error object)
 * @param type - Notification type ('success' | 'error' | 'info' | 'warning')
 */
export function showNotification(
  message: string | Error | { detail?: string; message?: string },
  type: 'success' | 'error' | 'info' | 'warning' = 'info'
): void {
  const messageText = extractMessageText(message);
  const toastContainer = getOrCreateToastContainer();

  // Update position
  updateToastPosition(toastContainer);

  // Create and append toast
  const toast = createToastElement(messageText, type);
  toastContainer.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.remove();
    // Remove container if empty
    if (toastContainer.children.length === 0) {
      toastContainer.remove();
    }
  }, 3000);
}

/**
 * Simple toast notification helper (lightweight version)
 * @param message - Notification message
 * @param type - Alert type ('info' | 'success' | 'error' | 'warning')
 */
export function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} fixed top-4 right-4 w-96 z-[100] shadow-lg`;

  // Use DOM API instead of innerHTML for security
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============================================================================
// Reminder Functions
// ============================================================================

/**
 * Get reminder status badge configuration
 * @param status - Reminder status ('pending' | 'sent' | 'failed' | 'cancelled')
 * @returns Badge configuration with text and CSS class
 */
export function getReminderStatusBadge(status: string): ReminderStatusBadge {
  const statusMap: Record<string, ReminderStatusBadge> = {
    'pending': { text: 'Ожидает', class: 'badge-info' },
    'sent': { text: 'Отправлено', class: 'badge-success' },
    'failed': { text: 'Ошибка', class: 'badge-error' },
    'cancelled': { text: 'Отменено', class: 'badge-ghost' }
  };
  return statusMap[status] || { text: status, class: 'badge-ghost' };
}
