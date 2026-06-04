/**
 * TypeScript type definitions for dashboard analytics
 * Used by dashboardFactsManager for API-only queries
 */

export interface QuickStats {
  today: {
    income: number;
    expense: number;
    credit: number;
    debit: number;
  };
  month: {
    income: number;
    expense: number;
    credit: number;
    debit: number;
  };
  monthPlan: {
    income: number;
    expense: number;
    credit: number;
    debit: number;
  };
  planExecution: {
    incomePct: number;
    expensePct: number;
    creditPct: number;
    debitPct: number;
  };
}

export interface AccountBalance {
  id: number;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  monthMovement: number;
  isNegative: boolean;
}

export interface RecentFact {
  id: number;
  tempId: string | null;
  userId: number;
  articleId: number;
  articleName: string;
  articleType: 'income' | 'expense' | 'credit' | 'debit';
  financialCenterId: number | null;
  financialCenterName: string | null;
  costCenterId: number | null;
  costCenterName: string | null;
  factDate: string;  // ISO date
  amount: number;
  recordType: 'fact' | 'plan';
  comment: string | null;
  transferGroupId: string | null;
  isTransfer: boolean;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'deleted';
  createdAt: string;  // ISO datetime
  updatedAt: string;
}

export interface WaterfallArticle {
  id: number;
  name: string;
  type: 'income' | 'expense' | 'credit' | 'debit';
  amount: number;
}

export interface WaterfallResponse {
  labels: string[];
  income: number[];
  expense: number[];
  transfers_in: number[];
  transfers_out: number[];
  balance: number[];
  categories: WaterfallArticle[][];
  initial_balance: number;
  period: 'month' | 'quarter' | 'year';
  year: number;
  article_id: number | null;
  article_name: string | null;
}
