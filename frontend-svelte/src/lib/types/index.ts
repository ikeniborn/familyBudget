// User types - matches backend API
export interface User {
  user_id: number;
  user_name: string;
  user_telegram_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  authMethod?: 'telegram' | 'password';
}

// Period types - matches backend API
export interface Period {
  id: number;
  period_id: number;
  period_name: string;
  period_ru_name?: string;
  period_year: number;
  period_month: number;
  period_start_date?: string;
  period_end_date?: string;
  user_id: number;
  transaction_count?: number;
  created_at?: string;
  updated_at?: string;
}

// Financial Center types - matches backend API
export interface FinancialCenter {
  id: number;
  financial_center_id: number;
  financial_center_name: string;
  financial_center_description?: string;
  parent_id?: number | null;
  user_id: number;
  is_active?: boolean;
  usage_stats?: {
    cost_centers_count: number;
    transactions_count: number;
    total_amount: number;
  };
  children?: FinancialCenter[];
  level?: number;
  created_at?: string;
  updated_at?: string;
}

// Cost Center types - matches backend API
export interface CostCenter {
  id: number;
  cost_center_id: number;
  cost_center_name: string;
  cost_center_description?: string;
  financial_center_id?: number | null;
  budget_limit?: number;
  budget_period?: 'monthly' | 'quarterly' | 'yearly';
  user_id: number;
  is_active: boolean;
  current_usage?: number;
  usage_percentage?: number;
  history?: CostCenterHistory[];
  created_at?: string;
  updated_at?: string;
}

export interface CostCenterHistory {
  id: number;
  action: 'created' | 'updated' | 'budget_changed' | 'activated' | 'deactivated';
  old_value?: any;
  new_value?: any;
  changed_by: number;
  changed_at: string;
  description?: string;
}

// Nomenclature types - matches backend API
export interface Nomenclature {
  id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name: string;
  bill_name: string;
  operation_name: string;
  is_budget: boolean;
  is_fact: boolean;
  parent_id?: number | null;
  color?: string;
  icon?: string;
  auto_rules?: AutoCategorizationRule[];
  user_id: number;
  is_active: boolean;
  is_expanded?: boolean;
  level?: number;
  children?: Nomenclature[];
  transaction_count?: number;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AutoCategorizationRule {
  id?: number;
  rule_type: 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'regex';
  pattern: string;
  case_sensitive: boolean;
  priority: number;
}

// Registry types
export interface Registry {
  id: number;
  operation_dttm?: string;  // Date of operation
  period_id: number;
  user_id: number;
  financial_center_id: number;
  cost_center_id: number | null;
  nomenclature_id: number;
  row_type_id: number;  // 1=Plan, 2=Fact
  cost_sum: number;  // Amount of the operation
  comment_description?: string | null;  // Comment
  // Additional fields with names from related tables
  period_name?: string;
  financial_center_name?: string;
  cost_center_name?: string;
  nomenclature_name?: string;
}

// Product types
export interface Product {
  id: number;
  name: string;
  description?: string | null;
  barcode?: string | null;
  unit?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  price: number;
  store?: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form types
export interface FormErrors {
  [key: string]: string | undefined;
}

// Union type for all reference entities
export type ReferenceEntity = Period | FinancialCenter | CostCenter | Nomenclature;

// Base interface for reference data state
export interface BaseReferenceDataState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  lastSync: number | null;
  isDirty: boolean;
  selectedItems: number[];
  searchTerm: string;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  length?: number;
}

// Report types
export interface PlanFactReportData {
  [key: string]: any;
  name: string;
  planned_amount: number;
  actual_amount: number;
  category?: string;
  period_name?: string;
}

export interface BudgetReportData {
  period: string;
  planned_income: number;
  planned_expense: number;
  actual_income: number;
  actual_expense: number;
  variance_income: number;
  variance_expense: number;
  efficiency: number;
}

export interface BudgetTableData {
  category: string;
  period: string;
  planned_income: number;
  planned_expense: number;
  actual_income: number;
  actual_expense: number;
  income_variance: number;
  expense_variance: number;
  execution_rate: number;
}

export interface RawReportData {
  categories: { name: string; value: number }[];
  trends: { date: string; plan: number; fact: number }[];
  variance: { name: string; planned: number; actual: number; variance: number }[];
  planFactData?: PlanFactReportData[];
}

// Bulk operation types
export interface BulkOperationProgress {
  processed: number;
  total: number;
  status: 'running' | 'completed' | 'error';
  errors?: string[];
}

export interface BulkOperationResult<T> {
  success: T[];
  errors: BulkOperationError[];
  warnings: BulkOperationWarning[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
}

export interface BulkOperationError {
  row: number;
  data: any;
  error: string;
  code: string;
}

export interface BulkOperationWarning {
  row: number;
  data: any;
  warning: string;
  code: string;
}