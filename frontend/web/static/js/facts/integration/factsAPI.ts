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
import type {
    FactFilters,
    LocalBudgetFact,
    LocalArticle,
    LocalFinancialCenter,
    LocalCostCenter
} from '@db/dexie';
import { getDexieManager, isDexieActive, mapAPIFactToLocal } from '@db/dexie';

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
 * Convert LocalBudgetFact to BudgetFact
 * Note: Names (article_name, financial_center_name, etc.) are not available in Dexie
 * TODO: Add client-side join with reference data in future
 */
/**
 * Lookup maps for enriching facts with reference data
 */
interface EnrichmentMaps {
    articles: Map<number, LocalArticle>;
    financialCenters: Map<number, LocalFinancialCenter>;
    costCenters: Map<number, LocalCostCenter>;
}

/**
 * Convert LocalBudgetFact to BudgetFact with optional enrichment
 *
 * @param local - Raw fact from Dexie
 * @param maps - Optional reference data for enrichment (client-side join)
 * @returns BudgetFact with all fields populated
 */
function convertBudgetFact(local: LocalBudgetFact, maps?: EnrichmentMaps): BudgetFact {
    // Client-side join: Lookup reference data if maps provided
    const article = maps?.articles.get(local.article_id);
    const fc = maps?.financialCenters.get(local.financial_center_id || 0);
    const cc = local.cost_center_id && maps ? maps.costCenters.get(local.cost_center_id) : null;

    return {
        id: local.id || 0,
        temp_id: local.temp_id,    // Preserve Dexie temp_id for write operations (task-015 Phase 4.4)
        fact_date: local.date, // Already YYYY-MM-DD
        article_id: local.article_id,
        article_name: article?.name || '',
        article_type: (article?.type as any) || 'expense',
        financial_center_id: local.financial_center_id || 0,
        financial_center_name: fc?.name || '',
        cost_center_id: local.cost_center_id,
        cost_center_name: cc?.name || null,
        amount: Number(local.amount),
        description: local.comment,
        user_id: local.user_id,
        user_name: '', // User names not stored in reference data (multi-user shared facts)
        record_type: 'spend', // Default mapping from 'fact'
        // DEFENSIVE: Dexie returns TIMESTAMP as ISO strings, but types define Date
        // Runtime check provides backward compatibility with both API (Date) and Dexie (string)
        created_at: typeof local.created_at === 'string' ? local.created_at : local.created_at.toISOString(),
        updated_at: typeof local.updated_at === 'string' ? local.updated_at : local.updated_at.toISOString()
    };
}

// ============================================================================
// Load Facts
// ============================================================================

/**
 * Load reference data for enriching facts (client-side join)
 * Used when Dexie is active to populate name fields
 *
 * @param userId - User ID for loading financial centers and cost centers
 * @returns Lookup maps for articles, financial centers, and cost centers
 */
async function loadEnrichmentMaps(userId: number): Promise<EnrichmentMaps> {
    // Load reference data from DataLayer (Dexie or API)
    const [articles, financialCenters, costCenters] = await Promise.all([
        dataLayer.getArticles(),
        dataLayer.getFinancialCenters(userId, true),
        dataLayer.getCostCenters(userId, null, true)
    ]);

    // Create lookup maps for O(1) access during conversion
    return {
        articles: new Map(articles.map(a => [a.id, a])),
        financialCenters: new Map(financialCenters.map(fc => [fc.id, fc])),
        costCenters: new Map(costCenters.map(cc => [cc.id, cc]))
    };
}

/**
 * Load facts (Dexie-first with API fallback)
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadFacts(): Promise<LoadFactsResponse> {
    try {
        // Build filters for Dexie
        const factFilters = buildFactFilters();

        // Load all facts via DataLayer (Dexie-first + API fallback)
        const localFacts = await dataLayer.getFacts(factFilters);

        // Convert to UI types with enrichment (if Dexie active)
        let allFacts: BudgetFact[];

        if (isDexieActive() && localFacts.length > 0) {
            // Load reference data for client-side join
            const userId = localFacts[0].user_id;
            const enrichmentMaps = await loadEnrichmentMaps(userId);

            // Convert with enrichment (single pass - O(n))
            allFacts = localFacts.map(fact => convertBudgetFact(fact, enrichmentMaps));
        } else {
            // No enrichment needed (API provides full data or empty result)
            allFacts = localFacts.map(fact => convertBudgetFact(fact));
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
 * Load facts count (Dexie-first with API fallback)
 * Uses DataLayer for unified data access (task-015 phase 3)
 */
export async function loadFactsCount(): Promise<number> {
    try {
        // Build filters for Dexie
        const factFilters = buildFactFilters();

        // Get count via DataLayer (Dexie-first + API fallback)
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

        // Sync Dexie cache: insert new fact so loadFacts() sees it immediately
        // Without this, Dexie returns stale data and the new fact won't appear
        if (isDexieActive()) {
            try {
                const dexie = await getDexieManager();
                if (dexie.isReady()) {
                    const localFact = mapAPIFactToLocal(createdFact);
                    await dexie.bulkUpdateFacts([localFact]);
                    console.debug('[FACTS_API] Synced new fact to Dexie cache', { id: createdFact.id });
                }
            } catch (cacheError) {
                // Non-critical: fact is on server, cache miss just means stale UI until refresh
                console.warn('[FACTS_API] Failed to sync to Dexie cache:', cacheError);
            }
        }

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
 * Helper: Find fact temp_id by server ID
 */
async function findFactTempId(factId: number): Promise<string | null> {
    const dexie = await getDexieManager();
    if (!isDexieActive() || !dexie.isReady()) {
        return null;
    }

    try {
        const facts = await dexie.queryFacts({});
        const fact = facts.find(f => f.id === factId);
        return fact?.temp_id || null;
    } catch (error) {
        console.error('[FACTS_API] Error finding fact temp_id:', error);
        return null;
    }
}

/**
 * Update existing fact
 * Dexie-first with API fallback (task-015 Phase 4.4)
 */
export async function updateFact(factId: number, data: UpdateFactData): Promise<BudgetFact> {
    const dexie = await getDexieManager();

    try {
        // Dexie-first strategy
        if (isDexieActive() && dexie.isReady()) {
            // Find fact temp_id by server ID
            const temp_id = await findFactTempId(factId);
            if (!temp_id) {
                throw new Error('Fact temp_id not found, cannot update via Dexie');
            }

            // Update in Dexie (auto-adds to pending queue)
            await dexie.updateFact(temp_id, {
                date: data.fact_date,
                amount: data.amount,
                article_id: data.article_id,
                financial_center_id: data.financial_center_id,
                cost_center_id: data.cost_center_id || null,
                comment: data.description
            });


            // Return placeholder (UI will reload from Dexie)
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
 * Dexie-first with API fallback (task-015 Phase 4.4)
 */
export async function deleteFact(factId: number): Promise<void> {
    const dexie = await getDexieManager();

    try {
        // Dexie-first strategy
        if (isDexieActive() && dexie.isReady()) {
            // Find fact temp_id by server ID
            const temp_id = await findFactTempId(factId);
            if (!temp_id) {
                throw new Error('Fact temp_id not found, cannot delete via Dexie');
            }

            // Delete in Dexie (soft delete, adds to pending queue)
            await dexie.deleteFact(temp_id);
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
