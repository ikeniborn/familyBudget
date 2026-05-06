/**
 * API Response ↔ Dexie Schema Field Mapper
 *
 * Fixes: "Failed to execute 'add' on 'IDBObjectStore': Evaluating the object store's key path did not yield a value"
 *
 * Problem: API response field names don't match Dexie schema:
 * - API: fact_date, description, missing temp_id/sync_status/transfer_group_id
 * - Dexie: date, comment, requires temp_id (PRIMARY KEY), sync_status (indexed)
 *
 * Solution: Bidirectional mapping + default value injection
 */

import { generateUUID } from './hash';
import type { LocalBudgetFact } from '../types/fact';

/**
 * Field name mapping configuration
 *
 * API FactResponse schema:
 * - fact_date (API) → date (Dexie)
 * - description (API) → comment (Dexie)
 * - transfer_id (API, future) → transfer_group_id (Dexie)
 */
export const FACT_FIELD_MAPPING = {
  toLocal: {
    'fact_date': 'date',
    'description': 'comment',
    'transfer_id': 'transfer_group_id'  // May not exist in API yet
  },
  toAPI: {
    'date': 'fact_date',
    'comment': 'description',
    'transfer_group_id': 'transfer_id'
  }
} as const;

/**
 * Map API fact response to Dexie LocalBudgetFact
 *
 * Handles:
 * - Field name mapping (fact_date → date, description → comment)
 * - Missing required fields (temp_id, sync_status, synced_at)
 * - Type conversion (Date strings → Date objects)
 * - Default values for optional fields
 *
 * @param apiFact - Raw API response fact
 * @returns Mapped LocalBudgetFact ready for Dexie storage
 *
 * @example
 * const apiFact = {
 *   id: 123,
 *   user_id: 1,
 *   article_id: 5,
 *   financial_center_id: 2,
 *   cost_center_id: null,
 *   fact_date: "2026-02-06",           // API field name
 *   description: "Test transaction",   // API field name
 *   amount: 10000,                     // cents (100.00 dollars)
 *   record_type: "fact",
 *   created_at: "2026-02-06T10:00:00Z",
 *   updated_at: "2026-02-06T10:00:00Z"
 * };
 *
 * const dexieFact = mapAPIFactToLocal(apiFact);
 * // {
 * //   temp_id: "server-123",           // Generated
 * //   id: 123,
 * //   date: "2026-02-06",              // Mapped from fact_date
 * //   comment: "Test transaction",     // Mapped from description
 * //   sync_status: "synced",           // Generated
 * //   transfer_group_id: null,         // Default
 * //   is_transfer: false,              // Computed
 * //   synced_at: Date(...),            // Generated
 * //   ...
 * // }
 */
export function mapAPIFactToLocal(apiFact: Record<string, any>): LocalBudgetFact {
  const mapped: Record<string, any> = { ...apiFact };

  // 1. Apply field name mappings (fact_date → date, description → comment)
  for (const [apiField, dexieField] of Object.entries(FACT_FIELD_MAPPING.toLocal)) {
    if (apiField in mapped) {
      mapped[dexieField] = mapped[apiField];
      delete mapped[apiField];
    }
  }

  // 2. Generate temp_id (PRIMARY KEY - REQUIRED!)
  if (!mapped.temp_id) {
    // For synced facts from API, use server ID as temp_id base
    // This ensures stable temp_id across re-syncs
    mapped.temp_id = mapped.id ? `server-${mapped.id}` : generateUUID();
  }

  // 3. Set sync_status (INDEXED FIELD - REQUIRED!)
  if (!mapped.sync_status) {
    mapped.sync_status = 'synced';  // From API = already synced
  }

  // 4. Set synced_at timestamp (when did we last sync from server)
  if (!mapped.synced_at) {
    mapped.synced_at = new Date();
  }

  // 5. Handle transfer fields (ensure proper defaults)
  if (!('transfer_group_id' in mapped) || mapped.transfer_group_id === undefined) {
    mapped.transfer_group_id = null;
  }
  if (!('is_transfer' in mapped)) {
    mapped.is_transfer = mapped.transfer_group_id !== null;
  }

  // 6. Ensure timestamp fields are Date objects (not ISO strings)
  const dateFields = ['created_at', 'updated_at', 'synced_at'];
  for (const field of dateFields) {
    if (mapped[field] && typeof mapped[field] === 'string') {
      mapped[field] = new Date(mapped[field]);
    }
  }

  // 7. Set defaults for nullable fields (to match Dexie schema)
  if (!('sync_hash' in mapped)) {
    mapped.sync_hash = null;
  }
  if (!('content_hash' in mapped)) {
    mapped.content_hash = null;
  }
  if (!('tab_origin_id' in mapped)) {
    mapped.tab_origin_id = null;
  }

  return mapped as LocalBudgetFact;
}

/**
 * Map Dexie LocalBudgetFact to API payload
 *
 * Used when uploading pending operations to server.
 * Reverses field name mapping and removes Dexie-only fields.
 *
 * @param localFact - Dexie fact record
 * @returns API-compatible payload
 *
 * @example
 * const localFact = {
 *   temp_id: "abc-123",              // Dexie-only
 *   id: null,                        // Not created on server yet
 *   date: "2026-02-06",              // Dexie field name
 *   comment: "Offline transaction",  // Dexie field name
 *   sync_status: "pending",          // Dexie-only
 *   ...
 * };
 *
 * const apiPayload = mapLocalFactToAPI(localFact);
 * // {
 * //   id: null,                        // Keep server ID
 * //   fact_date: "2026-02-06",         // Reversed mapping
 * //   description: "Offline transaction", // Reversed mapping
 * //   // temp_id, sync_status removed
 * // }
 */
export function mapLocalFactToAPI(localFact: Partial<LocalBudgetFact>): Record<string, any> {
  const mapped: Record<string, any> = { ...localFact };

  // Apply reverse field name mappings (date → fact_date, comment → description)
  for (const [dexieField, apiField] of Object.entries(FACT_FIELD_MAPPING.toAPI)) {
    if (dexieField in mapped) {
      mapped[apiField] = mapped[dexieField];
      delete mapped[dexieField];
    }
  }

  // Remove Dexie-only fields (not accepted by API)
  delete mapped.temp_id;
  delete mapped.sync_status;
  delete mapped.sync_hash;
  delete mapped.content_hash;
  delete mapped.synced_at;
  delete mapped.is_transfer;

  return mapped;
}

/**
 * Validate mapped fact has required Dexie fields
 *
 * Throws error if required fields are missing or invalid.
 * Used to catch malformed API responses early.
 *
 * @param fact - Mapped fact to validate
 * @throws {Error} If required fields missing or invalid format
 *
 * @example
 * try {
 *   const mapped = mapAPIFactToLocal(apiFact);
 *   validateMappedFact(mapped);
 *   // Safe to insert into Dexie
 * } catch (error) {
 *   // Skip malformed fact
 *   logger.warn('Invalid fact', { error, apiFact });
 * }
 */
export function validateMappedFact(fact: Partial<LocalBudgetFact>): void {
  // Required fields for Dexie schema
  const requiredFields = ['temp_id', 'date', 'amount', 'article_id', 'user_id', 'record_type', 'sync_status'];
  const missing = requiredFields.filter(f => !(f in fact) || fact[f as keyof LocalBudgetFact] === undefined);

  if (missing.length > 0) {
    throw new Error(`Mapped fact missing required fields: ${missing.join(', ')}`);
  }

  // Validate date format (YYYY-MM-DD required by Dexie schema)
  if (fact.date && !/^\d{4}-\d{2}-\d{2}$/.test(fact.date)) {
    throw new Error(`Invalid date format: ${fact.date}. Expected YYYY-MM-DD`);
  }

  // Validate record_type enum
  if (fact.record_type && !['fact', 'plan'].includes(fact.record_type)) {
    throw new Error(`Invalid record_type: ${fact.record_type}. Expected 'fact' or 'plan'`);
  }

  // Validate sync_status enum
  if (fact.sync_status && !['synced', 'pending', 'conflict', 'deleted'].includes(fact.sync_status)) {
    throw new Error(`Invalid sync_status: ${fact.sync_status}`);
  }
}
