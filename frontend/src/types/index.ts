export interface User {
  user_id: number;
  user_name: string;
  user_telegram_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface Period {
  period_id: number;
  period_dt: string;
  period_name: string;
  period_ru_name: string;
}

export interface FinancialCenter {
  financial_center_id: number;
  financial_center_name: string;
}

export interface CostCenter {
  cost_center_id: number;
  cost_center_name: string;
}

export interface Nomenclature {
  nomenclature_id: number;
  nomenclature_name: string;
  bill_name: string;
  account_name: string;
  operation_name: string;
  is_fact: boolean;
}

export interface RowType {
  row_type_id: number;
  row_type_name: string;
}

export interface Registry {
  registry_id?: number;
  operation_dttm: string;
  period_id: number;
  financial_center_id: number;
  cost_center_id: number;
  nomenclature_id: number;
  cost_sum: number;
  comment_description?: string;
  row_type_id: number;
  user_id: number;
}

export interface Product {
  product_id?: number;
  product_name: string;
  category_name?: string;
  unit_measure?: string;
  barcode?: string;
  description?: string;
  is_active: boolean;
}

export interface ProductPrice {
  price_id?: number;
  product_id: number;
  supplier_name?: string;
  price_value: number;
  price_date: string;
  user_id: number;
}