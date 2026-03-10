/**
 * Facts Manager - Type Definitions
 *
 * TypeScript interfaces for facts management page.
 *
 * Phase 1.1: TypeScript Infrastructure
 * Extracted from: frontend/web/templates/facts.html
 */

// ============================================================================
// Domain Models
// ============================================================================

/**
 * Budget Fact (Transaction) model
 */
export interface BudgetFact {
    id: number;
    temp_id?: string;              // Dexie temp_id for offline operations (task-015 Phase 4.4)
    fact_date: string; // ISO date (YYYY-MM-DD)
    article_id: number;
    article_name: string;
    article_type: 'expense' | 'income' | 'debit' | 'credit';
    financial_center_id: number;
    financial_center_name: string;
    cost_center_id: number | null;
    cost_center_name: string | null;
    amount: number;
    description: string | null;
    user_id: number;
    user_name: string;
    record_type: 'spend' | 'income' | 'open' | 'close';
    created_at: string; // ISO datetime
    updated_at: string; // ISO datetime
}

/**
 * Offline Fact Response
 * Extends BudgetFact with offline flag for offline mode support
 */
export interface OfflineFactResponse extends BudgetFact {
    _offline: true;
}

/**
 * Fact Row for Table Rendering
 * API response may use different field names (fact_sum, fact_comment)
 * This type handles both BudgetFact and API response variations
 */
export interface FactRow {
    id: number;
    fact_date: string;
    article_name: string;
    article_type?: 'expense' | 'income' | 'debit' | 'credit'; // Article record type for color coding
    financial_center_name: string;
    cost_center_name: string | null;
    fact_sum?: number; // API field (alternative to amount)
    amount?: number; // BudgetFact field
    fact_comment?: string | null; // API field (alternative to description)
    description?: string | null; // BudgetFact field
}

/**
 * Article (Category) model
 */
export interface Article {
    id: number;
    name: string;
    type: 'expense' | 'income' | 'debit' | 'credit';
    parent_id: number | null;
    user_id: number;
    level: number; // Hierarchy depth
    path: string; // Full path in hierarchy
}

/**
 * Financial Center (Account) model
 */
export interface FinancialCenter {
    id: number;
    name: string;
    fc_type: string;
    currency: string;
    balance: number;
    user_id: number;
}

/**
 * Cost Center model
 */
export interface CostCenter {
    id: number;
    name: string;
    financial_center_id: number;
    user_id: number;
}

/**
 * User model
 */
export interface User {
    id: number;
    name: string;
    email: string;
}

/**
 * Fact Hint (Analytics) model
 */
export interface FactHint {
    plan_amount: number | null;
    fact_amount: number | null;
    period: 'month' | 'year';
}

// ============================================================================
// API Data Transfer Objects
// ============================================================================

/**
 * Data for creating a new fact
 */
export interface CreateFactData {
    record_type: 'fact';
    fact_type: 'expense' | 'income' | 'debit' | 'credit';
    fact_date: string; // ISO date (YYYY-MM-DD)
    article_id: number;
    financial_center_id: number;
    amount: number;
    description: string | null;
    cost_center_id?: number;
}

/**
 * Data for updating an existing fact
 */
export interface UpdateFactData {
    fact_date: string; // ISO date (YYYY-MM-DD)
    article_id: number;
    financial_center_id: number;
    amount: number;
    description: string | null;
    cost_center_id?: number;
}

// ============================================================================
// State Models
// ============================================================================

/**
 * Filter state
 */
export interface FilterState {
    user_id: number | null;
    article_id: number | null;
    article_type: 'expense' | 'income' | 'debit' | 'credit' | null;
    date_from: string | null; // ISO date (YYYY-MM-DD)
    date_to: string | null; // ISO date (YYYY-MM-DD)
    financial_center_id: number | null;
    cost_center_id: number | null;
    search: string | null;
}

/**
 * Pagination state
 */
export interface PaginationState {
    currentPage: number;
    pageSize: number;
    totalFacts: number;
}

/**
 * Selection state
 */
export interface SelectionState {
    selectedFactIds: Set<number>;
    deletingFactIds: Set<number>; // Track ongoing deletions to prevent race conditions
}

/**
 * Category tree select state
 */
export interface CategoryTreeSelectState {
    allCategories: Article[];
    createCategoryTreeSelect: any | null; // CategoryTreeSelect instance
    editCategoryTreeSelect: any | null; // CategoryTreeSelect instance
    editDateCalendar: any | null; // CalendarWidget instance
}

/**
 * Fact hints state
 */
export interface FactHintsState {
    timeout: NodeJS.Timeout | null;
    controller: AbortController | null;
}

// ============================================================================
// API Response Models
// ============================================================================

/**
 * Load facts API response
 */
export interface LoadFactsResponse {
    facts: BudgetFact[];
    total: number;
    page: number;
    page_size: number;
}

/**
 * Batch delete API response
 */
export interface BatchDeleteResponse {
    deleted_count: number;
    failed_ids: number[];
}

/**
 * Export facts options
 */
export interface ExportFactsOptions {
    format: 'csv';
    filters: FilterState;
}

// ============================================================================
// UI Models
// ============================================================================

/**
 * Article tree node (for dropdown rendering)
 */
export interface ArticleTreeNode {
    id: number;
    name: string;
    type: 'expense' | 'income' | 'debit' | 'credit';
    parent_id: number | null;
    level: number;
    path: string;
    children: ArticleTreeNode[];
}

/**
 * Filter validation result
 */
export interface FilterValidationResult {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: FilterState = {
    user_id: null,
    article_id: null,
    article_type: null,
    date_from: null, // Will be set to current month start
    date_to: null, // Will be set to today
    financial_center_id: null,
    cost_center_id: null,
    search: null
};

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION: PaginationState = {
    currentPage: 0,
    pageSize: 50,
    totalFacts: 0
};
