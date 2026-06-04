/**
 * TypeScript type definitions for dashboard analytics
 */

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
