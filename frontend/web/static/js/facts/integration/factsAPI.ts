/**
 * Facts Manager - Facts API Integration
 *
 * CRUD operations for budget facts.
 *
 * Phase 1.4: Extract API Integration
 * Extracted from: frontend/web/templates/facts.html (lines 1304-2161)
 */

import type { BudgetFact, LoadFactsResponse, BatchDeleteResponse, CreateFactData, UpdateFactData, FactFilters } from '../types/models';
import { buildFilterQuery } from '../operations/filterOperations';
import { getFilters } from '../core/stateManager';
import { getOffset, getLimit } from '../operations/paginationOperations';

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
 * Converts UI filters to Dexie-compatible format
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
 * Convert API fact response directly to BudgetFact
 * API already provides all name fields via JOINs on the backend
 */
function convertAPIFact(apiFact: Record<string, any>): BudgetFact {
    return {
        id: apiFact.id || 0,
        fact_date: apiFact.fact_date,
        article_id: apiFact.article_id,
        article_name: apiFact.article_name || '',
        article_type: apiFact.article_type || 'expense',
        financial_center_id: apiFact.financial_center_id || 0,
        financial_center_name: apiFact.financial_center_name || '',
        cost_center_id: apiFact.cost_center_id || null,
        cost_center_name: apiFact.cost_center_name || null,
        amount: Number(apiFact.amount),
        description: apiFact.description,
        user_id: apiFact.user_id,
        user_name: apiFact.user_name || '',
        record_type: apiFact.record_type === 'fact' ? 'spend' : apiFact.record_type || 'spend',
        created_at: typeof apiFact.created_at === 'string' ? apiFact.created_at : apiFact.created_at?.toISOString?.() || '',
        updated_at: typeof apiFact.updated_at === 'string' ? apiFact.updated_at : apiFact.updated_at?.toISOString?.() || ''
    };
}

// ============================================================================
// Load Facts
// ============================================================================

/**
 * Load facts via direct REST API
 */
export async function loadFacts(): Promise<LoadFactsResponse> {
    const factFilters = buildFactFilters();
    const params = new URLSearchParams();
    if (factFilters.record_type)        params.set('record_type', factFilters.record_type);
    if (factFilters.user_id)            params.set('user_id', String(factFilters.user_id));
    if (factFilters.article_id)         params.set('article_id', String(factFilters.article_id));
    if (factFilters.article_type)       params.set('article_type', factFilters.article_type);
    if (factFilters.date_from)          params.set('date_from', factFilters.date_from);
    if (factFilters.date_to)            params.set('date_to', factFilters.date_to);
    if (factFilters.financial_center_id) params.set('financial_center_id', String(factFilters.financial_center_id));
    if (factFilters.cost_center_id)     params.set('cost_center_id', String(factFilters.cost_center_id));
    if (factFilters.search)             params.set('search', factFilters.search);
    params.set('limit', String(getLimit()));
    params.set('offset', String(getOffset()));

    const response = await fetch(`/api/v1/facts?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const facts: BudgetFact[] = (data.facts ?? data).map(convertAPIFact);
    return {
        facts,
        total: data.total ?? facts.length,
        page: Math.floor(getOffset() / getLimit()),
        page_size: getLimit()
    };
}

/**
 * Load facts count via direct REST API
 */
export async function loadFactsCount(): Promise<number> {
    const factFilters = buildFactFilters();
    const params = new URLSearchParams();
    Object.entries(factFilters).forEach(([k, v]) => v != null && params.set(k, String(v)));
    const response = await fetch(`/api/v1/facts/count?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.total ?? 0;
}

/**
 * Load facts and count in parallel
 * Returns both results for single API call optimization
 */
export async function loadFactsWithCount(): Promise<{
    facts: BudgetFact[];
    total: number;
}> {
    const factsResponse = await loadFacts();
    return {
        facts: factsResponse.facts,
        total: factsResponse.total
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
 * Create new fact via API
 * API-first: sends directly to server for reliable persistence
 */
export async function createFact(data: CreateFactData): Promise<BudgetFact> {
    try {
        // API-first strategy: always send to server for reliable persistence
        // Dexie-first was causing data loss (fact saved to IndexedDB only,
        // never synced to server, disappeared on page reload)
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

        const createdFact = await response.json();
        return createdFact;
    } catch (error) {
        console.error('[FACTS_API] Error creating fact:', error);
        throw error;
    }
}

// ============================================================================
// Update Fact
// ============================================================================

/**
 * Update existing fact
 * API-first: sends directly to server for reliable persistence (aligned with createFact pattern)
 */
export async function updateFact(factId: number, data: UpdateFactData): Promise<BudgetFact> {
    try {
        // API-first strategy: always send to server for reliable persistence
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
                    errorMsg = error.detail.errors
                        .map((e: any) => e.message || e.msg || 'Unknown error')
                        .join('; ');
                } else if (typeof error.detail.message === 'string') {
                    errorMsg = error.detail.message;
                } else if (typeof error.detail === 'string') {
                    errorMsg = error.detail;
                } else if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
                } else {
                    errorMsg = JSON.stringify(error.detail);
                }
            } else if (typeof error.detail === 'string') {
                errorMsg = error.detail;
            } else {
                errorMsg = `HTTP error! status: ${response.status}`;
            }

            throw new Error(errorMsg);
        }

        const updatedFact = await response.json();
        return updatedFact;
    } catch (error) {
        console.error('[FACTS_API] Error updating fact:', error);
        throw error;
    }
}

// ============================================================================
// Delete Fact
// ============================================================================

/**
 * Delete single fact via direct REST API
 */
export async function deleteFact(factId: number): Promise<void> {
    const response = await fetch(`/api/v1/facts/${factId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const error = await response.json();
            if (error.detail) errorMsg = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
        } catch { /* non-JSON error */ }
        throw new Error(errorMsg);
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
