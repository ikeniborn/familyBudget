/**
 * Transfer Module - Type Definitions
 *
 * Transfer-specific interfaces and types for financial center transactions.
 */

export interface FinancialCenter {
  id: number;
  name: string;
  currency: string;
  balance: number;
}

export interface CostCenter {
  id: number;
  name: string;
  financial_center_id: number;
}

export interface HintsData {
  // Plan hints (previous period)
  prev_period?: string; // YYYY-MM
  prev_period_plan_sum?: number;
  prev_period_fact_sum?: number;

  // Fact hints (current period)
  period?: string; // YYYY-MM
  period_plan_sum?: number;
  period_fact_sum?: number;

  // Loading state
  loading?: boolean;
}

export interface TransferFormData {
  fromFinancialCenterId: number;
  toFinancialCenterId: number;
  amount: number;
  date: string; // YYYY-MM-DD for fact
  period?: string; // YYYY-MM for plan
  description?: string;
  fromArticleId?: number;
  toArticleId?: number;
  recordType: 'fact' | 'plan';
}
