/**
 * Facts Manager - Facts API Integration
 *
 * CRUD operations for budget facts.
 *
 * Phase 1.4: Extract API Integration
 * Extracted from: frontend/web/templates/facts.html (lines 1304-2161)
 */

import type { BudgetFact, OfflineFactResponse, LoadFactsResponse, BatchDeleteResponse, CreateFactData, UpdateFactData } from '../types/models';
import { buildFilterQuery } from '../operations/filterOperations';
import { getFilters } from '../core/stateManager';
import { getOffset, getLimit } from '../operations/paginationOperations';
import { dataLayer } from '../../data/DataLayer';
import type { FactFilters, LocalBudgetFact } from '@db/pglite';

// ============================================================================
// Types
// ============================================================================

interface CreateTransferData {
    from_financial_center_id: number;
    to_financial_center_id: number;
    amount: number;
    transfer_date: string; // YYYY-MM-DD
    description: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build FactFilters from current filter state
 * Converts UI filters to PGlite-compatible format
 */
function buildFactFilters(): FactFilters {
    const filters = getFilters();

    const factFilters: FactFilters = {
        record_type: 'fact' // Always filter by facts (not plans)
    };

    // Add optional filters
    if (filters.user_id) factFilters.user_id = filters.user_id;
    if (filters.article_id) factFilters.article_id = filters.article_id;
    if (filters.article_type) factFilters.article_type = filters.article_type;
    if (filters.date_from) factFilters.date_from = filters.date_from;
    if (filters.date_to) factFilters.date_to = filters.date_to;
    if (filters.financial_center_id) factFilters.financial_center_id = filters.financial_center_id;
    if (filters.cost_center_id) factFilters.cost_center_id = filters.cost_center_id;
    if (filters.search) factFilters.search = filters.search;

    return factFilters;
}

/**
 * Convert LocalBudgetFact to BudgetFact
 * Note: Names (article_name, financial_center_name, etc.) are not available in PGlite
 * TODO: Add client-side join with reference data in future
 */
function convertBudgetFact(local: LocalBudgetFact): BudgetFact {
    return {
        id: local.id || 0,
        fact_date: local.date, // Already YYYY-MM-DD
        article_id: local.article_id,
        article_name: '', // TODO: Client-side join with local_articles
        article_type: 'expense', // TODO: Client-side join with local_articles
        financial_center_id: local.financial_center_id || 0,
        financial_center_name: '', // TODO: Client-side join with local_financial_centers
        cost_center_id: local.cost_center_id,
        cost_center_name: null, // TODO: Client-side join with local_cost_centers
        amount: Number(local.amount),
        description: local.comment,
        user_id: local.user_id,
        user_name: '', // TODO: Add user name lookup
        record_type: 'spend', // Default mapping from 'fact'
        created_at: local.created_at.toISOString(),
        updated_at: local.updated_at.toISOString()
    };
}

// ============================================================================
// Load Facts
// ============================================================================

/**
 * Load facts (PGlite-first with API fallback)
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadFacts(): Promise<LoadFactsResponse> {
    try {
        // Build filters for PGlite
        const factFilters = buildFactFilters();

        // Load all facts via DataLayer (PGlite-first + API fallback)
        const localFacts = await dataLayer.getFacts(factFilters);

        // Convert to UI types
        const allFacts = localFacts.map(convertBudgetFact);

        // Client-side pagination
        const limit = getLimit();
        const offset = getOffset();
        const facts = allFacts.slice(offset, offset + limit);

        return {
            facts,
            total: allFacts.length,
            page: Math.floor(offset / limit),
            page_size: limit
        };
    } catch (error) {
        console.error('[FACTS_API] Error loading facts:', error);
        throw new Error(`Failed to load facts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Load facts count (PGlite-first with API fallback)
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadFactsCount(): Promise<number> {
    try {
        // Build filters for PGlite
        const factFilters = buildFactFilters();

        // Get count via DataLayer (PGlite-first + API fallback)
        const total = await dataLayer.getFactsCount(factFilters);

        return total;
    } catch (error) {
        console.error('[FACTS_API] Error loading facts count:', error);
        throw new Error(`Failed to load facts count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Load facts and count in parallel
 * Returns both results for single API call optimization
 */
export async function loadFactsWithCount(): Promise<{
    facts: BudgetFact[];
    total: number;
}> {
    const [factsResponse, total] = await Promise.all([
        loadFacts(),
        loadFactsCount()
    ]);

    return {
        facts: factsResponse.facts,
        total
    };
}

// ============================================================================
// Get Single Fact
// ============================================================================

/**
 * Load single fact by ID
 * Used for edit modal population (Phase 2 fix)
 */
export async function getFact(factId: number): Promise<BudgetFact> {
    const response = await fetch(`/api/v1/facts/${factId}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Факт не найден');
        }
        const errorText = await response.text();
        throw new Error(`Failed to load fact: HTTP ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// ============================================================================
// Create Fact
// ============================================================================

/**
 * Create new fact
 * Supports offline mode via window.offlineManager if available
 */
export async function createFact(data: CreateFactData): Promise<BudgetFact> {
    // Use OfflineManager if available (offline support)
    if ((window as any).offlineManager) {
        const result = await (window as any).offlineManager.createFact(data);

        if (result._offline) {
            // Return result with offline flag (logged elsewhere)
            return { ...result, _offline: true } as OfflineFactResponse;
        }

        return result;
    }

    // Fallback to direct fetch if OfflineManager not available
    const response = await fetch('/api/v1/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// ============================================================================
// Update Fact
// ============================================================================

/**
 * Update existing fact
 */
export async function updateFact(factId: number, data: UpdateFactData): Promise<BudgetFact> {
    const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();

        // Parse validation errors for better UX
        let errorMsg = 'Ошибка сохранения';

        // Handle custom error format: {detail: {message: "...", errors: [...]}}
        if (error.detail && typeof error.detail === 'object') {
            if (Array.isArray(error.detail.errors) && error.detail.errors.length > 0) {
                // Custom validation error format
                errorMsg = error.detail.errors
                    .map((e: any) => e.message || e.msg || 'Unknown error')
                    .join('; ');
            } else if (typeof error.detail.message === 'string') {
                errorMsg = error.detail.message;
            } else if (typeof error.detail === 'string') {
                errorMsg = error.detail;
            } else if (Array.isArray(error.detail)) {
                // Pydantic format: [{loc: [...], msg: "...", type: "..."}]
                errorMsg = error.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
            } else {
                // Fallback: stringify unknown object
                errorMsg = JSON.stringify(error.detail);
            }
        } else if (typeof error.detail === 'string') {
            errorMsg = error.detail;
        } else {
            errorMsg = `HTTP error! status: ${response.status}`;
        }

        throw new Error(errorMsg);
    }

    return await response.json();
}

// ============================================================================
// Delete Fact
// ============================================================================

/**
 * Delete single fact
 */
export async function deleteFact(factId: number): Promise<void> {
    const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }
}

// ============================================================================
// Batch Delete
// ============================================================================

/**
 * Batch delete multiple facts
 */
export async function batchDeleteFacts(factIds: number[]): Promise<BatchDeleteResponse> {
    const response = await fetch('/api/v1/facts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(factIds)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// ============================================================================
// Create Transfer
// ============================================================================

/**
 * Create transfer between financial centers
 * Online only (no offline support)
 */
export async function createTransfer(data: CreateTransferData): Promise<any> {
    // Validate FROM ≠ TO
    if (data.from_financial_center_id === data.to_financial_center_id) {
        throw new Error('Счет отправления и получения должны различаться');
    }

    const response = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export filtered facts to CSV (admin only)
 * Returns download URL
 */
export function exportFactsToCSV(): string {
    const filters = buildFilterQuery();

    // Build admin export URL
    let url = '/api/v1/admin/export/all-facts/csv?';

    // Add all filters from URLSearchParams
    filters.forEach((value, key) => {
        url += `${key}=${encodeURIComponent(value)}&`;
    });

    // Trigger download via window.location
    return url;
}
