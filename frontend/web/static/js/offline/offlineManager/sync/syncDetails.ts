/**
 * Sync Details - Advanced Sync Operations
 * Handles verification, detailed sync operations, and error detection
 *
 * Extracted from offlineManager.js:1026-1570
 */

import type { SyncQueueItem } from '../types/dependencies';

/**
 * Verify entity exists on server after sync (POST-sync verification)
 * Only verifies create operations
 *
 * @param item - Sync queue item
 * @param response - Server response with created entity
 * @returns true if verified, false if verification failed
 */
export async function verifyOnServer(item: SyncQueueItem, response: any): Promise<boolean> {
  if (item.operation !== 'create') {
    return true; // Only verify creates
  }

  if (!response || !response.id) {
    return false; // No ID in response
  }

  const endpoint = getEndpoint(item.entity_type, response.id);

  try {
    const verifyResponse = await fetch(endpoint, {
      credentials: 'include',
      // Short timeout for verification
      signal: AbortSignal.timeout(3000),
    });

    return verifyResponse.ok;
  } catch (e) {
    // Verification failed (timeout, network error, etc.)
    return false;
  }
}

/**
 * Get API endpoint for entity type
 *
 * @param entityType - Entity type (fact, transfer, plan, recurring_plan)
 * @param id - Optional entity ID for GET/PATCH/DELETE
 * @returns API endpoint URL
 */
function getEndpoint(entityType: string, id?: number): string {
  const baseEndpoints: Record<string, string> = {
    fact: '/api/v1/facts',
    transfer: '/api/v1/transfers',
    plan: '/api/v1/facts', // Plans use facts endpoint with record_type='plan'
    recurring_plan: '/api/v1/recurring-plans',
  };

  const base = baseEndpoints[entityType];
  if (!base) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  return id ? `${base}/${id}` : base;
}

/**
 * Sync create operation
 * Cleans data, sends to server, handles errors
 *
 * @param item - Sync queue item
 * @returns Server response
 * @throws Error if sync failed
 */
export async function syncCreate(item: SyncQueueItem): Promise<any> {
  const data = cleanDataForSync(item.data);
  const endpoint = getEndpoint(item.entity_type);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Sync failed: HTTP ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Sync update operation
 *
 * @param item - Sync queue item
 * @returns Server response
 * @throws Error if sync failed
 */
export async function syncUpdate(item: SyncQueueItem): Promise<any> {
  const { id, ...updates } = item.data;

  if (!id) {
    throw new Error('Cannot update without ID');
  }

  const data = cleanDataForSync(updates);
  const endpoint = getEndpoint(item.entity_type, id);

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Sync failed: HTTP ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Sync delete operation
 *
 * @param item - Sync queue item
 * @throws Error if sync failed
 */
export async function syncDelete(item: SyncQueueItem): Promise<void> {
  const { id } = item.data;

  if (!id) {
    throw new Error('Cannot delete without ID');
  }

  const endpoint = getEndpoint(item.entity_type, id);

  const response = await fetch(endpoint, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Sync failed: HTTP ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMessage);
  }
}

/**
 * Detect if error is a network error (vs application error)
 * Network errors should retry, application errors should fail permanently
 *
 * @param error - Error object
 * @returns true if network error, false if application error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  // AbortController timeout
  if (error.name === 'AbortError') return true;

  // Fetch network errors
  if (error.name === 'NetworkError') return true;
  if (error.name === 'TypeError' && error.message.includes('fetch')) return true;

  // Timeout messages
  if (error.message && typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout')) return true;
    if (msg.includes('failed to fetch')) return true;
    if (msg.includes('network')) return true;
    if (msg.includes('offline')) return true;
  }

  // HTTP 5xx errors are server errors (retry)
  if (error.message && error.message.includes('HTTP 5')) return true;

  // HTTP 4xx errors are client errors (don't retry)
  if (error.message && error.message.includes('HTTP 4')) return false;

  // Unknown error - assume network issue (safer to retry)
  return true;
}

/**
 * Clean data before sync
 * Removes display-only fields that backend doesn't expect
 *
 * @param data - Raw data
 * @returns Cleaned data
 */
export function cleanDataForSync(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const cleaned = { ...data };

  // Remove display-only fields
  delete cleaned.tempId;
  delete cleaned._offline;
  delete cleaned._synced;
  delete cleaned._duplicate;

  // Remove UI metadata fields
  delete cleaned.article_name;
  delete cleaned.financial_center_name;
  delete cleaned.cost_center_name;
  delete cleaned.created_at_formatted;
  delete cleaned.updated_at_formatted;

  return cleaned;
}

/**
 * Calculate exponential backoff delay
 *
 * @param retries - Number of retries so far
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(retries: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);

  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}
