/**
 * Dashboard Facts Manager
 *
 * Provides Dexie-first aggregations for dashboard analytics.
 * Implements 3 core queries: Recent Facts, Quick Stats, Account Balances.
 *
 * @module dashboard/features/factsManager
 */

import { performanceMonitor } from '../../monitoring/PerformanceMonitor';
import type { QuickStats, AccountBalance, RecentFact } from '../types/analytics';
import { getDexieManager, isDexieActive } from '@db/dexie';
import type { LocalBudgetFact } from '@db/dexie/types/fact';
import type { LocalArticle, LocalFinancialCenter } from '@db/dexie/types/models';
import { getCurrentUserId } from '@shared/utils/userHelpers';

declare const debugLog: (...args: any[]) => void;

class DashboardFactsManager {
  async loadRecentFacts(limit: number = 10): Promise<RecentFact[]> {
    const startTime = performance.now();
    const facts = await this.fetchRecentFactsFromDexie(limit);
    performanceMonitor.trackAPICall('loadRecentFacts', performance.now() - startTime);
    return facts;
  }

  async calculateQuickStats(): Promise<QuickStats> {
    const startTime = performance.now();
    const stats = await this.fetchQuickStatsFromDexie();
    performanceMonitor.trackAPICall('calculateQuickStats', performance.now() - startTime);
    return stats;
  }

  async loadAccountBalances(): Promise<AccountBalance[]> {
    const startTime = performance.now();
    const balances = await this.fetchAccountBalancesFromDexie();
    performanceMonitor.trackAPICall('loadAccountBalances', performance.now() - startTime);
    return balances;
  }

  async initDashboard(): Promise<{
    recentFacts: RecentFact[];
    quickStats: QuickStats;
    accountBalances: AccountBalance[];
  }> {
    const startTime = performance.now();
    const [recentFacts, quickStats, accountBalances] = await Promise.all([
      this.loadRecentFacts(10),
      this.calculateQuickStats(),
      this.loadAccountBalances(),
    ]);
    debugLog(`[DASHBOARD] Total load time: ${(performance.now() - startTime).toFixed(1)}ms`);
    debugLog('[DASHBOARD] Performance:', performanceMonitor.getStats());
    return { recentFacts, quickStats, accountBalances };
  }

  // ============================================================================
  // Private Dexie Implementations
  // ============================================================================

  private async getDexie() {
    const manager = getDexieManager();
    await manager.init();
    return manager;
  }

  private async fetchRecentFactsFromDexie(limit: number): Promise<RecentFact[]> {
    if (!isDexieActive()) return [];

    const manager = await this.getDexie();
    const dateMinus90 = new Date();
    dateMinus90.setDate(dateMinus90.getDate() - 90);
    const dateFrom = dateMinus90.toISOString().slice(0, 10);

    const userId = await getCurrentUserId();
    const [articles, fcs, facts] = await Promise.all([
      manager.queryArticles(),
      manager.queryFinancialCenters(userId, true),
      manager.queryFacts({ date_from: dateFrom }),
    ]);

    const articleMap = new Map<number, LocalArticle>(articles.map(a => [a.id, a]));
    const fcMap = new Map<number, LocalFinancialCenter>(fcs.map(fc => [fc.id, fc]));

    return facts
      .filter(f => f.sync_status !== 'deleted')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(f => this.mapFactToRecentFact(f, articleMap, fcMap));
  }

  private async fetchQuickStatsFromDexie(): Promise<QuickStats> {
    const empty = { income: 0, expense: 0, credit: 0, debit: 0 };
    if (!isDexieActive()) {
      return { today: { ...empty }, month: { ...empty }, monthPlan: { ...empty }, planExecution: { incomePct: 0, expensePct: 0, creditPct: 0, debitPct: 0 } };
    }

    const manager = await this.getDexie();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [articles, todayFacts, monthFacts, monthPlans] = await Promise.all([
      manager.queryArticles(),
      manager.queryFacts({ date_from: todayStr, date_to: todayStr, record_type: 'fact' }),
      manager.queryFacts({ date_from: monthStart, date_to: todayStr, record_type: 'fact' }),
      manager.queryFacts({ date_from: monthStart, date_to: todayStr, record_type: 'plan' }),
    ]);

    const articleMap = new Map<number, LocalArticle>(articles.map(a => [a.id, a]));

    const sumByType = (factList: LocalBudgetFact[]) => {
      const sums = { income: 0, expense: 0, credit: 0, debit: 0 };
      for (const f of factList) {
        if (f.sync_status === 'deleted') continue;
        const type = articleMap.get(f.article_id)?.type;
        if (type && type in sums) (sums as any)[type] += f.amount;
      }
      return sums;
    };

    const today = sumByType(todayFacts);
    const month = sumByType(monthFacts);
    const monthPlan = sumByType(monthPlans);

    const pct = (actual: number, plan: number) => plan > 0 ? Math.round((actual / plan) * 100) : 0;

    return {
      today,
      month,
      monthPlan,
      planExecution: {
        incomePct: pct(month.income, monthPlan.income),
        expensePct: pct(month.expense, monthPlan.expense),
        creditPct: pct(month.credit, monthPlan.credit),
        debitPct: pct(month.debit, monthPlan.debit),
      },
    };
  }

  private async fetchAccountBalancesFromDexie(): Promise<AccountBalance[]> {
    if (!isDexieActive()) return [];

    const manager = await this.getDexie();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    // Last day of previous month
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const userId = await getCurrentUserId();
    const [articles, fcs, openingFacts, movementFacts] = await Promise.all([
      manager.queryArticles(),
      manager.queryFinancialCenters(userId, true),
      manager.queryFacts({ date_to: lastDayPrevMonth, record_type: 'fact' }),
      manager.queryFacts({ date_from: monthStart, date_to: todayStr, record_type: 'fact' }),
    ]);

    const articleMap = new Map<number, LocalArticle>(articles.map(a => [a.id, a]));

    type BalanceEntry = { opening: number; movement: number; fc: LocalFinancialCenter };
    const balances = new Map<number, BalanceEntry>();

    for (const fc of fcs.filter(f => f.is_active)) {
      balances.set(fc.id, { opening: 0, movement: 0, fc });
    }

    const applySign = (amount: number, type: string): number =>
      (type === 'income' || type === 'credit') ? amount : -amount;

    for (const f of openingFacts) {
      if (f.sync_status === 'deleted' || f.financial_center_id === null) continue;
      const type = articleMap.get(f.article_id)?.type;
      if (!type) continue;
      const entry = balances.get(f.financial_center_id);
      if (entry) entry.opening += applySign(f.amount, type);
    }

    for (const f of movementFacts) {
      if (f.sync_status === 'deleted' || f.financial_center_id === null) continue;
      const type = articleMap.get(f.article_id)?.type;
      if (!type) continue;
      const entry = balances.get(f.financial_center_id);
      if (entry) entry.movement += applySign(f.amount, type);
    }

    return Array.from(balances.values()).map(({ opening, movement, fc }) => ({
      id: fc.id,
      name: fc.name,
      type: '',
      currency: '',
      openingBalance: opening,
      currentBalance: opening + movement,
      monthMovement: movement,
      isNegative: (opening + movement) < 0,
    }));
  }

  private mapFactToRecentFact(
    f: LocalBudgetFact,
    articleMap: Map<number, LocalArticle>,
    fcMap: Map<number, LocalFinancialCenter>,
  ): RecentFact {
    const article = articleMap.get(f.article_id);
    const fc = f.financial_center_id !== null ? fcMap.get(f.financial_center_id) : undefined;
    return {
      id: f.id ?? 0,
      tempId: f.temp_id,
      userId: f.user_id,
      articleId: f.article_id,
      articleName: article?.name ?? '',
      articleType: (article?.type ?? 'expense') as RecentFact['articleType'],
      financialCenterId: f.financial_center_id,
      financialCenterName: fc?.name ?? null,
      costCenterId: f.cost_center_id,
      costCenterName: null,
      factDate: f.date,
      amount: f.amount,
      recordType: f.record_type,
      comment: f.comment,
      transferGroupId: f.transfer_group_id,
      isTransfer: f.is_transfer,
      syncStatus: f.sync_status,
      createdAt: f.created_at.toISOString(),
      updatedAt: f.updated_at.toISOString(),
    };
  }
}

export const factsManager = new DashboardFactsManager();
