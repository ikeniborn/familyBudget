/**
 * Facts Manager - Global Type Definitions
 *
 * Extend Window interface with facts manager functions.
 *
 * Phase 1.1: TypeScript Infrastructure
 */

import type { BudgetShared, CategoryTreeSelectConstructor, CalendarWidgetConstructor, WebSocketManager, HTMX } from './dependencies';
import type { BudgetFact } from './models';

declare global {
    interface Window {
        // BudgetShared utilities
        BudgetShared: BudgetShared;

        // Third-party libraries
        CategoryTreeSelect: CategoryTreeSelectConstructor;
        CalendarWidget: CalendarWidgetConstructor;
        budgetWSManager: WebSocketManager | undefined;
        htmx: HTMX;

        // AdminFactsCommon (admin-facts-common.js)
        AdminFactsCommon?: {
            syncFiltersUI: (filters: Record<string, string>) => void;
            populateEditModal: (fact: BudgetFact) => void;
            closeCreateModal: () => void;
        };

        // Facts Manager functions (exported to global scope for onclick handlers)
        applyFilters: () => void;
        resetFilters: () => void;
        collapseFilters: () => void;
        previousPage: () => void;
        nextPage: () => void;
        toggleSelectAll: (checkbox: HTMLInputElement) => void;
        batchDelete: () => Promise<void>;
        showEditModal: (factId: number) => Promise<void>;
        closeEditModal: () => void;
        updateFact: (event: Event) => Promise<void>;
        deleteFact: (factId: number) => Promise<void>;
        deleteFromEditModal: () => Promise<void>;
        exportFilteredFacts: (format: 'csv') => void;
        openCreateModal: () => void;
        openAddTransactionModal: () => void;
        openFactTransferModal: () => void;
        saveTransaction: (button: HTMLButtonElement) => void;
        saveTransfer: (button: HTMLButtonElement) => void;
        createFact: (event: Event) => Promise<void>;
        createTransfer: (event: Event) => Promise<void>;
        setTransactionDate: (offsetDays: number) => void;
        loadFactHints: (category?: any) => Promise<void>;
        filterEditCostCenters: (financialCenterId: string) => Promise<void>;

        // Facts Manager state (read-only access)
        FactsManager?: {
            getFilters: () => any;
            getPagination: () => any;
            getSelectedIds: () => Set<number>;
        };
    }
}

export {};
