/**
 * Transfer Module - Global Type Extensions
 *
 * Window interface extensions and global function declarations.
 */

import type { CostCenter } from './transfer';

declare global {
  interface Window {
    // Transfer module exports (reactive getters)
    transferDateWidget: any; // CalendarWidget instance
    fromCategoryTree: any; // ChoicesCategoryTree instance
    toCategoryTree: any; // ChoicesCategoryTree instance
    allCostCenters: CostCenter[]; // Cost centers cache

    // Transfer module functions
    initTransferModal(): Promise<void>;
    openTransferModal(): Promise<void>;

    // Global functions from base.html (always available, not optional)
    showToast(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
    setSubmitLoading(loading: boolean): void;

    // Offline manager
    offlineManager?: {
      createTransfer(data: any): Promise<void>;
      db?: {
        cacheData(key: string, data: any, ttl: number): Promise<void>;
        getCachedData(key: string): Promise<any>;
      };
    };

    // HTMX
    htmx?: {
      ajax(method: string, url: string, options: any): void;
      trigger(element: string | HTMLElement, event: string, detail?: any): void;
    };

    // BudgetShared module
    BudgetShared: {
      CalendarWidget: any;
      ChoicesCategoryTree: any;
      DateFormatter: {
        today(): string;
        formatForAPI(date: Date | string): string;
        formatForDisplay(date: string): string;
        isValidDisplayFormat(date: string): boolean;
      };
      Reminders?: {
        createReminder(factId: string, reminderDatetime: string): Promise<any>;
        updateReminder(factId: string, reminderDatetime: string): Promise<any>;
        deleteReminder(factId: string): Promise<boolean>;
        getRemindersForFacts(factIds: number[]): Promise<any[]>;
      };
    };
  }
}

// Global function declarations (accessible without window prefix)
declare function showToast(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
declare function setSubmitLoading(loading: boolean): void;
declare function loadPendingRecords(): Promise<void>;
declare function loadFacts(): Promise<void>;
declare function debugLog(...args: any[]): void;

export {};
