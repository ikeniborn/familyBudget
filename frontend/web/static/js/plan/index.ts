/**
 * Plan Page Entry Point
 * Main module for plan.html page initialization and public API
 *
 * @module plan
 * @version 1.0.0 (Phase 1)
 * @description Entry point for plan page modularization (Phase 1: Helpers + Filters)
 */

// Import all plan modules
import * as PlanHelpers from './helpers';
import * as PlanFilters from './filters';

// Re-export modules for external use
export { PlanHelpers, PlanFilters };

// ============================================================================
// Global Window Interface
// ============================================================================

/**
 * Global PlanApp interface exposed to window object
 * Allows inline onclick handlers and external scripts to access plan functionality
 */
interface PlanAppGlobal {
  // Initialization
  initialize: () => Promise<void>;

  // Modules
  Helpers: typeof PlanHelpers;
  Filters: typeof PlanFilters;

  // Filter Actions (exposed for onclick handlers)
  applyFilters: () => Promise<void>;
  resetFilters: () => Promise<void>;
  collapseFilters: () => void;
}

declare global {
  interface Window {
    PlanApp: PlanAppGlobal;
  }
}

// ============================================================================
// Page Initialization
// ============================================================================

/**
 * Initialize plan page
 * Called on DOMContentLoaded from inline script
 */
export async function initialize(): Promise<void> {
  console.log('[PLAN] Initializing plan page (Phase 1: Helpers + Filters)...');

  try {
    // Initialize default period filter UI
    PlanFilters.initDefaultPeriodFilter();

    // Load dropdown data
    console.log('[PLAN] Loading dropdown data...');
    await Promise.all([
      loadUsersDropdown(),
      loadArticlesDropdown(),
      loadFinancialCentersDropdown(),
      loadCostCentersDropdown()
    ]);

    // Apply filters and load initial data
    console.log('[PLAN] Applying initial filters...');
    await applyFiltersAndLoadData();

    // Update filter indicator
    PlanFilters.updateFilterIndicator();

    console.log('[PLAN] ✅ Plan page initialized successfully');
  } catch (error) {
    console.error('[PLAN] ❌ Error initializing plan page:', error);
    PlanHelpers.showNotification('Ошибка инициализации страницы: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Dropdown Population Helpers
// ============================================================================

/**
 * Load users and populate filter dropdown
 */
async function loadUsersDropdown(): Promise<void> {
  try {
    const users = await PlanHelpers.loadUsers();
    const select = document.getElementById('filter-user') as HTMLSelectElement | null;

    if (!select) {
      console.warn('[PLAN] User dropdown not found');
      return;
    }

    users.forEach(user => {
      const option = document.createElement('option');
      option.value = String(user.id);
      option.textContent = user.username || user.first_name || `User ${user.telegram_id}`;
      select.appendChild(option);
    });

    console.log(`[PLAN] Loaded ${users.length} users`);
  } catch (error) {
    console.error('[PLAN] Error loading users:', error);
  }
}

/**
 * Group articles by type while preserving hierarchical order
 *
 * @param flatNodes - Flattened article tree nodes
 * @returns Articles sorted by type (expense → income → debit → credit)
 */
function groupArticlesByType(flatNodes: PlanHelpers.FlatArticle[]): PlanHelpers.FlatArticle[] {
  const groupedByType: Record<string, PlanHelpers.FlatArticle[]> = {
    'expense': [],
    'income': [],
    'debit': [],
    'credit': []
  };

  flatNodes.forEach(node => {
    if (groupedByType[node.type]) {
      groupedByType[node.type].push(node);
    }
  });

  // Flatten back in type order: expense → income → debit → credit
  return [
    ...groupedByType['expense'],
    ...groupedByType['income'],
    ...groupedByType['debit'],
    ...groupedByType['credit']
  ];
}

/**
 * Create article option element with styling and metadata
 *
 * @param node - Article node data
 * @returns Configured option element
 */
function createArticleOption(node: PlanHelpers.FlatArticle): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = String(node.id);

  // Simplified indentation: use single symbol per level
  const indent = '›  '.repeat(node.level);
  const icon = node.isLeaf ? '▸' : '📂';
  option.textContent = `${indent}${icon} ${node.name}`;

  // Add data-type attribute for category filter colors
  if (node.type) {
    option.dataset.type = node.type;
  }

  // Color coding by article type
  const colorMap: Record<string, string> = {
    'expense': 'rgb(239, 68, 68)', // Red (DaisyUI error)
    'income': 'rgb(34, 197, 94)', // Green (DaisyUI success)
    'debit': 'rgb(59, 130, 246)', // Blue (DaisyUI info)
    'credit': 'rgb(251, 146, 60)' // Orange (DaisyUI warning)
  };
  if (colorMap[node.type]) {
    option.style.color = colorMap[node.type];
  }

  // Disable parent categories with visual styling
  if (!node.isLeaf) {
    option.disabled = true;
    option.classList.add('category-parent');
    option.style.fontWeight = 'bold';
    option.style.opacity = '0.7';
  } else {
    option.classList.add('category-leaf');
  }

  return option;
}

/**
 * Load articles and populate filter dropdown with tree structure
 */
async function loadArticlesDropdown(): Promise<void> {
  try {
    const articles = await PlanHelpers.loadArticles();
    const tree = PlanHelpers.buildArticleTree(articles);
    const flatNodes = PlanHelpers.flattenArticleTree(tree);
    const sortedNodes = groupArticlesByType(flatNodes);

    // Populate filter dropdown
    const filterSelect = document.getElementById('filter-article') as HTMLSelectElement | null;

    if (!filterSelect) {
      console.warn('[PLAN] Article dropdown not found');
      return;
    }

    sortedNodes.forEach(node => {
      const option = createArticleOption(node);
      filterSelect.appendChild(option);
    });

    console.log(`[PLAN] Loaded ${sortedNodes.length} articles (${articles.length} total)`);
  } catch (error) {
    console.error('[PLAN] Error loading articles:', error);
  }
}

/**
 * Load financial centers and populate filter dropdown
 */
async function loadFinancialCentersDropdown(): Promise<void> {
  try {
    const centers = await PlanHelpers.loadFinancialCenters();
    const filterSelect = document.getElementById('filter-financial-center') as HTMLSelectElement | null;

    if (!filterSelect) {
      console.warn('[PLAN] Financial center dropdown not found');
      return;
    }

    centers.forEach(center => {
      const option = document.createElement('option');
      option.value = String(center.id);
      option.textContent = center.name;
      filterSelect.appendChild(option);
    });

    console.log(`[PLAN] Loaded ${centers.length} financial centers`);
  } catch (error) {
    console.error('[PLAN] Error loading financial centers:', error);
    PlanHelpers.showToast('Ошибка загрузки счетов: ' + (error as Error).message, 'error');
  }
}

/**
 * Load cost centers and populate filter dropdown
 */
async function loadCostCentersDropdown(): Promise<void> {
  try {
    const centers = await PlanHelpers.loadCostCenters();
    const filterSelect = document.getElementById('filter-cost-center') as HTMLSelectElement | null;

    if (!filterSelect) {
      console.warn('[PLAN] Cost center dropdown not found');
      return;
    }

    centers.forEach(center => {
      const option = document.createElement('option');
      option.value = String(center.id);
      option.textContent = center.name;
      filterSelect.appendChild(option);
    });

    console.log(`[PLAN] Loaded ${centers.length} cost centers`);
  } catch (error) {
    console.error('[PLAN] Error loading cost centers:', error);
    PlanHelpers.showToast('Ошибка загрузки мест затрат: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Filter Actions (exposed to window for onclick handlers)
// ============================================================================

/**
 * Apply filters and reload facts table
 * Wrapper that calls PlanFilters.applyFilters() and handles data reload
 */
export async function applyFiltersAndLoadData(): Promise<void> {
  try {
    // Apply filters (reads from UI, updates state)
    await PlanFilters.applyFilters();

    // TODO Phase 2: Call loadFacts() from PlanFactsTable module
    // TODO Phase 2: Call syncFiltersToAnalytics() from FilterAnalyticsSync module
    console.log('[PLAN] Filters applied (data reload pending - Phase 2)');

    // TEMPORARY: Call global functions if they exist (backward compatibility)
    if (typeof (window as any).loadFacts === 'function') {
      console.log('[PLAN] Calling global loadFacts() (backward compatibility)');
      await (window as any).loadFacts();
    }

    if (typeof (window as any).syncFiltersToAnalytics === 'function') {
      console.log('[PLAN] Calling global syncFiltersToAnalytics() (backward compatibility)');
      await (window as any).syncFiltersToAnalytics();
    }
  } catch (error) {
    console.error('[PLAN] Error applying filters:', error);
    PlanHelpers.showNotification('Ошибка применения фильтров: ' + (error as Error).message, 'error');
  }
}

/**
 * Reset filters and reload facts table
 * Wrapper that calls PlanFilters.resetFilters() and handles data reload
 */
export async function resetFiltersAndLoadData(): Promise<void> {
  try {
    // Reset filters (clears UI, restores defaults)
    await PlanFilters.resetFilters();

    // TODO Phase 2: Call loadFacts() from PlanFactsTable module
    // TODO Phase 2: Call syncFiltersToAnalytics() from FilterAnalyticsSync module
    console.log('[PLAN] Filters reset (data reload pending - Phase 2)');

    // TEMPORARY: Call global functions if they exist (backward compatibility)
    if (typeof (window as any).loadFacts === 'function') {
      console.log('[PLAN] Calling global loadFacts() (backward compatibility)');
      await (window as any).loadFacts();
    }

    if (typeof (window as any).syncFiltersToAnalytics === 'function') {
      console.log('[PLAN] Calling global syncFiltersToAnalytics() (backward compatibility)');
      await (window as any).syncFiltersToAnalytics();
    }
  } catch (error) {
    console.error('[PLAN] Error resetting filters:', error);
    PlanHelpers.showNotification('Ошибка сброса фильтров: ' + (error as Error).message, 'error');
  }
}

/**
 * Collapse filter section
 */
export function collapseFiltersAction(): void {
  PlanFilters.collapseFilters();
}

// ============================================================================
// Expose to Window Object
// ============================================================================

/**
 * Expose PlanApp to global window object
 * Allows inline onclick handlers to call: window.PlanApp.applyFilters()
 */
window.PlanApp = {
  // Initialization
  initialize,

  // Modules
  Helpers: PlanHelpers,
  Filters: PlanFilters,

  // Actions (for onclick handlers)
  applyFilters: applyFiltersAndLoadData,
  resetFilters: resetFiltersAndLoadData,
  collapseFilters: collapseFiltersAction
};

console.log('[PLAN] PlanApp exposed to window object');
