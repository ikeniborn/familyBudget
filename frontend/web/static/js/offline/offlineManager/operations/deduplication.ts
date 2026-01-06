/**
 * Offline Manager - Deduplication Logic
 *
 * Prevents duplicate operations during sync process.
 *
 * Phase 3: Testing Infrastructure - Step 3.4
 * Extracted from: frontend/web/static/js/offline/offlineManager.ts
 */

import type { IndexedDBManager } from '../../idb';

// Silent logger - only in debug mode
const _dedupLog = window.DEBUG_MODE ? console.log.bind(console) : function() {};

// ============================================================================
// Type Definitions
// ============================================================================

export interface DeduplicationCache {
    pendingOperations: Map<string, Promise<any>>;
}

export interface DeduplicationOptions {
    entity: string;
    data: any;
    timestamp?: number;
}

// ============================================================================
// Deduplication Cache
// ============================================================================

/**
 * Global deduplication cache for in-progress operations
 */
const _deduplicationCache: DeduplicationCache = {
    pendingOperations: new Map()
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Generate a unique operation key for deduplication
 *
 * @param entity - Entity type (fact, transfer, plan, etc.)
 * @param data - Operation data
 * @returns Unique operation key
 */
export function generateOperationKey(entity: string, _data: any): string {
    const timestamp = Date.now();
    const random = Math.random();
    return `${entity}_${timestamp}_${random}`;
}

/**
 * Check if operation is already in progress (deduplication)
 *
 * @param operationKey - Unique operation key
 * @returns true if operation is in progress, false otherwise
 */
export function isOperationInProgress(operationKey: string): boolean {
    return _deduplicationCache.pendingOperations.has(operationKey);
}

/**
 * Get pending operation promise (for deduplication)
 *
 * @param operationKey - Unique operation key
 * @returns Promise for the in-progress operation, or undefined
 */
export function getPendingOperation(operationKey: string): Promise<any> | undefined {
    return _deduplicationCache.pendingOperations.get(operationKey);
}

/**
 * Register operation as in-progress (for deduplication)
 *
 * @param operationKey - Unique operation key
 * @param promise - Promise for the operation
 */
export function registerOperation(operationKey: string, promise: Promise<any>): void {
    _deduplicationCache.pendingOperations.set(operationKey, promise);
}

/**
 * Unregister completed operation (cleanup)
 *
 * @param operationKey - Unique operation key
 */
export function unregisterOperation(operationKey: string): void {
    _deduplicationCache.pendingOperations.delete(operationKey);
}

/**
 * Execute operation with deduplication protection
 *
 * Prevents duplicate operations by:
 * 1. Checking if operation is already in progress
 * 2. If yes, return the existing promise
 * 3. If no, register and execute the operation
 * 4. Cleanup after completion
 *
 * @param operationKey - Unique operation key
 * @param operation - Async function to execute
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * const key = generateOperationKey('fact', factData);
 * const result = await executeWithDeduplication(key, async () => {
 *   return await createFactImpl(factData);
 * });
 * ```
 */
export async function executeWithDeduplication<T>(
    operationKey: string,
    operation: () => Promise<T>
): Promise<T> {
    // Check if operation already in progress
    if (isOperationInProgress(operationKey)) {
        _dedupLog('[Deduplication] Operation already in progress, waiting:', operationKey);
        return getPendingOperation(operationKey)! as Promise<T>;
    }

    // Register operation
    const promise = operation();
    registerOperation(operationKey, promise);

    try {
        // Execute and return result
        return await promise;
    } finally {
        // Cleanup
        unregisterOperation(operationKey);
    }
}

/**
 * Check for duplicate data by content hash (IndexedDB-based)
 *
 * Uses content hash to detect duplicate data even if operation keys differ.
 * This prevents creating duplicate facts with same content.
 *
 * @param db - IndexedDB manager instance
 * @param data - Data to check for duplicates
 * @returns true if duplicate found, false otherwise
 *
 * @example
 * ```typescript
 * const isDuplicate = await checkContentDuplicate(db, factData);
 * if (isDuplicate) {
 *   throw new Error('Duplicate fact detected');
 * }
 * ```
 */
export async function checkContentDuplicate(
    db: IndexedDBManager,
    data: any
): Promise<boolean> {
    // Generate content hash
    const contentHash = db.generateContentHash(data);

    // Check for existing item with same content hash
    const duplicate = await db.checkDuplicateByHash(contentHash);

    if (duplicate) {
        console.warn('[Deduplication] Content duplicate detected:', {
            existingTempId: duplicate.tempId,
            contentHash
        });
        return true;
    }

    return false;
}

/**
 * Get deduplication cache statistics (for debugging)
 *
 * @returns Current cache statistics
 */
export function getDeduplicationStats(): {
    pendingCount: number;
    pendingKeys: string[];
} {
    return {
        pendingCount: _deduplicationCache.pendingOperations.size,
        pendingKeys: Array.from(_deduplicationCache.pendingOperations.keys())
    };
}

/**
 * Clear deduplication cache (for testing/reset)
 *
 * CAUTION: Only use for testing or manual reset
 */
export function clearDeduplicationCache(): void {
    _deduplicationCache.pendingOperations.clear();
}
