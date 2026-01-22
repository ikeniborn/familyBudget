/**
 * Dashboard Facts Manager
 *
 * Provides PGlite-first queries for dashboard analytics with API fallback.
 * Implements 3 core queries: Recent Facts, Quick Stats, Account Balances.
 *
 * Performance targets:
 * - Dashboard load time: 500-1000ms → 80-160ms (85% faster)
 * - API calls reduction: 70%+ (3 requests → 0-3 fallback only)
 *
 * @module dashboard/features/factsManager
 */

import { getState, isPGliteEnabled } from '@db/pglite';
import { performanceMonitor } from '../../monitoring/PerformanceMonitor';
import type { QuickStats, AccountBalance, RecentFact } from '../types/analytics';

declare const debugLog: (...args: any[]) => void;

class DashboardFactsManager {

  /**
   * Load recent facts (last N transactions)
   * Backend equivalent: /api/v1/facts/recent-html
   * Query: SELECT * FROM local_budget_facts WHERE fact_date >= today-90
   *        ORDER BY created_at DESC LIMIT {limit}
   */
  async loadRecentFacts(limit: number = 10): Promise<RecentFact[]> {
    const startTime = performance.now();

    // Try PGlite first
    const { db } = getState();
    if (isPGliteEnabled() && db) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

        const result = await db.query(
          `
          SELECT
            f.id,
            f.temp_id,
            f.user_id,
            f.article_id,
            a.name as article_name,
            a.type as article_type,
            f.financial_center_id,
            fc.name as financial_center_name,
            f.cost_center_id,
            cc.name as cost_center_name,
            f.date as fact_date,
            f.amount,
            f.record_type,
            f.comment,
            f.transfer_group_id,
            f.is_transfer,
            f.sync_status,
            f.created_at,
            f.updated_at
          FROM local_budget_facts f
          LEFT JOIN local_articles a ON f.article_id = a.id
          LEFT JOIN local_financial_centers fc ON f.financial_center_id = fc.id
          LEFT JOIN local_cost_centers cc ON f.cost_center_id = cc.id
          WHERE f.sync_status != 'deleted'
            AND f.date >= $1
          ORDER BY f.created_at DESC
          LIMIT $2
        `,
          [cutoffDate.toISOString().split('T')[0], limit]
        );

        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('loadRecentFacts', duration);
        debugLog(`[DASHBOARD] Recent facts from PGlite: ${duration.toFixed(1)}ms`);

        return this.mapRecentFacts(result.rows);
      } catch (err) {
        console.error('[DASHBOARD] PGlite failed, fallback to API:', err);
      }
    }

    // Fallback to API
    const facts = await this.fetchRecentFactsFromAPI(limit);
    const duration = performance.now() - startTime;
    performanceMonitor.trackAPICall('loadRecentFacts', duration);
    return facts;
  }

  /**
   * Calculate quick statistics (today + month aggregations)
   * Backend equivalent: /api/v1/analytics/quick-stats-html
   * Queries: 3 GROUP BY article.type queries (today_facts, month_facts, month_plans)
   */
  async calculateQuickStats(): Promise<QuickStats> {
    const startTime = performance.now();

    const { db } = getState();
    if (isPGliteEnabled() && db) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split('T')[0];

        // Query 1: Today's facts
        const todayResult = await db.query(
          `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date = $1
            AND f.record_type = 'fact'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
          [today]
        );

        // Query 2: Month's facts
        const monthResult = await db.query(
          `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.record_type = 'fact'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
          [monthStartStr, today]
        );

        // Query 3: Month's plans (for plan-fact comparison)
        const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        const monthEndStr = lastDayOfMonth.toISOString().split('T')[0];

        const monthPlanResult = await db.query(
          `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.record_type = 'plan'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
          [monthStartStr, monthEndStr]
        );

        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('calculateQuickStats', duration);
        debugLog(`[DASHBOARD] Quick stats from PGlite: ${duration.toFixed(1)}ms`);

        return this.mapQuickStats(todayResult.rows, monthResult.rows, monthPlanResult.rows);
      } catch (err) {
        console.error('[DASHBOARD] PGlite failed, fallback to API:', err);
      }
    }

    // Fallback to API
    const stats = await this.fetchQuickStatsFromAPI();
    const duration = performance.now() - startTime;
    performanceMonitor.trackAPICall('calculateQuickStats', duration);
    return stats;
  }

  /**
   * Load account balances (opening + current)
   * Backend equivalent: /api/v1/analytics/account-balances-html
   * Logic: opening (before month) + movement (month to today) = current
   */
  async loadAccountBalances(): Promise<AccountBalance[]> {
    const startTime = performance.now();

    const { db } = getState();
    if (isPGliteEnabled() && db) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split('T')[0];

        // Query 1: Opening balances (ALL transactions before current month)
        const openingResult = await db.query(
          `
          SELECT
            f.financial_center_id as fc_id,
            SUM(
              CASE
                WHEN a.type IN ('income', 'credit') THEN f.amount
                WHEN a.type IN ('expense', 'debit') THEN -f.amount
                ELSE 0
              END
            ) as balance
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date < $1
            AND f.sync_status != 'deleted'
            AND f.record_type = 'fact'
            AND f.financial_center_id IS NOT NULL
          GROUP BY f.financial_center_id
        `,
          [monthStartStr]
        );

        // Query 2: Month movements (current month to today)
        const movementResult = await db.query(
          `
          SELECT
            f.financial_center_id as fc_id,
            SUM(
              CASE
                WHEN a.type IN ('income', 'credit') THEN f.amount
                WHEN a.type IN ('expense', 'debit') THEN -f.amount
                ELSE 0
              END
            ) as balance
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.sync_status != 'deleted'
            AND f.record_type = 'fact'
            AND f.financial_center_id IS NOT NULL
          GROUP BY f.financial_center_id
        `,
          [monthStartStr, today]
        );

        // Query 3: Get all active financial centers
        const fcsResult = await db.query(`
          SELECT id, name, type, currency
          FROM local_financial_centers
          WHERE is_active = true
          ORDER BY name
        `);

        const duration = performance.now() - startTime;
        performanceMonitor.trackPGliteCall('loadAccountBalances', duration);
        debugLog(`[DASHBOARD] Account balances from PGlite: ${duration.toFixed(1)}ms`);

        return this.mapAccountBalances(fcsResult.rows, openingResult.rows, movementResult.rows);
      } catch (err) {
        console.error('[DASHBOARD] PGlite failed, fallback to API:', err);
      }
    }

    // Fallback to API
    const balances = await this.fetchAccountBalancesFromAPI();
    const duration = performance.now() - startTime;
    performanceMonitor.trackAPICall('loadAccountBalances', duration);
    return balances;
  }

  /**
   * Initialize dashboard (parallel query execution)
   * Replaces 3 separate HTMX API calls with single parallel PGlite call
   */
  async initDashboard(): Promise<{
    recentFacts: RecentFact[];
    quickStats: QuickStats;
    accountBalances: AccountBalance[];
  }> {
    const startTime = performance.now();

    // Execute all queries in parallel
    const [recentFacts, quickStats, accountBalances] = await Promise.all([
      this.loadRecentFacts(10),
      this.calculateQuickStats(),
      this.loadAccountBalances(),
    ]);

    const duration = performance.now() - startTime;
    debugLog(`[DASHBOARD] Total load time: ${duration.toFixed(1)}ms`);

    // Show performance stats
    const stats = performanceMonitor.getStats();
    debugLog('[DASHBOARD] Performance:', stats);

    return { recentFacts, quickStats, accountBalances };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private mapRecentFacts(rows: any[]): RecentFact[] {
    return rows.map((row) => ({
      id: row.id,
      tempId: row.temp_id,
      userId: row.user_id,
      articleId: row.article_id,
      articleName: row.article_name,
      articleType: row.article_type,
      financialCenterId: row.financial_center_id,
      financialCenterName: row.financial_center_name,
      costCenterId: row.cost_center_id,
      costCenterName: row.cost_center_name,
      factDate: row.fact_date,
      amount: parseFloat(row.amount),
      recordType: row.record_type,
      comment: row.comment,
      transferGroupId: row.transfer_group_id,
      isTransfer: row.is_transfer,
      syncStatus: row.sync_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private mapQuickStats(todayRows: any[], monthRows: any[], monthPlanRows: any[]): QuickStats {
    const today = this.aggregateByType(todayRows);
    const month = this.aggregateByType(monthRows);
    const monthPlan = this.aggregateByType(monthPlanRows);

    return {
      today,
      month,
      monthPlan,
      planExecution: {
        incomePct: monthPlan.income > 0 ? (month.income / monthPlan.income) * 100 : 0,
        expensePct: monthPlan.expense > 0 ? (month.expense / monthPlan.expense) * 100 : 0,
        creditPct: monthPlan.credit > 0 ? (month.credit / monthPlan.credit) * 100 : 0,
        debitPct: monthPlan.debit > 0 ? (month.debit / monthPlan.debit) * 100 : 0,
      },
    };
  }

  private aggregateByType(rows: any[]): {
    income: number;
    expense: number;
    credit: number;
    debit: number;
  } {
    const result = { income: 0, expense: 0, credit: 0, debit: 0 };
    for (const row of rows) {
      if (row.type in result) {
        result[row.type as keyof typeof result] = parseFloat(row.total);
      }
    }
    return result;
  }

  private mapAccountBalances(
    fcs: any[],
    openingRows: any[],
    movementRows: any[]
  ): AccountBalance[] {
    const opening = new Map(openingRows.map((r) => [r.fc_id, parseFloat(r.balance)]));
    const movement = new Map(movementRows.map((r) => [r.fc_id, parseFloat(r.balance)]));

    return fcs.map((fc) => {
      const openingBalance = opening.get(fc.id) || 0;
      const monthMovement = movement.get(fc.id) || 0;
      const currentBalance = openingBalance + monthMovement;

      return {
        id: fc.id,
        name: fc.name,
        type: fc.type,
        currency: fc.currency,
        openingBalance,
        currentBalance,
        monthMovement: Math.abs(monthMovement),
        isNegative: currentBalance < 0,
      };
    });
  }

  // ============================================================================
  // API Fallback Methods (TODO: Implement)
  // ============================================================================

  private async fetchRecentFactsFromAPI(_limit: number): Promise<RecentFact[]> {
    // TODO: Implement API fallback
    console.warn('[DASHBOARD] API fallback not implemented for recent facts');
    return [];
  }

  private async fetchQuickStatsFromAPI(): Promise<QuickStats> {
    // TODO: Implement API fallback
    console.warn('[DASHBOARD] API fallback not implemented for quick stats');
    return {
      today: { income: 0, expense: 0, credit: 0, debit: 0 },
      month: { income: 0, expense: 0, credit: 0, debit: 0 },
      monthPlan: { income: 0, expense: 0, credit: 0, debit: 0 },
      planExecution: { incomePct: 0, expensePct: 0, creditPct: 0, debitPct: 0 },
    };
  }

  private async fetchAccountBalancesFromAPI(): Promise<AccountBalance[]> {
    // TODO: Implement API fallback
    console.warn('[DASHBOARD] API fallback not implemented for account balances');
    return [];
  }
}

// Singleton export
export const factsManager = new DashboardFactsManager();
