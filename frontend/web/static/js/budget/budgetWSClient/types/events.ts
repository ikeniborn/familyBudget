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
