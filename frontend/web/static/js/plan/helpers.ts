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
    const response = await fetch('/api/v1/articles');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    return articles;
  } catch (error) {
    console.error('[PlanHelpers] Error loading articles:', error);
    throw error;
  }
}

/**
 * Load financial centers (accounts) from API
 * @param includeGlobal - Include global financial centers (default: true)
 * @param limit - Maximum number of records to fetch (default: 1000)
 * @returns Promise with array of financial centers
 * @throws Error if API request fails
 */
export async function loadFinancialCenters(
  includeGlobal: boolean = true,
  limit: number = 1000
): Promise<FinancialCenter[]> {
  try {
    const url = `/api/v1/financial-centers?limit=${limit}&include_global=${includeGlobal}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const centers = data.financial_centers || [];

    return centers;
  } catch (error) {
    console.error('[PlanHelpers] Error loading financial centers:', error);
    throw error;
  }
}

/**
 * Load cost centers from API
 * @param includeGlobal - Include global cost centers (default: true)
 * @param limit - Maximum number of records to fetch (default: 1000)
 * @returns Promise with array of cost centers
 * @throws Error if API request fails
 */
export async function loadCostCenters(
  includeGlobal: boolean = true,
  limit: number = 1000
): Promise<CostCenter[]> {
  try {
    const url = `/api/v1/cost-centers?limit=${limit}&include_global=${includeGlobal}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const centers = data.cost_centers || [];

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
export function getMobileAmountClass(type: string): string {
  const colorMap: Record<string, string> = {
    'expense': 'amount-expense',
    'income': 'amount-income',
    'debit': 'amount-debit',
    'credit': 'amount-credit'
  };
  return colorMap[type] || 'amount-expense';
}

/**
 * Format amount with sign for mobile view (compact display without currency symbol)
 * @param amount - Numeric amount to format
 * @param type - Article type for determining sign
 * @returns Formatted string like "+1000" or "-1000"
 */
export function formatMobileAmount(amount: number, type: string): string {
  const value = parseFloat(String(amount)).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const sign = (type === 'income' || type === 'credit') ? '+' : '-';
  return `${sign}${value}`;
}

/**
 * Format amount with sign for desktop view
 * @param amount - Numeric amount to format
 * @param type - Article type for determining sign
 * @returns Formatted string like "+1000" or "-1000"
 */
export function formatDesktopAmount(amount: number, type: string): string {
  const value = parseFloat(String(amount)).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const sign = (type === 'income' || type === 'credit') ? '+' : '-';
  return `${sign}${value}`;
}

// ============================================================================
// Notification Functions
// ============================================================================

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
  // Handle error objects properly
  let messageText: string;
  if (typeof message === 'object' && message !== null) {
    if (message instanceof Error) {
      messageText = message.message;
    } else {
      messageText = message.detail || message.message || JSON.stringify(message);
    }
  } else {
    messageText = message;
  }

  // Responsive positioning function (extracted for reuse)
  const updatePosition = (container: HTMLElement) => {
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
  };

  // Create toast container if it doesn't exist
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
    window.addEventListener('resize', () => updatePosition(toastContainer!));
  }

  // Update position initially
  updatePosition(toastContainer);

  // Create toast element
  const toast = document.createElement('div');
  const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : type === 'warning' ? 'alert-warning' : 'alert-info';
  toast.className = `alert ${alertClass} shadow-lg max-w-md`;
  toast.innerHTML = `
    <div>
      <span>${messageText}</span>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.remove();
    // Remove container if empty
    if (toastContainer && toastContainer.children.length === 0) {
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
  toast.innerHTML = `
    <span>${message}</span>
  `;
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
