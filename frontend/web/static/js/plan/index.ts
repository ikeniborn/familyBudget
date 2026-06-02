/**
 * Plan Page Entry Point
 * Main module for plan.html page initialization and public API
 *
 * @module plan
 * @version 3.2.0 (Phase 3: Week 4 - Complex Modals)
 * @description Entry point for plan page modularization (Phase 3: Week 4 - modals + helpers)
 */

// Import all plan modules
import * as PlanHelpers from './helpers';
import * as PlanFilters from './filters';
import * as PlanFactsTable from './factsTable';
import * as PlanAnalytics from './analytics';
import * as FilterAnalyticsSync from './filterAnalyticsSync';
import * as PlanCRUD from './crud';
import { setupEventDelegation } from './adapters/eventDelegation';
import { setupWindowExports } from './adapters/windowExports';
import { registerWSHandlers } from './wsEventHandlers';
import { savePlanTransfer } from '../dashboard/features/modalPlan/saveTransfer';
import { syncPlanPeriodFromActive } from '../dashboard/features/addPlan/periodButtons';
import { setButtonLoading } from '../dashboard/shared/utils/buttonState';
import { APIError } from '../dashboard/shared/utils/apiHelpers';
import { getDexieManager } from '@db/dexie';

// Logger из utils/logger.js (загружается глобально через bundle)
declare class Logger {
  constructor(prefix: string, moduleKey: string);
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

const log = new Logger('[PLAN]', 'PLAN');

// Re-export modules for external use
export { PlanHelpers, PlanFilters, PlanFactsTable, PlanAnalytics, FilterAnalyticsSync, PlanCRUD };

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
  FactsTable: typeof PlanFactsTable;
  Analytics: typeof PlanAnalytics;
  FilterAnalyticsSync: typeof FilterAnalyticsSync;
  CRUD: typeof PlanCRUD;

  // Filter Actions (exposed for onclick handlers)
  applyFilters: () => Promise<void>;
  resetFilters: () => Promise<void>;
  collapseFilters: () => void;

  // Facts Table Actions (exposed for onclick handlers)
  loadFacts: () => Promise<void>;
  loadMoreFacts: () => Promise<void>;

  // Analytics Actions (exposed for onclick handlers)
  selectAnalyticsMonth: (month: string, btn: HTMLButtonElement) => Promise<void>;

  // Analytics filter change handlers
  onAnalyticsCFOChange: () => Promise<void>;
  onAnalyticsArticleTypeChange: () => Promise<void>;
  onAnalyticsArticleChange: () => Promise<void>;
  collapseAnalytics: () => void;

  // Sync Actions (exposed for onclick handlers)
  syncFiltersToAnalytics: (options?: FilterAnalyticsSync.SyncOptions) => Promise<void>;
  syncAnalyticsToFilters: (options?: FilterAnalyticsSync.SyncOptions) => Promise<void>;

  // Modal Save Actions
  savePlanModal: (button: HTMLElement) => Promise<void>;

  // CRUD Actions (exposed for onclick handlers - Phase 3: Week 3-4)
  closeEditModal: () => void;
  deleteFact: (factId: number) => Promise<void>;
  deleteFromEditModal: () => Promise<void>;
  showEditModal: (factId: number) => Promise<void>;
  openAddPlanModal: () => void;
  createPlan: (event: Event) => Promise<void>;
  updateFact: (event: Event) => Promise<void>;
  batchDeleteFacts: () => Promise<void>;
  batchDeleteRecurringPlans: () => Promise<void>;

  // Recurring Plan Helpers (exposed for onclick handlers - Phase 3: Week 4)
  recurringDeleteResolve: (choice: 'single' | 'all' | null) => void;
  updateFrequencyFields: (modalId: string) => void;
  updateYearlyFrequencyValue: (modalId: string) => void;
  updateDurationFields: (modalId: string) => void;
  updateRecurringPreview: (modalId: string) => void;

  // Reminder Helpers (exposed for onclick handlers - Phase 3: Week 4)
  updateReminderDatetime: (modalId: string) => void;
  updateEditReminderDatetime: () => void;
}

declare global {
  interface Window {
    PlanApp: PlanAppGlobal;
    // savePlanModal уже объявлена в dashboard/types/globals.d.ts
  }
}

// ============================================================================
// Page Initialization
// ============================================================================

/**
 * Initialize plan page
 * Called on DOMContentLoaded from inline script
 */
async function ensureDexieReady(): Promise<void> {
  try {
    const mgr = getDexieManager();
    if (!mgr || typeof mgr.isReady !== 'function') return;
    if (!mgr.isReady() && typeof mgr.init === 'function') {
      await mgr.init();
    }
    const userId = (window as any).userData?.id;
    if (userId && typeof (mgr as any).syncReferenceData === 'function') {
      await (mgr as any).syncReferenceData(userId);
    }
  } catch (err) {
    log.warn('Dexie init failed (non-critical):', err);
  }
}

export async function initialize(): Promise<void> {
  log.info('Initializing plan page...');

  try {
    // Инициализация делегирования событий (data-action вместо inline onclick)
    setupEventDelegation();

    // Initialize default period filter UI
    PlanFilters.initDefaultPeriodFilter();

    // Initialize analytics month buttons
    PlanAnalytics.initAnalyticsMonthButtons();

    // Ensure Dexie is ready before loading any data (non-critical: loadFacts falls back to API)
    await ensureDexieReady();

    // Load dropdown data in parallel
    log.debug('Loading dropdown data...');
    await Promise.all([
      loadUsersDropdown(),
      loadArticlesDropdown(),
      loadFinancialCentersDropdown(),
      loadCostCentersDropdown(),
      PlanAnalytics.populateAllAnalyticsFilters()
    ]);

    // Apply filters and load initial data
    log.debug('Applying initial filters...');
    await applyFiltersAndLoadData();

    // Load analytics and recurring plans in parallel
    log.debug('Loading analytics and recurring plans...');
    await Promise.all([
      PlanAnalytics.loadPlanAnalytics(),
      window.loadRecurringPlans?.(),
    ]);

    // Update filter indicator
    PlanFilters.updateFilterIndicator();

    // Register WebSocket event handlers for real-time updates
    registerWSHandlers();

    log.info('Plan page initialized successfully');
  } catch (error) {
    log.error('Error initializing plan page:', error);
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
      log.warn('User dropdown not found');
      return;
    }

    users.forEach(user => {
      const option = document.createElement('option');
      option.value = String(user.id);
      option.textContent = user.username || user.first_name || `User ${user.telegram_id}`;
      select.appendChild(option);
    });

    log.debug(`Loaded ${users.length} users`);
  } catch (error) {
    log.error('Error loading users:', error);
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

    // Populate global allCategories used by crud.ts (declare let allCategories)
    (window as any).allCategories = articles;

    const tree = PlanHelpers.buildArticleTree(articles);
    const flatNodes = PlanHelpers.flattenArticleTree(tree);
    const sortedNodes = groupArticlesByType(flatNodes);

    // Populate filter dropdown
    const filterSelect = document.getElementById('filter-article') as HTMLSelectElement | null;

    if (!filterSelect) {
      log.warn('Article dropdown not found');
      return;
    }

    sortedNodes.forEach(node => {
      const option = createArticleOption(node);
      filterSelect.appendChild(option);
    });

    log.debug(`Loaded ${sortedNodes.length} articles (${articles.length} total)`);
  } catch (error) {
    log.error('Error loading articles:', error);
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
      log.warn('Financial center dropdown not found');
      return;
    }

    centers.forEach(center => {
      const option = document.createElement('option');
      option.value = String(center.id);
      option.textContent = center.name;
      filterSelect.appendChild(option);
    });

    log.debug(`Loaded ${centers.length} financial centers`);
  } catch (error) {
    log.error('Error loading financial centers:', error);
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
      log.warn('Cost center dropdown not found');
      return;
    }

    centers.forEach(center => {
      const option = document.createElement('option');
      option.value = String(center.id);
      option.textContent = center.name;
      filterSelect.appendChild(option);
    });

    log.debug(`Loaded ${centers.length} cost centers`);
  } catch (error) {
    log.error('Error loading cost centers:', error);
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

    // Reload facts table
    await PlanFactsTable.loadFacts();

    // Sync filters to analytics (debounced to prevent cascading reloads)
    FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();

    log.debug('Filters applied and data reloaded');
  } catch (error) {
    log.error('Error applying filters:', error);
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

    // Reload facts table
    await PlanFactsTable.loadFacts();

    // Sync filters to analytics (debounced to prevent cascading reloads)
    FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();

    log.debug('Filters reset and data reloaded');
  } catch (error) {
    log.error('Error resetting filters:', error);
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
// Modal Save Actions
// ============================================================================

/**
 * Обработчик кнопки «Сохранить» в modal_plan.
 * Аналог saveFactModal из facts/adapters/windowExports.ts.
 * Вызывается через onclick="savePlanModal(this)" — без optional chaining,
 * чтобы ошибка «функция не определена» была видима сразу.
 *
 * @param button - Кнопка с data-form-id и data-modal-id
 */
let isSubmitting = false;

export async function savePlanModal(button: HTMLElement): Promise<void> {
  const btn = button as HTMLButtonElement;
  if (btn.disabled || isSubmitting) return;
  isSubmitting = true;

  const formId = button.dataset.formId;
  const modalId = button.dataset.modalId || 'modal_plan';
  const form = document.getElementById(formId || `form_${modalId}`) as HTMLFormElement | null;
  if (!form) { isSubmitting = false; return; }

  syncPlanPeriodFromActive(modalId);

  setButtonLoading(btn, true);

  try {
    if (modalId === 'modal_plan') {
      const activeTabInput = document.getElementById(`${modalId}-active-tab`) as HTMLInputElement | null;
      const activeTab = activeTabInput?.value || 'transaction';
      if (activeTab === 'transfer') {
        await savePlanTransfer(form);
        (document.getElementById(modalId) as HTMLDialogElement)?.close();
        PlanHelpers.showToast('Перевод по плану сохранён', 'success');
        form.reset();
        // Re-disable article selects (enabled by FC selection, not restored by form.reset)
        const transferDiv = form.querySelector('[data-tab="transfer"]') as HTMLElement | null;
        if (transferDiv) {
          const fromArticle = transferDiv.querySelector<HTMLSelectElement>('select[name="from_article_id"]');
          const toArticle = transferDiv.querySelector<HTMLSelectElement>('select[name="to_article_id"]');
          if (fromArticle) fromArticle.disabled = true;
          if (toArticle) toArticle.disabled = true;
          // Reset period buttons: first active, others inactive
          transferDiv.querySelectorAll<HTMLButtonElement>('.transfer-period-btn')
            .forEach((pb, idx) => pb.classList.toggle('btn-active', idx === 0));
        }
        // No loadFacts() — WS plan_created event handles incremental update
      } else {
        // Для основного модала — TS-реализация из PlanCRUD (поддерживает recurring + offline)
        const event = new Event('submit', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'target', { value: form, writable: false });
        await PlanCRUD.createPlan(event);
        // Ensure modal is closed after save (backup for edge cases)
        const modal = document.getElementById(modalId) as HTMLDialogElement | null;
        if (modal?.open) modal.close();
      }
    } else {
      // Для остальных модалов (например modal_add_plan) — нативная отправка формы,
      // которая триггерит зарегистрированный submit-обработчик из inline-скрипта
      if (form.checkValidity()) {
        form.requestSubmit();
      } else {
        form.reportValidity();
      }
    }
  } catch (error) {
    log.error('savePlanModal error:', error);
    const message = error instanceof APIError
      ? (error.status === 422
          ? `Проверьте форму: ${error.detail}`
          : `Ошибка (${error.status}): ${error.detail}`)
      : `Ошибка сохранения: ${(error as Error).message || 'неизвестная ошибка'}`;
    PlanHelpers.showToast(message, 'error');
  } finally {
    isSubmitting = false;
    setButtonLoading(btn, false);
  }
}

// ============================================================================
// Expose to Window Object (через windowExports адаптер)
// ============================================================================

/**
 * Построить объект публичного API страницы и экспортировать в window.
 * Вынесено в отдельный адаптер adapters/windowExports.ts по образцу facts.
 */
const planApp: typeof window.PlanApp = {
  // Initialization
  initialize,

  // Modules
  Helpers: PlanHelpers,
  Filters: PlanFilters,
  FactsTable: PlanFactsTable,
  Analytics: PlanAnalytics,
  FilterAnalyticsSync,
  CRUD: PlanCRUD,

  // Modal Save Actions (for onclick handlers)
  savePlanModal,

  // Filter Actions (for onclick handlers)
  applyFilters: applyFiltersAndLoadData,
  resetFilters: resetFiltersAndLoadData,
  collapseFilters: collapseFiltersAction,

  // Facts Table Actions (for onclick handlers)
  loadFacts: PlanFactsTable.loadFacts,
  loadMoreFacts: PlanFactsTable.loadMoreFacts,

  // Analytics Actions (for onclick handlers)
  selectAnalyticsMonth: PlanAnalytics.selectAnalyticsMonth,

  // Analytics filter change handlers
  onAnalyticsCFOChange: PlanAnalytics.onAnalyticsCFOChange,
  onAnalyticsArticleTypeChange: PlanAnalytics.onAnalyticsArticleTypeChange,
  onAnalyticsArticleChange: PlanAnalytics.onAnalyticsArticleChange,
  collapseAnalytics: PlanAnalytics.collapseAnalytics,

  // Sync Actions (for onclick handlers)
  syncFiltersToAnalytics: FilterAnalyticsSync.syncFiltersToAnalytics,
  syncAnalyticsToFilters: FilterAnalyticsSync.syncAnalyticsToFilters,

  // CRUD Actions (for onclick handlers - Phase 3: Week 3-4)
  closeEditModal: PlanCRUD.closeEditModal,
  deleteFact: PlanCRUD.deleteFact,
  deleteFromEditModal: PlanCRUD.deleteFromEditModal,
  showEditModal: PlanCRUD.showEditModal,
  openAddPlanModal: PlanCRUD.openAddPlanModal,
  createPlan: PlanCRUD.createPlan,
  updateFact: PlanCRUD.updateFact,
  batchDeleteFacts: PlanCRUD.batchDeleteFacts,
  batchDeleteRecurringPlans: PlanCRUD.batchDeleteRecurringPlans,

  // Recurring Plan Helpers (for onclick handlers - Phase 3: Week 4)
  recurringDeleteResolve: PlanCRUD.recurringDeleteResolve,
  updateFrequencyFields: PlanCRUD.updateFrequencyFields,
  updateYearlyFrequencyValue: PlanCRUD.updateYearlyFrequencyValue,
  updateDurationFields: PlanCRUD.updateDurationFields,
  updateRecurringPreview: PlanCRUD.updateRecurringPreview,

  // Reminder Helpers (for onclick handlers - Phase 3: Week 4)
  updateReminderDatetime: PlanCRUD.updateReminderDatetime,
  updateEditReminderDatetime: PlanCRUD.updateEditReminderDatetime
};

setupWindowExports(planApp);

// FAB toolbar compatibility (v10.1.11)
// REMOVED: window.openModalPlan = PlanCRUD.openAddPlanModal
// Reason: Conflicts with dashboard.min.js export (windowExports.ts)
// dashboard.min.js already exports correct openModalPlan with loadTransactionTabData()
// This line was overriding the correct implementation, causing financial centers/categories
// to not load automatically (Task #1, #2 from v10.1.41 fixes)

// ============================================================================
// Авто-инициализация (по образцу facts/index.ts)
// ============================================================================

/**
 * Флаг предотвращает двойную инициализацию, если initialize() вызывается
 * как через DOMContentLoaded, так и через window.PlanApp.initialize() вручную.
 */
let _isInitialized = false;

/**
 * Запустить initialize() один раз: либо сразу (DOM готов),
 * либо после DOMContentLoaded.
 * Аналог facts/index.ts:713-720.
 */
function autoInitialize(): void {
  if (_isInitialized) return;
  _isInitialized = true;
  initialize();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    // DOM ещё не готов — ждём DOMContentLoaded
    document.addEventListener('DOMContentLoaded', autoInitialize);
  } else {
    // Скрипт загружен после DOM готов (readyState === 'interactive'/'complete').
    // Inline JS удалён (Unit 4), поэтому инициализируем сразу.
    autoInitialize();
  }
}
