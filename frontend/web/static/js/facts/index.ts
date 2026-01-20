/**
 * Facts Manager - Main Entry Point
 *
 * Barrel export and public API for facts management module.
 *
 * Phase 4: Cleanup & Optimization (Event Delegation)
 * Bundle: facts.min.js (IIFE format for global scope)
 */

// ============================================================================
// Core Exports
// ============================================================================

export {
    initializeState,
    getState,
    updateState,
    resetState
} from './core/FactsState';

export * from './core/stateManager';

// ============================================================================
// Operations Exports
// ============================================================================

export * from './operations/filterOperations';
export * from './operations/paginationOperations';
export * from './operations/selectionOperations';

// ============================================================================
// Integration Exports
// ============================================================================

export * from './integration/factsAPI';
export * from './integration/dropdownAPI';
export * from './integration/analyticsAPI';

// ============================================================================
// WebSocket Integration Exports (Phase 3)
// ============================================================================

export * from './integration/wsEventHandlers';

// ============================================================================
// Event Delegation Setup (Phase 4)
// ============================================================================

export * from './adapters/eventDelegation';

// ============================================================================
// Window Exports Setup
// ============================================================================

import { setupWindowExports } from './adapters/windowExports';
export { setupWindowExports };

// ============================================================================
// Initialization
// ============================================================================

import { initializeState } from './core/FactsState';
import { registerWSHandlers } from './integration/wsEventHandlers';
import { setupEventDelegation } from './adapters/eventDelegation';
import { loadAllDropdownData } from './integration/dropdownAPI';
import { loadFacts } from './operations/factsController';
import { initDefaultPeriodFilter } from './operations/filterOperations';
import {
    setCachedUsers,
    setCachedArticles,
    setCachedFinancialCenters,
    setCachedCostCenters,
    setAllCategories
} from './core/stateManager';
import { factsLogger as logger } from './utilities/logger';

/**
 * Initialize Facts Manager
 * Called automatically on DOMContentLoaded
 */
export function initialize(): void {
    // Initialize state
    initializeState();

    // Setup window exports for onclick compatibility (HTMX partials)
    setupWindowExports();

    // Phase 3: Register WebSocket handlers for real-time updates
    registerWSHandlers();

    // Phase 4: Setup event delegation for data-action pattern
    setupEventDelegation();

    // Initialize UI and load data
    initializeUI();
}

/**
 * Initialize UI components and load initial data
 */
async function initializeUI(): Promise<void> {
    try {
        // 1. Initialize default period filter
        initDefaultPeriodFilter();

        // 2. Initialize CalendarWidget for date range
        initDateRangeCalendar();

        // 3. Load all dropdown data in parallel
        await loadAndPopulateDropdowns();

        // 4. Load facts with default filters
        await loadFacts();

    } catch (error) {
        logger.error(' Initialization error:', error);
    }
}

/**
 * Initialize CalendarWidget for date range filter
 */
function initDateRangeCalendar(): void {
    const CalendarWidget = (window as any).CalendarWidget;
    if (!CalendarWidget) {
        logger.warn(' CalendarWidget not available');
        return;
    }

    const BudgetShared = (window as any).BudgetShared;
    if (!BudgetShared?.DateFormatter) {
        logger.warn(' BudgetShared.DateFormatter not available');
        return;
    }

    // Create calendar widget for date range
    const triggerContainer = document.getElementById('date-range-calendar-trigger');
    if (!triggerContainer) return;

    // Create trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'btn btn-sm btn-ghost btn-square';
    triggerBtn.innerHTML = '📅';
    triggerBtn.title = 'Выбрать период';
    triggerBtn.id = 'date-range-calendar-btn';
    triggerContainer.appendChild(triggerBtn);

    // Get input elements (required by CalendarWidget API)
    const startInputElement = document.getElementById('filter-date-from') as HTMLInputElement;
    const endInputElement = document.getElementById('filter-date-to') as HTMLInputElement;

    if (!startInputElement || !endInputElement) {
        logger.warn(' Date inputs not found, skipping CalendarWidget initialization');
        return;
    }

    try {
        new CalendarWidget({
            mode: 'range',
            startInputElement: startInputElement,
            endInputElement: endInputElement,
            triggerContainer: '#date-range-calendar-trigger',
            onSelect: (dateFrom: string, dateTo: string) => {
                logger.log(' Date range selected:', dateFrom, '-', dateTo);
                // CalendarWidget already updates input values
                // Trigger filter reload
                import('./operations/filterOperations').then(({ applyFiltersAction }) => {
                    applyFiltersAction();
                });
            }
        });
        logger.log(' CalendarWidget initialized successfully');
    } catch (error) {
        logger.error(' Error initializing CalendarWidget:', error);
    }
}

/**
 * Load and populate all filter dropdowns
 */
async function loadAndPopulateDropdowns(): Promise<void> {
    try {
        const { users, articles, financialCenters, costCenters } = await loadAllDropdownData();

        // Cache data
        setCachedUsers(users);
        setCachedArticles(articles);
        setCachedFinancialCenters(financialCenters);
        setCachedCostCenters(costCenters);
        setAllCategories(articles);

        // Populate filter dropdowns
        populateUserDropdown(users);
        populateArticleDropdown(articles);
        populateFinancialCenterDropdown(financialCenters);
        populateCostCenterDropdown(costCenters);

        // Populate modal dropdowns (edit modal)
        populateEditModalDropdowns(articles, financialCenters, costCenters);

        // Populate create modal dropdowns
        populateCreateModalDropdowns(financialCenters, costCenters);

    } catch (error) {
        logger.error(' Error loading dropdowns:', error);
    }
}

/**
 * Populate user filter dropdown
 */
function populateUserDropdown(users: any[]): void {
    const select = document.getElementById('filter-user') as HTMLSelectElement;
    if (!select) return;

    // Keep default option
    select.innerHTML = '<option value="">Все пользователи</option>';

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = String(user.id);
        option.textContent = user.display_name || user.username || `User ${user.id}`;
        select.appendChild(option);
    });
}

/**
 * Populate article filter dropdown with hierarchical structure
 */
function populateArticleDropdown(articles: any[]): void {
    const select = document.getElementById('filter-article') as HTMLSelectElement;
    if (!select) return;

    // Keep default option
    select.innerHTML = '<option value="">Все категории</option>';

    // Group by type and add with indentation
    const grouped = groupArticlesByTypeForSelect(articles);
    grouped.forEach(item => {
        const option = document.createElement('option');
        option.value = String(item.id);
        option.textContent = item.displayName;
        if (item.isParent) {
            option.className = 'category-parent';
        } else {
            option.className = 'category-leaf';
        }
        select.appendChild(option);
    });
}

/**
 * Group articles by type for select display
 */
function groupArticlesByTypeForSelect(articles: any[]): any[] {
    const result: any[] = [];
    const typeLabels: Record<string, string> = {
        'expense': '═══ РАСХОДЫ ═══',
        'income': '═══ ДОХОДЫ ═══',
        'debit': '═══ СПИСАНИЯ ═══',
        'credit': '═══ ПОПОЛНЕНИЯ ═══'
    };

    const byType: Record<string, any[]> = {};
    articles.forEach(a => {
        if (!byType[a.record_type]) byType[a.record_type] = [];
        byType[a.record_type].push(a);
    });

    ['expense', 'income', 'debit', 'credit'].forEach(type => {
        const typeArticles = byType[type] || [];
        if (typeArticles.length === 0) return;

        // Add type separator
        result.push({
            id: `type_${type}`,
            displayName: typeLabels[type],
            isParent: true,
            disabled: true
        });

        // Sort and add articles
        typeArticles
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            .forEach(article => {
                const indent = article.parent_id ? '    ' : '';
                result.push({
                    id: article.id,
                    displayName: `${indent}${article.name}`,
                    isParent: !article.parent_id
                });
            });
    });

    return result;
}

/**
 * Populate financial center filter dropdown
 */
function populateFinancialCenterDropdown(financialCenters: any[]): void {
    const select = document.getElementById('filter-financial-center') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Все счета</option>';

    financialCenters.forEach(fc => {
        const option = document.createElement('option');
        option.value = String(fc.id);
        option.textContent = fc.name;
        select.appendChild(option);
    });
}

/**
 * Populate cost center filter dropdown
 */
function populateCostCenterDropdown(costCenters: any[]): void {
    const select = document.getElementById('filter-cost-center') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Все МЗ</option>';

    costCenters.forEach(cc => {
        const option = document.createElement('option');
        option.value = String(cc.id);
        option.textContent = cc.name;
        select.appendChild(option);
    });
}

/**
 * Populate edit modal dropdowns
 */
function populateEditModalDropdowns(articles: any[], financialCenters: any[], costCenters: any[]): void {
    // Financial centers
    const fcSelect = document.getElementById('edit-financial-center') as HTMLSelectElement;
    if (fcSelect) {
        fcSelect.innerHTML = '<option value="">-- Выберите счет --</option>';
        financialCenters.forEach(fc => {
            const option = document.createElement('option');
            option.value = String(fc.id);
            option.textContent = fc.name;
            fcSelect.appendChild(option);
        });
    }

    // Articles (categories)
    const articleSelect = document.getElementById('edit-article') as HTMLSelectElement;
    if (articleSelect) {
        articleSelect.innerHTML = '<option value="" disabled hidden>-- Выберите категорию --</option>';
        articles.forEach(article => {
            const option = document.createElement('option');
            option.value = String(article.id);
            option.textContent = article.name;
            articleSelect.appendChild(option);
        });
    }

    // Cost centers
    const ccSelect = document.getElementById('edit-cost-center') as HTMLSelectElement;
    if (ccSelect) {
        ccSelect.innerHTML = '<option value="">-- Не указано --</option>';
        costCenters.forEach(cc => {
            const option = document.createElement('option');
            option.value = String(cc.id);
            option.textContent = cc.name;
            ccSelect.appendChild(option);
        });
    }
}

/**
 * Populate create modal dropdowns
 */
function populateCreateModalDropdowns(financialCenters: any[], costCenters: any[]): void {
    // Financial centers in create modal
    const createFcSelect = document.querySelector('#modal_add_transaction select[name="financial_center_id"]') as HTMLSelectElement;
    if (createFcSelect) {
        createFcSelect.innerHTML = '<option value="">-- Выберите счет --</option>';
        financialCenters.forEach(fc => {
            const option = document.createElement('option');
            option.value = String(fc.id);
            option.textContent = fc.name;
            createFcSelect.appendChild(option);
        });
    }

    // Cost centers in create modal
    const createCcSelect = document.querySelector('#modal_add_transaction select[name="cost_center_id"]') as HTMLSelectElement;
    if (createCcSelect) {
        createCcSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        costCenters.forEach(cc => {
            const option = document.createElement('option');
            option.value = String(cc.id);
            option.textContent = cc.name;
            createCcSelect.appendChild(option);
        });
    }
}

// ============================================================================
// Auto-Initialize on DOM Ready
// ============================================================================

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM already loaded
        initialize();
    }
}
