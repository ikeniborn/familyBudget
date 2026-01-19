/**
 * Facts Manager - External Dependencies
 *
 * Type definitions for external dependencies (BudgetShared, etc.)
 *
 * Phase 1.1: TypeScript Infrastructure
 */

// ============================================================================
// BudgetShared Dependencies
// ============================================================================

/**
 * Date formatter utilities from BudgetShared
 */
export interface DateFormatter {
    /**
     * Get today's date in ISO format (YYYY-MM-DD)
     */
    todayISO(): string;

    /**
     * Format ISO date to display format (DD.MM.YYYY)
     */
    formatForDisplay(isoDate: string): string;

    /**
     * Parse display format (DD.MM.YYYY) to ISO (YYYY-MM-DD)
     * Alias for parseFromDisplay
     */
    formatForAPI(displayDate: string): string;

    /**
     * Parse display format (DD.MM.YYYY) to ISO (YYYY-MM-DD)
     */
    parseFromDisplay(displayDate: string): string;
}

/**
 * Money formatter utilities from BudgetShared
 */
export interface MoneyFormatter {
    /**
     * Format amount to money string (e.g., "1 234.56 ₽")
     */
    format(amount: number, currency?: string): string;

    /**
     * Format amount for mobile display
     */
    formatMobile(amount: number, currency?: string): string;
}

/**
 * BudgetShared global object
 */
export interface BudgetShared {
    DateFormatter: DateFormatter;
    MoneyFormatter: MoneyFormatter;
    // Add other BudgetShared utilities as needed
}

/**
 * CategoryTreeSelect library
 */
export interface CategoryTreeSelectConstructor {
    new (config: CategoryTreeSelectConfig): CategoryTreeSelectInstance;
}

export interface CategoryTreeSelectConfig {
    containerId: string;
    articles: any[];
    selectedArticleId?: number | null;
    onArticleSelected: (article: any) => void;
    placeholder?: string;
}

export interface CategoryTreeSelectInstance {
    destroy(): void;
    setValue(articleId: number | null): void;
    getValue(): number | null;
    // Add other methods as needed
}

/**
 * CalendarWidget library
 */
export interface CalendarWidgetConstructor {
    new (config: CalendarWidgetConfig): CalendarWidgetInstance;
}

export interface CalendarWidgetConfig {
    inputId: string;
    onDateSelected: (date: string) => void;
    mode?: 'single' | 'range';
    // Add other options as needed
}

export interface CalendarWidgetInstance {
    destroy(): void;
    setValue(date: string | null): void;
    // Add other methods as needed
}

/**
 * WebSocket Manager (budgetWSManager)
 */
export interface WebSocketManager {
    on(event: string, handler: (data: any) => void): void;
    off(event: string, handler: (data: any) => void): void;
    send(event: string, data: any): void;
}

// ============================================================================
// HTMX
// ============================================================================

/**
 * HTMX global object
 */
export interface HTMX {
    trigger(element: HTMLElement | string, eventName: string, detail?: any): void;
    ajax(method: string, url: string, options?: {
        target?: string | HTMLElement;
        swap?: string;
        values?: Record<string, string>;
        headers?: Record<string, string>;
    }): Promise<any>;
    // Add other htmx methods as needed
}

// ============================================================================
// Global Access Helpers
// ============================================================================

/**
 * Get BudgetShared from window
 */
export function getBudgetShared(): BudgetShared {
    if (typeof window !== 'undefined' && (window as any).BudgetShared) {
        return (window as any).BudgetShared;
    }
    throw new Error('[FactsDependencies] BudgetShared not available');
}

/**
 * Get CategoryTreeSelect constructor
 */
export function getCategoryTreeSelect(): CategoryTreeSelectConstructor {
    if (typeof window !== 'undefined' && (window as any).CategoryTreeSelect) {
        return (window as any).CategoryTreeSelect;
    }
    throw new Error('[FactsDependencies] CategoryTreeSelect not available');
}

/**
 * Get CalendarWidget constructor
 */
export function getCalendarWidget(): CalendarWidgetConstructor {
    if (typeof window !== 'undefined' && (window as any).CalendarWidget) {
        return (window as any).CalendarWidget;
    }
    throw new Error('[FactsDependencies] CalendarWidget not available');
}

/**
 * Get budgetWSManager
 */
export function getWSManager(): WebSocketManager | null {
    if (typeof window !== 'undefined' && (window as any).budgetWSManager) {
        return (window as any).budgetWSManager;
    }
    return null;
}

/**
 * Get htmx
 */
export function getHTMX(): HTMX {
    if (typeof window !== 'undefined' && (window as any).htmx) {
        return (window as any).htmx;
    }
    throw new Error('[FactsDependencies] htmx not available');
}
