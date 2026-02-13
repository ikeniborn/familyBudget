/**
 * Dashboard Module Type Definitions
 *
 * Core types for the dashboard functionality including:
 * - Category tree select widgets
 * - Calendar widgets
 * - Dropdown caches
 * - Pending records management
 */

// ============================================================================
// Category & Article Types
// ============================================================================

export interface Category {
  id: number;
  name: string;
  full_path: string;
  type: 'income' | 'expense' | 'debit' | 'credit';
  parent_id: number | null;
  is_leaf: boolean;
  level: number;
  financial_center_ids?: number[] | null;
}

export interface Article extends Category {
  // Article is essentially a Category in the context of budget
}

// ============================================================================
// Financial Center & Cost Center Types
// ============================================================================

export interface FinancialCenter {
  id: number;
  name: string;
  is_global?: boolean;
}

export interface CostCenter {
  id: number;
  name: string;
  financial_center_ids?: number[] | null;
}

// ============================================================================
// Dropdown Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
  ttl: number;
}

export interface DropdownCache {
  categories: CacheEntry<Category[]>;
  financialCenters: CacheEntry<FinancialCenter[]>;
  costCenters: CacheEntry<CostCenter[]>;
}

// ============================================================================
// Pending Records Types
// ============================================================================

export type PendingRecordEntity = 'fact' | 'plan' | 'transfer' | 'recurring';
export type PendingRecordStatus = 'pending' | 'failed' | 'synced';
export type RecordType = 'fact' | 'plan';
export type FactType = 'income' | 'expense' | 'debit' | 'credit';

export interface PendingRecordData {
  // Common fields
  amount: number;
  description?: string | null;
  record_type: RecordType;

  // Fact-specific fields
  fact_date?: string;
  fact_type?: FactType;
  article_id?: number;
  article_name?: string;
  article_type?: FactType;
  financial_center_id?: number;
  financial_center_name?: string;
  cost_center_id?: number | null;
  cost_center_name?: string | null;

  // Plan-specific fields
  plan_date?: string;

  // Transfer-specific fields
  transfer_date?: string;
  from_financial_center_id?: number;
  from_financial_center_name?: string;
  to_financial_center_id?: number;
  to_financial_center_name?: string;
  from_article_id?: number;
  from_article_name?: string;
  to_article_id?: number;
  to_article_name?: string;
  from_cost_center_id?: number | null;
  to_cost_center_id?: number | null;

  // Notification fields
  notification_enabled?: boolean;
}

export interface PendingRecord {
  id: number;
  entity: PendingRecordEntity;
  operation: 'create' | 'update' | 'delete';
  tempId?: string;
  data: PendingRecordData;
  status: PendingRecordStatus;
  timestamp: number;
  retryCount: number;
  error?: string | null;
}

export interface PendingRecordsRenderResult {
  desktopHTML: string;
  mobileHTML: string;
  itemCount: number;
}

export interface UnsyncedItemsResult {
  items: PendingRecord[];
  hasRetryable: boolean;
  hasManualModeItems: boolean;
}

// ============================================================================
// Edit Modal Types
// ============================================================================

export type EditRecordType = 'fact' | 'plan' | null;

export interface EditFactData {
  id: number;
  amount: number;
  description?: string | null;
  fact_date: string;
  fact_type: FactType;
  article_id: number;
  financial_center_id: number;
  cost_center_id?: number | null;
}

export interface EditPlanData {
  id: number;
  amount: number;
  description?: string | null;
  plan_date: string;
  plan_type: FactType;
  article_id: number;
  financial_center_id: number;
  cost_center_id?: number | null;
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface TransactionFormData {
  record_type: 'fact';
  fact_type: FactType;
  amount: number;
  article_id: number;
  article_name?: string;
  financial_center_id: number;
  financial_center_name?: string;
  cost_center_id?: number | null;
  cost_center_name?: string | null;
  fact_date: string;
  description?: string | null;
}

export interface PlanFormData {
  record_type: 'plan';
  fact_type: FactType;
  amount: number;
  article_id: number;
  article_name?: string;
  financial_center_id: number;
  financial_center_name?: string;
  cost_center_id?: number | null;
  cost_center_name?: string | null;
  fact_date: string;
  plan_date?: string;
  description?: string | null;
}

export interface TransferFormData {
  from_financial_center_id: number;
  from_financial_center_name?: string;
  to_financial_center_id: number;
  to_financial_center_name?: string;
  from_article_id: number;
  from_article_name?: string;
  to_article_id: number;
  to_article_name?: string;
  from_cost_center_id?: number | null;
  to_cost_center_id?: number | null;
  amount: number;
  description?: string | null;
  transfer_date?: string;
  record_type: RecordType;
}

// ============================================================================
// Recurring Plan Types
// ============================================================================

export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type DurationType = 'indefinite' | 'count' | 'end_date';
export type PlanMode = 'regular' | 'recurring' | 'reminder';

export interface RecurringSettings {
  frequency_type: FrequencyType;
  frequency_value: number | null;
  occurrences_count: number | null;
  end_date: string | null;
}

// ============================================================================
// Hints Types
// ============================================================================

export interface PlanHintsData {
  prev_period: string;
  prev_period_plan_sum: number | null;
  prev_period_fact_sum: number | null;
}

export interface FactHintsData {
  period: string;
  period_plan_sum: number | null;
  period_fact_sum: number | null;
}

// ============================================================================
// Sync Results Types
// ============================================================================

export interface SyncResults {
  synced: number;
  failed: number;
  skipped?: boolean;
}
