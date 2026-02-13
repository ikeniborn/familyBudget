/**
 * Shopping List ID Utilities
 *
 * Utilities for handling shopping list ID heuristics (temp_id vs server_id).
 *
 * Context: PR #416 introduced temp_id (BIGINT) for offline-first support.
 * Legacy lists (created before PR #416) have temp_id = NULL in DB.
 * This module provides heuristics to distinguish between temp_id and server_id.
 *
 * @version 11.6.1
 */

/**
 * Heuristic threshold to distinguish temp_id from server_id.
 *
 * - **temp_id (BIGINT)**: Random int53 value (typically > 1 trillion)
 * - **server_id (INTEGER)**: Auto-increment sequence (typically < 10000)
 *
 * **Rationale:**
 * - temp_id generated via secrets.randbelow(9007199254740991) → very large numbers
 * - server_id from PostgreSQL SERIAL → increments from 1
 *
 * **Safety margin:**
 * - Threshold set to 10,000 (accommodates databases with up to 10k lists)
 * - Actual temp_id values are ~4.5 quadrillion (int53 max)
 * - Probability of collision: virtually zero
 *
 * **Future-proofing:**
 * - If production exceeds 10k lists, update threshold to 100k or higher
 * - Alternative: migrate all legacy lists to have temp_id (optional)
 */
export const LIST_ID_HEURISTIC_THRESHOLD = 10_000;

/**
 * Determine if a list ID represents a temp_id or server_id.
 *
 * @param listId - List identifier (could be temp_id or server_id)
 * @returns 'temp_id' if large BIGINT, 'server_id' if small INTEGER, 'invalid' if problematic
 *
 * @example
 * ```typescript
 * getListIdType(35) // 'server_id' (legacy list)
 * getListIdType(4508494054591253) // 'temp_id' (new list)
 * getListIdType(0) // 'invalid'
 * getListIdType(-1) // 'invalid'
 * ```
 */
export function getListIdType(
  listId: number
): 'temp_id' | 'server_id' | 'invalid' {
  // Validation: reject invalid IDs
  if (!Number.isInteger(listId) || listId <= 0) {
    console.warn(
      `[ListIdUtils] Invalid list ID: ${listId} (must be positive integer)`
    );
    return 'invalid';
  }

  // Edge case: IDs near threshold (9900-10100) are ambiguous
  // Log warning for manual review
  if (
    listId >= LIST_ID_HEURISTIC_THRESHOLD * 0.99 &&
    listId <= LIST_ID_HEURISTIC_THRESHOLD * 1.01
  ) {
    console.warn(
      `[ListIdUtils] Ambiguous list ID near threshold: ${listId} ` +
        `(threshold: ${LIST_ID_HEURISTIC_THRESHOLD})`
    );
  }

  // Heuristic: temp_id >= threshold, server_id < threshold
  return listId < LIST_ID_HEURISTIC_THRESHOLD ? 'server_id' : 'temp_id';
}

/**
 * Validate that a list ID is suitable for use.
 *
 * @param listId - List identifier to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidListId(35) // true
 * isValidListId(4508494054591253) // true
 * isValidListId(0) // false
 * isValidListId(-1) // false
 * isValidListId(NaN) // false
 * ```
 */
export function isValidListId(listId: number): boolean {
  return Number.isInteger(listId) && listId > 0;
}

/**
 * Get API parameter name for shopping list items request.
 *
 * Backend supports two parameters:
 * - `shopping_list_id` (INTEGER) - for legacy lists without temp_id
 * - `shopping_list_temp_id` (BIGINT) - for new lists with temp_id
 *
 * @param listId - List identifier (temp_id or server_id)
 * @returns API parameter name to use
 *
 * @throws Error if listId is invalid
 *
 * @example
 * ```typescript
 * getApiParameterName(35) // 'shopping_list_id'
 * getApiParameterName(4508494054591253) // 'shopping_list_temp_id'
 * getApiParameterName(0) // throws Error
 * ```
 */
export function getApiParameterName(
  listId: number
): 'shopping_list_id' | 'shopping_list_temp_id' {
  const idType = getListIdType(listId);

  if (idType === 'invalid') {
    throw new Error(
      `[ListIdUtils] Cannot determine API parameter for invalid list ID: ${listId}`
    );
  }

  return idType === 'server_id' ? 'shopping_list_id' : 'shopping_list_temp_id';
}

/**
 * Development mode debug logging flag.
 *
 * Set to true to enable verbose logging of list ID heuristics.
 * Should be false in production to avoid log pollution.
 */
export const LIST_ID_DEBUG = process.env.NODE_ENV === 'development';

/**
 * Log list ID heuristic decision (conditional on debug flag).
 *
 * @param listId - List identifier
 * @param parameterName - API parameter name selected
 */
export function debugLogListIdHeuristic(
  listId: number,
  parameterName: 'shopping_list_id' | 'shopping_list_temp_id'
): void {
  if (!LIST_ID_DEBUG) return;

  const idType = getListIdType(listId);
  console.debug(
    `[ListIdUtils] ID=${listId} → type=${idType} → param=${parameterName}`
  );
}
