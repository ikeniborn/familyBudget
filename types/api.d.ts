/**
 * API Response Types
 * Family Budget PWA
 *
 * Type definitions for API responses, WebSocket messages, and network status.
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

/// <reference types="./models" />

/**
 * Standard API response wrapper
 */
interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string | null;
  message?: string | null;
  detail?: string | null; // FastAPI error format
}

/**
 * Paginated response
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  size?: number; // Alternative naming
}

/**
 * WebSocket message types
 */
type WSMessageType =
  | 'ping'
  | 'pong'
  | 'fact_created'
  | 'fact_updated'
  | 'fact_deleted'
  | 'transfer_created'
  | 'transfer_updated'
  | 'transfer_deleted'
  | 'plan_created'
  | 'plan_updated'
  | 'plan_deleted'
  | 'list_created'
  | 'list_updated'
  | 'list_deleted'
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'bulk_delete_summary'
  | 'connection_limit';

/**
 * WebSocket message
 */
interface WSMessage {
  type: WSMessageType;
  data?: any;
  timestamp?: string | number;
  connection_id?: string | null;
  user_id?: number;
}

/**
 * Bulk delete summary event
 */
interface BulkDeleteSummary {
  entity_type: 'fact' | 'transfer' | 'plan' | 'list' | 'item';
  deleted_count: number;
  timestamp: string;
  user_id?: number;
}

/**
 * Network detector status type
 */
type NetworkStatus = 'online' | 'offline' | 'degraded';

/**
 * Network information (detailed)
 */
interface NetworkInfo {
  online: boolean;
  connectionType?: 'wifi' | '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
  saveData?: boolean;
}

/**
 * Quick stats response
 */
interface QuickStats {
  total_income: number;
  total_expense: number;
  balance: number;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
}

/**
 * Account balance
 */
interface AccountBalance {
  financial_center_id: number;
  financial_center_name: string;
  balance: number;
  currency?: string;
}

/**
 * Article hierarchy node
 */
interface ArticleHierarchyNode {
  id: number;
  name: string;
  article_type: 'income' | 'expense';
  parent_id?: number | null;
  depth: number;
  path: string;
  children: ArticleHierarchyNode[];
}

/**
 * Error response from FastAPI
 */
interface FastAPIError {
  detail: string | {
    loc: (string | number)[];
    msg: string;
    type: string;
  }[];
}

/**
 * Validation error
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * Auth token response
 */
interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

/**
 * Health check response
 */
interface HealthCheckResponse {
  status: 'ok' | 'error';
  version?: string;
  timestamp?: string;
  database?: 'connected' | 'disconnected';
  redis?: 'connected' | 'disconnected';
}
