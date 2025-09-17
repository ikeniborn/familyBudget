// User types - matches backend API
export interface User {
  id: number;
  user_name: string;
  user_email?: string | null;
  username?: string | null;
  telegram_id?: string | null;
  auth_method: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
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
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // Additional fields used in frontend
  date?: string;
  ru_name?: string;
  start_date?: string;
  end_date?: string;
  code?: string;
}

// Admin Period type with user information
export interface AdminPeriod extends Period {
  user_name: string;
  user_email?: string | null;
  username?: string | null;
  telegram_id?: string | null;
}

// Financial Center types - matches backend API
export interface FinancialCenter {
  id: number;
  financial_center_id: number;
  financial_center_name?: string; // For backward compatibility
  name: string; // New standardized field name
  financial_center_description?: string;
  description?: string; // New standardized field name
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

// Admin Financial Center type with user information
export interface AdminFinancialCenter extends FinancialCenter {
  user_name: string;
  user_email?: string | null;
  username?: string | null;
  telegram_id?: string | null;
}

// Cost Center types - matches backend API
export interface CostCenter {
  id: number;
  cost_center_id: number;
  cost_center_name?: string; // For backward compatibility
  name: string; // New standardized field name
  cost_center_description?: string;
  description?: string; // New standardized field name
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

// Admin Cost Center type with user information
export interface AdminCostCenter extends CostCenter {
  user_name: string;
  user_email?: string | null;
  username?: string | null;
  telegram_id?: string | null;
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

// Article types - matches backend API
export interface Article {
  id: number;
  article_id: number;
  article_code?: string; // For backward compatibility
  code: string; // New standardized field name
  article_name?: string; // For backward compatibility
  name: string; // New standardized field name
  description?: string;
  is_active: boolean;
  user_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminArticle extends Article {
  user_name: string;
  user_email?: string | null;
  username?: string | null;
  telegram_id?: string | null;
}

export interface ArticleStats {
  total: number;
  active: number;
  inactive: number;
}

// Nomenclature types - matches backend API
export interface Nomenclature {
  id: number;
  nomenclature_id: number;
  nomenclature_name?: string; // For backward compatibility
  name: string; // New standardized field name
  code: string;
  description?: string;
  nomenclature_type?: 'INCOME' | 'EXPENSE';
  account_name?: string;
  bill_name?: string;
  operation_name?: string;
  operation?: string;
  is_budget: boolean;
  is_fact: boolean;
  parent_id?: number | null;
  article_id?: number | null;
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

export interface AdminNomenclature extends Nomenclature {
	user_name: string;
	user_email: string;
	username: string;
	telegram_id: string;
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

// Product types - matches backend API
export interface Product {
  id: number;
  name: string;
  category?: string | null;
  unit?: string | null;
  barcode?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  supplier_name?: string | null;
  price_value: number;
  price_date: string;
  user_id: number;
  created_at?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Auth-specific API response types
export interface AuthResponse {
  success: boolean;
  user: User;
  message?: string;
  error?: string;
}

export interface AuthMeResponse {
  success: boolean;
  user: User;
  authenticated: boolean;
  error?: string;
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



