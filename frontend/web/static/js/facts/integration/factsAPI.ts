/**
 * Facts Manager - Facts API Integration
 *
 * CRUD operations for budget facts.
 *
 * Phase 1.4: Extract API Integration
 * Extracted from: frontend/web/templates/facts.html (lines 1304-2161)
 */

import type { BudgetFact, LoadFactsResponse, BatchDeleteResponse, CreateFactData, UpdateFactData } from '../types/models';
import { buildFilterQuery } from '../operations/filterOperations';
import { getFilters } from '../core/stateManager';
import { getOffset, getLimit } from '../operations/paginationOperations';
import { dataLayer } from '../../data/DataLayer';
import type { FactFilters, LocalBudgetFact } from '@db/dexie';
import { getDexieManager, isDexieActive } from '@db/dexie';

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
        temp_id: local.temp_id,    // Preserve PGlite temp_id for write operations (task-015 Phase 4.4)
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
        // DEFENSIVE: PGlite returns TIMESTAMP as ISO strings, but types define Date
        // Runtime check provides backward compatibility with both API (Date) and PGlite (string)
        // TODO (task-016): Normalize LocalBudgetFact.created_at type to string at PGlite query layer
        created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
        updated_at: typeof local.updated_at === 'string' ? local.updated_at : local.updated_at.toISOString()
    };
}

// ============================================================================
// Load Facts
// ============================================================================

/**
 * Enrich facts with names from reference data (client-side join)
 * Fixes Bug #4: convertBudgetFact() leaves names empty when using Dexie
 *
 * @param facts - Facts with empty name fields
 * @returns Facts enriched with article_name, financial_center_name, cost_center_name
 */
async function enrichFactsWithNames(facts: BudgetFact[]): Promise<BudgetFact[]> {
    try {
        // Get user ID (from first fact or filters)
        const userId = facts.length > 0 ? facts[0].user_id : getFilters().user_id || 1;

        // Load reference data from DataLayer (Dexie or API)
        const [articles, financialCenters, costCenters] = await Promise.all([
            dataLayer.getArticles(),
            dataLayer.getFinancialCenters(userId, true),
            dataLayer.getCostCenters(userId, null, true)
        ]);

        // Create lookup maps for fast access
        const articleMap = new Map(articles.map(a => [a.id, a]));
        const fcMap = new Map(financialCenters.map(fc => [fc.id, fc]));
        const ccMap = new Map(costCenters.map(cc => [cc.id, cc]));

        // Enrich each fact
        return facts.map(fact => {
            const article = articleMap.get(fact.article_id);
            const fc = fcMap.get(fact.financial_center_id);
            const cc = fact.cost_center_id ? ccMap.get(fact.cost_center_id) : null;

            return {
                ...fact,
                article_name: article?.name || fact.article_name || '',
                article_type: (article?.type as any) || fact.article_type || 'expense',
                financial_center_name: fc?.name || fact.financial_center_name || '',
                cost_center_name: cc?.name || fact.cost_center_name || null
            };
        });
    } catch (error) {
        console.error('[FACTS_API] Error enriching facts with names:', error);
        // Return facts as-is if enrichment fails
        return facts;
    }
}

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
        let allFacts = localFacts.map(convertBudgetFact);

        // BUG FIX: Enrich facts with names from reference data (client-side join)
        // Fixes Bug #4: Table shows "undefined" and "—" instead of actual names
        if (isDexieActive()) {
            allFacts = await enrichFactsWithNames(allFacts);
        }

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
 * PGlite-first with API fallback (task-015 Phase 4.4)
 */
export async function createFact(data: CreateFactData): Promise<BudgetFact> {
    const pglite = await getDexieManager();

    try {
        // PGlite-first strategy
        if (isDexieActive() && pglite.isReady()) {
            // Get user ID
            const userId = (window as any).offlineManager
                ? await (window as any).offlineManager.getCurrentUserId()
                : null;

            if (!userId) {
                throw new Error('User ID not available');
            }

            // Map CreateFactData to LocalBudgetFact format
            const temp_id = await pglite.createFact({
                user_id: userId,
                article_id: data.article_id,
                financial_center_id: data.financial_center_id,
                cost_center_id: data.cost_center_id || null,
                date: data.fact_date,
                amount: data.amount,
                record_type: data.record_type,
                comment: data.description,
                transfer_group_id: null,
                is_transfer: false,
                sync_hash: null
            });


            // Return placeholder BudgetFact (UI will reload from PGlite)
            return {
                id: 0,
                temp_id,
                fact_date: data.fact_date,
                article_id: data.article_id,
                article_name: '',
                article_type: data.fact_type,
                financial_center_id: data.financial_center_id,
                financial_center_name: '',
                cost_center_id: data.cost_center_id || null,
                cost_center_name: null,
                amount: data.amount,
                description: data.description,
                user_id: userId,
                user_name: '',
                record_type: 'spend',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }

        // Fallback to direct API
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
    } catch (error) {
        console.error('[FACTS_API] Error creating fact:', error);
        throw error;
    }
}

// ============================================================================
// Update Fact
// ============================================================================

/**
 * Helper: Find fact temp_id by server ID
 */
async function findFactTempId(factId: number): Promise<string | null> {
    const pglite = await getDexieManager();
    if (!isDexieActive() || !pglite.isReady()) {
        return null;
    }

    try {
        const facts = await pglite.queryFacts({});
        const fact = facts.find(f => f.id === factId);
        return fact?.temp_id || null;
    } catch (error) {
        console.error('[FACTS_API] Error finding fact temp_id:', error);
        return null;
    }
}

/**
 * Update existing fact
 * PGlite-first with API fallback (task-015 Phase 4.4)
 */
export async function updateFact(factId: number, data: UpdateFactData): Promise<BudgetFact> {
    const pglite = await getDexieManager();

    try {
        // PGlite-first strategy
        if (isDexieActive() && pglite.isReady()) {
            // Find fact temp_id by server ID
            const temp_id = await findFactTempId(factId);
            if (!temp_id) {
                throw new Error('Fact temp_id not found, cannot update via PGlite');
            }

            // Update in PGlite (auto-adds to pending queue)
            await pglite.updateFact(temp_id, {
                date: data.fact_date,
                amount: data.amount,
                article_id: data.article_id,
                financial_center_id: data.financial_center_id,
                cost_center_id: data.cost_center_id || null,
                comment: data.description
            });


            // Return placeholder (UI will reload from PGlite)
            return {
                id: factId,
                temp_id,
                fact_date: data.fact_date,
                article_id: data.article_id,
                article_name: '',
                article_type: 'expense',
                financial_center_id: data.financial_center_id,
                financial_center_name: '',
                cost_center_id: data.cost_center_id || null,
                cost_center_name: null,
                amount: data.amount,
                description: data.description,
                user_id: 0,
                user_name: '',
                record_type: 'spend',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }

        // Fallback to direct API
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
    } catch (error) {
        console.error('[FACTS_API] Error updating fact:', error);
        throw error;
    }
}

// ============================================================================
// Delete Fact
// ============================================================================

/**
 * Delete single fact
 * PGlite-first with API fallback (task-015 Phase 4.4)
 */
export async function deleteFact(factId: number): Promise<void> {
    const pglite = await getDexieManager();

    try {
        // PGlite-first strategy
        if (isDexieActive() && pglite.isReady()) {
            // Find fact temp_id by server ID
            const temp_id = await findFactTempId(factId);
            if (!temp_id) {
                throw new Error('Fact temp_id not found, cannot delete via PGlite');
            }

            // Delete in PGlite (soft delete, adds to pending queue)
            await pglite.deleteFact(temp_id);
            return;
        }

        // Fallback to direct API
        const response = await fetch(`/api/v1/facts/${factId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }

    } catch (error) {
        console.error('[FACTS_API] Error deleting fact:', error);
        throw error;
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
