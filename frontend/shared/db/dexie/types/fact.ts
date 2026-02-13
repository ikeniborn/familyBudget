/**
 * Data models for Dexie Phase 2: Transactional Data
 * Budget Facts, Pending Operations, Sync Conflicts, Recurring Plans
 *
 * ВАЖНО: amount field хранится как integer (cents) для точности
 * Example: $123.45 stored as 12345
 * Convert: save → amount * 100 | load → amount / 100
 */

/**
 * Budget Fact (transaction) - client-side representation
 */
export interface LocalBudgetFact {
  id: number | null;          // Server ID (null for pending creates)
  temp_id: number;            // Client-side numeric int53 (crypto-secure random)
  user_id: number;

  // Foreign keys
  article_id: number;
  financial_center_id: number | null;  // nullable for plans without financial center
  cost_center_id: number | null;

  // Transaction data
  date: string;               // YYYY-MM-DD
  amount: number;             // ⚠️ STORED AS CENTS (integer): $123.45 = 12345
  record_type: 'fact' | 'plan';
  comment: string | null;

  // Transfer tracking
  transfer_group_id: string | null;
  is_transfer: boolean;

  // Sync tracking
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  sync_hash: string | null;   // MD5 hash for conflict detection
  content_hash: string | null; // Content hash for deduplication

  // Timestamps
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}

/**
 * Pending Operation (offline changes queue)
 */
export interface LocalPendingOperation {
  id: number;
  operation: 'create' | 'update' | 'delete';
  entity_type: string;        // 'fact' | 'article' | etc
  temp_id: number | null;     // For creates (numeric int53)
  server_id: number | null;   // For updates/deletes

  // Operation payload (JSON)
  payload: Record<string, unknown>;

  // Retry tracking
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: Date | null; // Exponential backoff: 2s, 4s, 8s, 16s, 32s

  // Deduplication
  content_hash: string;        // UNIQUE constraint

  created_at: Date;
  updated_at: Date;
}

/**
 * Sync Conflict (conflict resolution log)
 */
export interface LocalSyncConflict {
  id: number;
  entity_type: string;
  entity_id: number | null;
  temp_id: number | null;

  // Conflict data
  local_version: Record<string, unknown>;   // JSON
  server_version: Record<string, unknown>;  // JSON

  // Resolution
  resolution: 'server' | 'client' | 'merged' | 'pending' | null;
  resolved_at: Date | null;

  created_at: Date;
}

/**
 * Recurring Plan (lightweight reference data)
 */
export interface LocalRecurringPlan {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number;
  cost_center_id: number | null;

  amount: number;             // ⚠️ STORED AS CENTS (integer)
  day_of_month: number | null;
  frequency: string;
  is_active: boolean;
  next_generation_date: string;  // YYYY-MM-DD (v11.4.0+)

  created_at: Date;
}

/**
 * Filters for querying facts
 */
export interface FactFilters {
  user_id?: number;
  article_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  record_type?: 'fact' | 'plan';
  article_type?: 'expense' | 'income' | 'debit' | 'credit';  // For filtering by article type
  search?: string;      // Search by description (trigram)
  sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
  date_from?: string;   // YYYY-MM-DD
  date_to?: string;     // YYYY-MM-DD
}

/**
 * Filters for querying recurring plans
 */
export interface RecurringPlanFilters {
  user_id?: number;
  article_id?: number;
  financial_center_id?: number;
  cost_center_id?: number;
  is_active?: boolean;
  frequency?: string;
  from_date?: string;  // Filter by next_generation_date >= from_date (YYYY-MM-DD) - v11.4.0+
  to_date?: string;    // Filter by next_generation_date <= to_date (YYYY-MM-DD) - v11.4.0+
}
