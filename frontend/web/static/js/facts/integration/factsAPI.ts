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
// Load Facts
// ============================================================================

/**
 * Load facts from API with current filters and pagination
 */
export async function loadFacts(): Promise<LoadFactsResponse> {
    const params = buildFilterQuery();

    // Add pagination
    params.append('limit', String(getLimit()));
    params.append('offset', String(getOffset()));

    const response = await fetch(`/api/v1/facts?${params}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load facts: HTTP ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
        facts: data.facts || [],
        total: data.total || 0,
        page: Math.floor(getOffset() / getLimit()),
        page_size: getLimit()
    };
}

/**
 * Load facts count (without pagination)
 * Uses separate endpoint for better performance
 */
export async function loadFactsCount(): Promise<number> {
    const params = buildFilterQuery();

    // Remove pagination params
    params.delete('limit');
    params.delete('offset');

    const response = await fetch(`/api/v1/facts/count?${params}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load facts count: HTTP ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.total;
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
