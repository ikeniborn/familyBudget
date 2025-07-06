export interface FactEntry {
  id: string;
  date: string;
  amount: number;
  nomenclature_id: string;
  cost_center_id: string;
  financial_center_id: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFactEntry {
  date: string;
  amount: number;
  nomenclature_id: string;
  cost_center_id: string;
  financial_center_id: string;
  note?: string;
}

export interface Nomenclature {
  id: string;
  name: string;
  parent_id?: string;
  level: number;
  children?: Nomenclature[];
}

export interface CostCenter {
  id: string;
  name: string;
  description?: string;
}

export interface FinancialCenter {
  id: string;
  name: string;
  description?: string;
}

export interface Period {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}