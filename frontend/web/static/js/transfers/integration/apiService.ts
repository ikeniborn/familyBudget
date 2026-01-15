/**
 * Transfer Module - API Service
 *
 * API calls to backend endpoints.
 */

import type { FinancialCenter, CostCenter, TransferFormData } from '../types/transfer';

// ============================================================================
// Plan Hints API
// ============================================================================

export interface PlanHintsParams {
  period: string; // YYYY-MM
  articleType: 'debit' | 'credit';
  articleId: number;
  financialCenterId: number;
  signal?: AbortSignal;
}

export interface PlanHintsResponse {
  prev_period: string;
  prev_period_plan_sum: number;
  prev_period_fact_sum: number;
}

/**
 * Get plan hints
 */
export async function getPlanHints(params: PlanHintsParams): Promise<PlanHintsResponse> {
  const query = new URLSearchParams({
    period: params.period,
    article_type: params.articleType,
    article_id: String(params.articleId),
    financial_center_id: String(params.financialCenterId)
  });

  const response = await fetch(`/api/v1/analytics/plan-hints?${query}`, {
    signal: params.signal,
    credentials: 'include'
  });

  if (!response.ok) throw new Error('Failed to load plan hints');
  return response.json();
}

// ============================================================================
// Fact Hints API
// ============================================================================

export interface FactHintsParams {
  factDate: string; // YYYY-MM-DD
  articleType: 'debit' | 'credit';
  articleId: number;
  financialCenterId: number;
  signal?: AbortSignal;
}

export interface FactHintsResponse {
  period: string;
  period_plan_sum: number;
  period_fact_sum: number;
}

/**
 * Get fact hints
 */
export async function getFactHints(params: FactHintsParams): Promise<FactHintsResponse> {
  const query = new URLSearchParams({
    fact_date: params.factDate,
    article_type: params.articleType,
    article_id: String(params.articleId),
    financial_center_id: String(params.financialCenterId)
  });

  const response = await fetch(`/api/v1/analytics/fact-hints?${query}`, {
    signal: params.signal,
    credentials: 'include'
  });

  if (!response.ok) throw new Error('Failed to load fact hints');
  return response.json();
}

// ============================================================================
// Financial Centers API
// ============================================================================

/**
 * Get financial centers
 */
export async function getFinancialCenters(): Promise<FinancialCenter[]> {
  const response = await fetch('/api/v1/financial-centers?limit=1000&include_global=true', {
    credentials: 'include'
  });

  if (!response.ok) throw new Error('Failed to load financial centers');
  const data = await response.json();
  return data.items || [];
}

// ============================================================================
// Cost Centers API
// ============================================================================

/**
 * Get cost centers
 */
export async function getCostCenters(): Promise<CostCenter[]> {
  const response = await fetch('/api/v1/cost-centers?limit=1000&include_global=true', {
    credentials: 'include'
  });

  if (!response.ok) throw new Error('Failed to load cost centers');
  const data = await response.json();
  return data.items || [];
}

// ============================================================================
// Transfers API
// ============================================================================

/**
 * Create transfer
 */
export async function createTransfer(data: TransferFormData): Promise<void> {
  const response = await fetch('/api/v1/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      transfer_date: data.date,
      amount: data.amount,
      record_type: data.recordType,
      from_financial_center_id: data.fromFinancialCenterId,
      to_financial_center_id: data.toFinancialCenterId,
      from_article_id: data.fromArticleId,
      to_article_id: data.toArticleId,
      description: data.description
    })
  });

  if (!response.ok) throw new Error('Failed to create transfer');
}
