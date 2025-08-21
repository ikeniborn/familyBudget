// User types
export interface User {
  id: number;
  telegram_id: string;
  username: string;
  first_name: string;
  last_name?: string | null;
  created_at: string;
  updated_at: string;
}

// Period types
export interface Period {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

// Financial Center types
export interface FinancialCenter {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

// Cost Center types
export interface CostCenter {
  id: number;
  name: string;
  description?: string | null;
  financial_center_id: number;
  created_at: string;
  updated_at: string;
}

// Nomenclature types
export interface Nomenclature {
  id: number;
  name: string;
  description?: string | null;
  parent_id?: number | null;
  created_at: string;
  updated_at: string;
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