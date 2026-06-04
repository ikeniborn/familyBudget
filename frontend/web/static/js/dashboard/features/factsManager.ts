/**
 * Dashboard Facts Manager
 *
 * API-only aggregations for dashboard analytics.
 * Implements 3 core queries: Recent Facts, Quick Stats, Account Balances.
 *
 * @module dashboard/features/factsManager
 */

import { performanceMonitor } from '../../monitoring/PerformanceMonitor';
import type { QuickStats, RecentFact } from '../types/analytics';

declare const debugLog: (...args: any[]) => void;

class DashboardFactsManager {
  async loadRecentFacts(limit: number = 10): Promise<RecentFact[]> {
    const t0 = performance.now();
    const r = await fetch(`/api/v1/facts/recent?limit=${limit}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    debugLog(`[DASHBOARD] loadRecentFacts: ${(performance.now() - t0).toFixed(1)}ms`);
    return data.facts ?? data;
  }

  async calculateQuickStats(): Promise<QuickStats> {
    const r = await fetch('/api/v1/analytics/quick-stats', { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async initDashboard(): Promise<{
    recentFacts: RecentFact[];
    quickStats: QuickStats;
  }> {
    const t0 = performance.now();
    const [recentFacts, quickStats] = await Promise.all([
      this.loadRecentFacts(10),
      this.calculateQuickStats(),
    ]);
    debugLog(`[DASHBOARD] Total load time: ${(performance.now() - t0).toFixed(1)}ms`);
    debugLog('[DASHBOARD] Performance:', performanceMonitor.getStats());
    return { recentFacts, quickStats };
  }
}

export const dashboardFactsManager = new DashboardFactsManager();
