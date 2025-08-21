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
  period_year: number;
  period_month: number;
  period_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Financial Center types - matches backend API
export interface FinancialCenter {
  id: number;
  financial_center_id: number;
  financial_center_name: string;
  financial_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Cost Center types - matches backend API
export interface CostCenter {
  id: number;
  cost_center_id: number;
  cost_center_name: string;
  cost_center_order: number;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Nomenclature types - matches backend API
export interface Nomenclature {
  id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  bill_name: string;
  account_name: string;
  operation_name: string;
  is_fact: boolean;
  user_id: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Registry types
export interface Registry {
  id: number;
  period_id: number;
  user_id: number;
  financial_center_id: number;
  cost_center_id: number;
  nomenclature_id: number;
  row_type: 'plan' | 'fact';
  amount: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
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