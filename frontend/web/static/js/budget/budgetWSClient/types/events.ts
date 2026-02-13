/**
 * WebSocket Event Types
 * Type definitions for WebSocket event payloads
 */

// ============================================================================
// Fact Events
// ============================================================================

export interface FactCreatedEvent {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  record_type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  transfer_id: number | null;
  sync_hash: string;
  created_at: string;
  updated_at: string;
}

export interface FactUpdatedEvent extends FactCreatedEvent {
  // Same structure as created
}

export interface FactDeletedEvent {
  id: number;
  sync_hash: string;
}

// ============================================================================
// Plan Events
// ============================================================================

export interface PlanCreatedEvent {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  record_type: 'income' | 'expense';
  amount: number;
  currency: string;
  period: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanUpdatedEvent extends PlanCreatedEvent {
  // Same structure as created
}

export interface PlanDeletedEvent {
  id: number;
}

// ============================================================================
// Transfer Events
// ============================================================================

export interface TransferCreatedEvent {
  id: number;
  user_id: number;
  from_financial_center_id: number;
  to_financial_center_id: number;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  sync_hash: string;
  created_at: string;
  updated_at: string;
}

export interface TransferDeletedEvent {
  id: number;
  sync_hash: string;
}

// ============================================================================
// Shopping List Item Events
// ============================================================================

export interface ItemCreatedEvent {
  id: number;
  shopping_list_id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ItemUpdatedEvent extends ItemCreatedEvent {
  // Same structure as created
}

export interface ItemDeletedEvent {
  id: number;
  shopping_list_id: number;
}

export interface ItemCompletedEvent {
  id: number;
  shopping_list_id: number;
  is_completed: boolean;
}

// ============================================================================
// Multi-Tab Coordination Events
// ============================================================================

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
  isConnected: boolean;
}

export interface WSEventMessage {
  type: 'ws_event';
  event: string;
  data: unknown;
}

export interface LeaderChangedMessage {
  type: 'leader_changed';
  timestamp: number;
}

export interface StatusRequestMessage {
  type: 'status_request';
}

export interface StatusResponseMessage {
  type: 'status_response';
  isConnected: boolean;
  connectionId: string | null;
}

export type BroadcastChannelMessage =
  | HeartbeatMessage
  | WSEventMessage
  | LeaderChangedMessage
  | StatusRequestMessage
  | StatusResponseMessage;

// ============================================================================
// Connection Status
// ============================================================================

export interface ConnectionStatusResponse {
  user_connections: number;
  limits: {
    max_per_user: number;
    max_total: number;
  } | null;
  server_time: number;
}

// ============================================================================
// Long Polling Response
// ============================================================================

export interface PollEvent {
  event: string;
  data: unknown;
}

export interface PollResponse {
  events: PollEvent[];
  server_time: number;
}

// ============================================================================
// Dexie Sync Events
// ============================================================================

export interface SyncInitialRequest {
  event: 'sync_initial';
  data: {
    user_id: number;
  };
}

export interface SyncInitialResponse {
  event: 'sync_initial';
  data: {
    articles: Array<{
      id: number;
      user_id: number;
      parent_id: number | null;
      name: string;
      type: 'income' | 'expense';
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>;
    financial_centers: Array<{
      id: number;
      user_id: number;
      name: string;
      type: 'account' | 'wallet' | 'card';
      currency: string;
      is_active: boolean;
      created_at: string;
    }>;
    cost_centers: Array<{
      id: number;
      user_id: number;
      name: string;
      financial_center_id: number | null;
      is_active: boolean;
      created_at: string;
    }>;
    hierarchy: Array<{
      ancestor_id: number;
      descendant_id: number;
      depth: number;
    }>;
    total_records: number;
  };
}

// ============================================================================
// Dexie Incremental Sync Events
// ============================================================================

export interface SyncIncrementalRequest {
  event: 'sync_incremental';
  data: {
    user_id: number;
    last_sync_timestamp: string; // ISO 8601 timestamp
  };
}

export interface SyncIncrementalResponse {
  event: 'sync_incremental';
  data: {
    created: Array<{
      id: number;
      temp_id: number;                // Numeric temp_id from server
      user_id: number;
      article_id: number;
      financial_center_id: number | null;
      cost_center_id: number | null;
      date: string; // YYYY-MM-DD (renamed from fact_date)
      amount: number;
      comment: string | null; // renamed from description
      record_type: 'fact' | 'plan';
      transfer_group_id: string | null; // renamed from transfer_id
      is_transfer: boolean; // added
      recurring_plan_id: number | null;
      is_offline_sync: boolean;
      content_hash: string | null;
      sync_hash: string | null;
      created_at: string;
      updated_at: string;
    }>;
    updated: Array<{
      id: number;
      temp_id: number;                // Numeric temp_id from server
      user_id: number;
      article_id: number;
      financial_center_id: number | null;
      cost_center_id: number | null;
      date: string; // YYYY-MM-DD
      amount: number;
      comment: string | null;
      record_type: 'fact' | 'plan';
      transfer_group_id: string | null;
      is_transfer: boolean;
      recurring_plan_id: number | null;
      is_offline_sync: boolean;
      content_hash: string | null;
      sync_hash: string | null;
      created_at: string;
      updated_at: string;
    }>;
    deleted: number[]; // Array of temp_ids (numeric)
    sync_timestamp: string; // Server timestamp for next sync
  };
}

// ============================================================================
// Task-008: Client Upload Events
// ============================================================================

/**
 * Client → Server: Upload pending operations
 */
export interface SyncClientChangesRequest {
  event: 'sync_client_changes';
  data: {
    user_id: number;
    operations: Array<{
      temp_id: number;                    // Numeric int53 temp_id
      operation: 'create' | 'update' | 'delete';
      entity_type: string;                // 'fact' | 'plan' (future)
      payload: Record<string, unknown>;   // Operation data (JSONB)
      content_hash: string;               // SHA-256 for deduplication
    }>;
  };
}

/**
 * Server → Client: Upload response with temp_id → server_id mapping
 */
export interface SyncClientChangesResponse {
  event: 'sync_client_changes_response';
  data: {
    results: Array<{
      temp_id: number;                    // Client's numeric temp_id (int53)
      server_id: number | null;           // Server-assigned ID (null on error)
      status: 'success' | 'error' | 'conflict';
      error?: string;                     // Error message (if status != success)
    }>;
    total_processed: number;              // Total operations in batch
    success_count: number;                // Successfully processed
    error_count: number;                  // Failed operations
  };
}

/**
 * Upload result summary (internal)
 */
export interface UploadResult {
  success: boolean;
  uploaded: number;
  failed: number;
  remaining: number;  // Still in queue
}
