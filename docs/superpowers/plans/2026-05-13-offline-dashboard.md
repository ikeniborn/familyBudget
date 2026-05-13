# Offline Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the app is offline, compute dashboard data from Dexie IndexedDB and render it with an offline badge instead of showing infinite spinners.

**Architecture:** `offlineDashboard.ts` coordinator intercepts HTMX requests when offline and drives `factsManager.ts` Dexie aggregations; online/offline transitions retrigger HTMX or Dexie render respectively.

**Tech Stack:** TypeScript, Dexie.js via `@db/dexie`, Vitest + fake-indexeddb (unit), Playwright (E2E)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/web/static/js/dashboard/features/factsManager.ts` | Replace 3 stub private methods with Dexie queries |
| Create | `frontend/web/static/js/dashboard/features/offlineDashboard.ts` | Coordinator class + HTML renderers |
| Modify | `frontend/web/static/js/dashboard/recentTransactions.ts` | Export `buildRecentTransactionsHTML`, remove offline early-return |
| Modify | `frontend/web/static/js/dashboard/index.ts` | Import + init coordinator |
| Create | `tests/unit/dashboard/factsManager.test.ts` | Vitest tests for 3 Dexie aggregations |
| Create | `tests/unit/dashboard/offlineDashboard.test.ts` | Vitest tests for coordinator |
| Create | `tests/e2e/webapp/test_offline_dashboard.spec.ts` | Playwright E2E tests |

---

## Task 1: factsManager.ts — Dexie aggregations

**Files:**
- Modify: `frontend/web/static/js/dashboard/features/factsManager.ts`

### Background

`factsManager.ts` has 3 private stub methods that return empty data. Replace them with Dexie queries.
- `LocalBudgetFact.date` (not `fact_date`) stores YYYY-MM-DD
- `LocalBudgetFact.sync_status` — `queryFacts` returns all statuses; filter `!== 'deleted'` manually
- `LocalFinancialCenter` has no `currency` or `type` fields — both default to `''` in `AccountBalance`
- `queryFinancialCenters(userId, true)` — `includeGlobal=true` required (BUG-001: shared family budget)
- Import paths: `@db/dexie` → `frontend/shared/db/dexie/index.ts`; `@shared/utils/userHelpers` → `frontend/shared/static/js/utils/userHelpers.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard/factsManager.test.ts`:

```typescript
/**
 * Unit tests: factsManager Dexie aggregations
 * Tests all 3 methods: loadRecentFacts, calculateQuickStats, loadAccountBalances
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DexieManager } from '@db/dexie/DexieManager';
import type { LocalBudgetFact } from '@db/dexie/types/fact';
import type { LocalArticle, LocalFinancialCenter } from '@db/dexie/types/models';

// Mock @db/dexie module
vi.mock('@db/dexie', () => ({
  isDexieActive: vi.fn(() => true),
  getDexieManager: vi.fn(),
}));

// Mock userHelpers
vi.mock('@shared/utils/userHelpers', () => ({
  getCurrentUserId: vi.fn(async () => 1),
}));

import { isDexieActive, getDexieManager } from '@db/dexie';
import { factsManager } from '@web/dashboard/features/factsManager';

const mockIsDexieActive = isDexieActive as MockedFunction<typeof isDexieActive>;
const mockGetDexieManager = getDexieManager as MockedFunction<typeof getDexieManager>;

// Helper builders
function buildArticle(overrides: Partial<LocalArticle> = {}): LocalArticle {
  return {
    id: 1, user_id: 1, parent_id: null, name: 'Groceries',
    type: 'expense', is_active: true,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildFC(overrides: Partial<LocalFinancialCenter> = {}): LocalFinancialCenter {
  return {
    id: 1, user_id: 1, name: 'Main wallet', description: null, code: null,
    is_active: true, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

type FactInput = Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at' | 'tab_origin_id'>;

function buildFactInput(overrides: Partial<FactInput> = {}): FactInput {
  return {
    user_id: 1, article_id: 1, financial_center_id: 1, cost_center_id: null,
    date: '2026-05-13', amount: 100, record_type: 'fact',
    comment: null, transfer_group_id: null, is_transfer: false, sync_hash: null,
    ...overrides,
  };
}

describe('factsManager — Dexie aggregations', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
    mockGetDexieManager.mockReturnValue(manager as any);
    mockIsDexieActive.mockReturnValue(true);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  // ── loadRecentFacts ──────────────────────────────────────────────────────

  describe('loadRecentFacts', () => {
    it('includes pending facts', async () => {
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      const today = new Date().toISOString().slice(0, 10);
      await manager.createFact(buildFactInput({ date: today }));
      // createFact sets sync_status='pending' by default
      const results = await factsManager.loadRecentFacts(10);
      expect(results).toHaveLength(1);
      expect(results[0].syncStatus).toBe('pending');
    });

    it('excludes deleted facts', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1 })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      const tempId = await manager.createFact(buildFactInput({ date: today }));
      await manager.deleteFact(tempId);
      const results = await factsManager.loadRecentFacts(10);
      expect(results).toHaveLength(0);
    });

    it('respects limit', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1 })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      for (let i = 0; i < 5; i++) {
        await manager.createFact(buildFactInput({ date: today, amount: 100 + i }));
      }
      const results = await factsManager.loadRecentFacts(3);
      expect(results).toHaveLength(3);
    });

    it('maps articleName and financialCenterName from lookup maps', async () => {
      await manager.bulkInsertArticles([buildArticle({ id: 1, name: 'Food', type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1, name: 'Wallet' })]);
      await manager.createFact(buildFactInput({ article_id: 1, financial_center_id: 1 }));
      const results = await factsManager.loadRecentFacts(10);
      expect(results[0].articleName).toBe('Food');
      expect(results[0].financialCenterName).toBe('Wallet');
    });

    it('returns [] when isDexieActive is false', async () => {
      mockIsDexieActive.mockReturnValue(false);
      const results = await factsManager.loadRecentFacts(10);
      expect(results).toEqual([]);
    });
  });

  // ── calculateQuickStats ──────────────────────────────────────────────────

  describe('calculateQuickStats', () => {
    it('groups today facts correctly by article type', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([
        buildArticle({ id: 1, type: 'expense' }),
        buildArticle({ id: 2, type: 'income' }),
      ]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 500, date: today }));
      await manager.createFact(buildFactInput({ article_id: 2, amount: 1000, date: today }));
      const stats = await factsManager.calculateQuickStats();
      expect(stats.today.expense).toBe(500);
      expect(stats.today.income).toBe(1000);
      expect(stats.today.credit).toBe(0);
      expect(stats.today.debit).toBe(0);
    });

    it('pending facts counted in today and month totals', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 200, date: today }));
      const stats = await factsManager.calculateQuickStats();
      expect(stats.today.expense).toBe(200);
      expect(stats.month.expense).toBe(200);
    });

    it('deleted facts excluded from stats', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      const tempId = await manager.createFact(buildFactInput({ article_id: 1, amount: 300, date: today }));
      await manager.deleteFact(tempId);
      const stats = await factsManager.calculateQuickStats();
      expect(stats.today.expense).toBe(0);
    });

    it('planExecution calculated as percentage of plan', async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 500, date: today, record_type: 'fact' }));
      await manager.createFact(buildFactInput({ article_id: 1, amount: 1000, date: monthStartStr, record_type: 'plan' }));
      const stats = await factsManager.calculateQuickStats();
      expect(stats.planExecution.expensePct).toBe(50);
    });
  });

  // ── loadAccountBalances ──────────────────────────────────────────────────

  describe('loadAccountBalances', () => {
    it('expense/debit produce negative sign on balance', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'expense' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 300, date: today, financial_center_id: 1 }));
      const balances = await factsManager.loadAccountBalances();
      expect(balances).toHaveLength(1);
      expect(balances[0].currentBalance).toBe(-300);
      expect(balances[0].isNegative).toBe(true);
    });

    it('income/credit produce positive sign on balance', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'income' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 1000, date: today, financial_center_id: 1 }));
      const balances = await factsManager.loadAccountBalances();
      expect(balances[0].currentBalance).toBe(1000);
      expect(balances[0].isNegative).toBe(false);
    });

    it('active FC with no facts shows balance=0', async () => {
      await manager.bulkInsertArticles([buildArticle({ id: 1 })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 }), buildFC({ id: 2, name: 'Empty wallet' })]);
      const balances = await factsManager.loadAccountBalances();
      const emptyWallet = balances.find(b => b.name === 'Empty wallet');
      expect(emptyWallet).toBeDefined();
      expect(emptyWallet!.currentBalance).toBe(0);
    });

    it('opening balance includes facts before current month', async () => {
      const prevMonthDay = new Date();
      prevMonthDay.setMonth(prevMonthDay.getMonth() - 1);
      const prevMonthStr = prevMonthDay.toISOString().slice(0, 10);
      await manager.bulkInsertArticles([buildArticle({ id: 1, type: 'income' })]);
      await manager.bulkInsertFinancialCenters([buildFC({ id: 1 })]);
      await manager.createFact(buildFactInput({ article_id: 1, amount: 5000, date: prevMonthStr, financial_center_id: 1 }));
      const balances = await factsManager.loadAccountBalances();
      expect(balances[0].openingBalance).toBe(5000);
    });

    it('returns [] when isDexieActive is false', async () => {
      mockIsDexieActive.mockReturnValue(false);
      const results = await factsManager.loadAccountBalances();
      expect(results).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:coverage -- --reporter=verbose tests/unit/dashboard/factsManager.test.ts
```

Expected: FAIL — stubs return empty arrays.

- [ ] **Step 3: Implement Dexie aggregations in factsManager.ts**

Replace the entire file:

```typescript
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
      return { today: empty, month: empty, monthPlan: { ...empty }, planExecution: { incomePct: 0, expensePct: 0, creditPct: 0, debitPct: 0 } };
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:coverage -- --reporter=verbose tests/unit/dashboard/factsManager.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/dashboard/features/factsManager.ts tests/unit/dashboard/factsManager.test.ts
git commit -m "feat(dashboard): implement Dexie aggregations in factsManager (3 methods)"
```

---

## Task 2: offlineDashboard.ts — coordinator

**Files:**
- Create: `frontend/web/static/js/dashboard/features/offlineDashboard.ts`

### Background

Coordinator that:
1. Intercepts HTMX requests when offline (`event.detail.cancel = true`, not `preventDefault`)
2. Renders all 3 sections from Dexie data with offline badge
3. Reacts to `offline-status-change` custom event
4. Guard flag prevents double `renderAll()` execution

HTML rendering must match backend `analytics_rendering.py` exactly — same CSS, same class names.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard/offlineDashboard.test.ts`:

```typescript
/**
 * Unit tests: OfflineDashboardCoordinator
 * Tests: HTMX interception, offline-status-change handling, DOM mutations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock factsManager
vi.mock('@web/dashboard/features/factsManager', () => ({
  factsManager: {
    calculateQuickStats: vi.fn(async () => ({
      today: { income: 0, expense: 0, credit: 0, debit: 0 },
      month: { income: 0, expense: 500, credit: 0, debit: 0 },
      monthPlan: { income: 0, expense: 1000, credit: 0, debit: 0 },
      planExecution: { incomePct: 0, expensePct: 50, creditPct: 0, debitPct: 0 },
    })),
    loadAccountBalances: vi.fn(async () => [
      { id: 1, name: 'Wallet', type: '', currency: '', openingBalance: 1000, currentBalance: 700, monthMovement: -300, isNegative: false },
    ]),
    loadRecentFacts: vi.fn(async () => []),
    initDashboard: vi.fn(async () => ({
      recentFacts: [],
      quickStats: {
        today: { income: 0, expense: 0, credit: 0, debit: 0 },
        month: { income: 0, expense: 500, credit: 0, debit: 0 },
        monthPlan: { income: 0, expense: 1000, credit: 0, debit: 0 },
        planExecution: { incomePct: 0, expensePct: 50, creditPct: 0, debitPct: 0 },
      },
      accountBalances: [
        { id: 1, name: 'Wallet', type: '', currency: '', openingBalance: 1000, currentBalance: 700, monthMovement: -300, isNegative: false },
      ],
    })),
  },
}));

// Mock recentTransactions
vi.mock('@web/dashboard/recentTransactions', () => ({
  loadRecentTransactions: vi.fn(async () => {}),
  buildRecentTransactionsHTML: vi.fn(() => '<div>Recent</div>'),
}));

// Mock @db/dexie (for isDexieActive check in coordinator)
vi.mock('@db/dexie', () => ({
  isDexieActive: vi.fn(() => true),
}));

import { isDexieActive } from '@db/dexie';
const mockIsDexieActive = isDexieActive as import('vitest').MockedFunction<typeof isDexieActive>;

// Helper: set/clear offline-mode class
function setOffline(value: boolean) {
  if (value) {
    document.documentElement.classList.add('offline-mode');
  } else {
    document.documentElement.classList.remove('offline-mode');
  }
}

// Helper: dispatch offline-status-change event
function dispatchOfflineStatus(online: boolean) {
  document.dispatchEvent(new CustomEvent('offline-status-change', { detail: { online } }));
}

// Helper: dispatch htmx:beforeRequest for a section
function dispatchHtmxBeforeRequest(elementId: string): CustomEvent {
  const elt = document.getElementById(elementId);
  const event = new CustomEvent('htmx:beforeRequest', {
    detail: { elt, cancel: false },
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

describe('OfflineDashboardCoordinator', () => {
  let offlineDashboard: typeof import('@web/dashboard/features/offlineDashboard').offlineDashboard;

  beforeEach(async () => {
    // Build minimal DOM
    document.body.innerHTML = `
      <div id="quick-stats"><span class="loading"></span></div>
      <div id="account-balances"><span class="loading"></span></div>
      <div id="recent-transactions-card" data-offline-hidden="true">
        <div id="recent-transactions"></div>
      </div>
    `;
    setOffline(false);

    // Re-import fresh coordinator each test (reset initialized flag)
    vi.resetModules();
    const mod = await import('@web/dashboard/features/offlineDashboard');
    offlineDashboard = mod.offlineDashboard;
  });

  afterEach(() => {
    setOffline(false);
    vi.clearAllMocks();
    mockIsDexieActive.mockReturnValue(true);
    document.body.innerHTML = '';
  });

  it('htmx:beforeRequest is cancelled when offline and element is quick-stats', async () => {
    setOffline(true);
    offlineDashboard.init();
    const event = dispatchHtmxBeforeRequest('quick-stats');
    expect((event as any).detail.cancel).toBe(true);
  });

  it('htmx:beforeRequest passes through when NOT offline', () => {
    setOffline(false);
    offlineDashboard.init();
    const event = dispatchHtmxBeforeRequest('quick-stats');
    expect((event as any).detail.cancel).toBe(false);
  });

  it('htmx:beforeRequest passes through for unrelated elements', () => {
    setOffline(true);
    offlineDashboard.init();
    // Create unrelated element
    const unrelated = document.createElement('div');
    unrelated.id = 'some-other-element';
    document.body.appendChild(unrelated);
    const event = new CustomEvent('htmx:beforeRequest', {
      detail: { elt: unrelated, cancel: false },
      bubbles: true,
    });
    document.dispatchEvent(event);
    expect((event as any).detail.cancel).toBe(false);
  });

  it('offline-status-change(false) triggers renderAll — quick-stats gets offline badge', async () => {
    offlineDashboard.init();
    dispatchOfflineStatus(false);
    // Wait for async renderAll
    await new Promise(r => setTimeout(r, 50));
    const qs = document.getElementById('quick-stats')!;
    expect(qs.innerHTML).toContain('Данные из локального хранилища');
  });

  it('offline-status-change(true) removes offline content and restores data-offline-hidden', async () => {
    offlineDashboard.init();
    // Go offline first
    dispatchOfflineStatus(false);
    await new Promise(r => setTimeout(r, 50));
    // Come back online
    dispatchOfflineStatus(true);
    await new Promise(r => setTimeout(r, 10));
    const card = document.getElementById('recent-transactions-card')!;
    expect(card.getAttribute('data-offline-hidden')).toBe('true');
  });

  it('data-offline-hidden removed from card when going offline', async () => {
    offlineDashboard.init();
    dispatchOfflineStatus(false);
    await new Promise(r => setTimeout(r, 50));
    const card = document.getElementById('recent-transactions-card')!;
    expect(card.getAttribute('data-offline-hidden')).toBeNull();
  });

  it('isDexieActive=false shows unavailable placeholder, not zeros', async () => {
    mockIsDexieActive.mockReturnValue(false);
    offlineDashboard.init();
    dispatchOfflineStatus(false);
    await new Promise(r => setTimeout(r, 50));
    const qs = document.getElementById('quick-stats')!;
    expect(qs.innerHTML).toContain('Данные недоступны');
    expect(qs.innerHTML).not.toContain('stats-grid');
  });

  it('init() registers listener only once (idempotent)', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    offlineDashboard.init();
    offlineDashboard.init();
    // htmx:beforeRequest + offline-status-change = 2 listeners registered once
    const htmxCalls = addEventListenerSpy.mock.calls.filter(c => c[0] === 'htmx:beforeRequest');
    expect(htmxCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:coverage -- --reporter=verbose tests/unit/dashboard/offlineDashboard.test.ts
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Create offlineDashboard.ts**

Create `frontend/web/static/js/dashboard/features/offlineDashboard.ts`:

```typescript
/**
 * Offline Dashboard Coordinator
 *
 * Intercepts HTMX requests when offline and renders dashboard sections
 * from Dexie IndexedDB. Reacts to offline-status-change events.
 *
 * @module dashboard/features/offlineDashboard
 */

import { factsManager } from './factsManager';
import { loadRecentTransactions, buildRecentTransactionsHTML } from '../recentTransactions';
import { isDexieActive } from '@db/dexie';
import type { QuickStats, AccountBalance, RecentFact } from '../types/analytics';

declare const debugLog: (...args: any[]) => void;

// Matches RecentTransaction interface in recentTransactions.ts
interface RecentTransaction {
  id: number;
  record_type: 'fact' | 'plan';
  fact_date: string;
  financial_center_name: string | null;
  article_name: string;
  article_type: 'expense' | 'income' | 'debit' | 'credit';
  amount: string;
  description: string | null;
  is_offline_sync: boolean;
  recurring_plan_id: number | null;
  has_reminder: boolean;
}

const OFFLINE_BADGE = `<div class="flex items-center gap-1 text-xs text-base-content/50 mb-3"><span>📴</span><span>Данные из локального хранилища</span></div>`;
const UNAVAILABLE_BADGE = `<div class="flex items-center gap-1 text-xs text-base-content/50 mb-3"><span>📴</span><span>Данные недоступны</span></div>`;
const SPINNER = `<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>`;

// CSS matching backend analytics_rendering.py _get_quick_stats_css()
const QUICK_STATS_CSS = `<style>
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}
.stat-card{background:oklch(var(--b2));border-radius:.5rem;padding:.5rem .625rem;box-shadow:0 1px 3px rgba(0,0,0,.1);border:1px solid oklch(var(--b3))}
.stat-title{font-weight:600;font-size:.8125rem;margin-bottom:.25rem;display:flex;align-items:center;gap:.25rem}
.stat-rows{display:flex;flex-direction:column;gap:0}
.stat-row{display:flex;justify-content:space-between;align-items:center;gap:.375rem;white-space:nowrap;height:1.125rem}
.stat-label{font-size:.6875rem;opacity:.6;flex-shrink:0}
.stat-value{font-size:.8125rem;font-weight:600;overflow:hidden;text-overflow:ellipsis}
.stat-pct{font-size:.6875rem;font-weight:700}
.mobile-value{display:inline}.desktop-value{display:none}
@media(max-width:374px){.stats-grid{grid-template-columns:1fr;gap:.375rem}}
@media(min-width:768px){.mobile-value{display:none}.desktop-value{display:inline}.stats-grid{grid-template-columns:repeat(4,1fr);gap:.75rem}}
@media(min-width:1024px){.stats-grid{gap:1rem}}
</style>`;

// CSS matching backend analytics_rendering.py _get_balances_css()
const BALANCES_CSS = `<style>
.balances-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}
.balance-card{background:oklch(var(--b2));border-radius:.5rem;padding:.5rem .625rem;box-shadow:0 1px 3px rgba(0,0,0,.1);border:1px solid oklch(var(--b3))}
.balance-title{font-weight:600;font-size:.75rem;margin-bottom:.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.balance-row{display:flex;justify-content:space-between;align-items:baseline;gap:.25rem;white-space:nowrap;line-height:1.2}
.balance-label{font-size:.625rem;opacity:.6;flex-shrink:0}
.balance-value{font-size:.75rem;font-weight:600}
.balance-divider{border-top:1px solid oklch(var(--b3));margin-top:.25rem;padding-top:.25rem}
.mobile-value{display:inline}.desktop-value{display:none}
@media(max-width:374px){.balances-grid{grid-template-columns:1fr;gap:.375rem}}
@media(min-width:768px){.mobile-value{display:none}.desktop-value{display:inline}.balances-grid{grid-template-columns:repeat(4,1fr);gap:.75rem}}
@media(min-width:1024px){.balances-grid{gap:1rem}}
</style>`;

function formatMoneyMobile(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.?0+$/, '')}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;
  return `${sign}${Math.floor(abs)}`;
}

function formatMoneyDesktop(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

function getBalanceColor(balance: number): string {
  if (balance > 0) return 'text-success';
  if (balance < 0) return 'text-error';
  return 'text-base-content';
}

function getPctColor(pct: number): string {
  if (pct >= 95) return 'text-success';
  if (pct >= 80) return 'text-warning';
  return 'text-error';
}

function moneySpan(amount: number): string {
  return `<span class="mobile-value">${formatMoneyMobile(amount)}</span><span class="desktop-value">${formatMoneyDesktop(amount)}</span>`;
}

function buildQuickStatsHTML(data: QuickStats): string {
  const types: Array<[keyof typeof data.month, string, string]> = [
    ['income', '💰 Доходы', 'text-success'],
    ['expense', '💸 Расходы', 'text-error'],
    ['credit', '➕ Пополнение', 'text-info'],
    ['debit', '➖ Списание', 'text-warning'],
  ];

  const cards = types.map(([key, label, css]) => {
    const fact = data.month[key];
    const plan = data.monthPlan[key];
    const pct = plan > 0 ? Math.round((fact / plan) * 100) : 0;
    return `<div class="stat-card">
      <div class="stat-title">${label}</div>
      <div class="stat-rows">
        <div class="stat-row"><span class="stat-label">План</span><span class="stat-value">${moneySpan(plan)}</span></div>
        <div class="stat-row"><span class="stat-label">Факт</span><span class="stat-value ${css}">${moneySpan(fact)}</span></div>
        <div class="stat-row"><span class="stat-label">Исп.%</span><span class="stat-pct ${getPctColor(pct)}">${pct.toFixed(1)}%</span></div>
      </div>
    </div>`;
  }).join('');

  return `${QUICK_STATS_CSS}<div class="stats-grid">${cards}</div>`;
}

function buildAccountBalancesHTML(data: AccountBalance[]): string {
  if (data.length === 0) {
    return `<div class="alert alert-info"><span>Нет активных счетов</span></div>`;
  }

  const cards = data.map(bal => `<div class="balance-card" data-movement="${bal.monthMovement}">
    <div class="balance-title" title="${bal.name}">${bal.name}</div>
    <div>
      <div class="balance-row">
        <span class="balance-label">Начало</span>
        <span class="balance-value ${getBalanceColor(bal.openingBalance)}">${moneySpan(bal.openingBalance)}</span>
      </div>
      <div class="balance-row balance-divider">
        <span class="balance-label">Текущий</span>
        <span class="balance-value font-bold ${getBalanceColor(bal.currentBalance)}">${moneySpan(bal.currentBalance)}</span>
      </div>
    </div>
  </div>`).join('');

  return `${BALANCES_CSS}<div class="balances-grid">${cards}</div>`;
}

function isOfflineMode(): boolean {
  return document.documentElement.classList.contains('offline-mode');
}

class OfflineDashboardCoordinator {
  private initialized = false;
  private rendering = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Layer 1: proactive render if already offline at init time
    if (isOfflineMode()) {
      void this.renderAll();
    }

    // Layer 2: intercept late-fired HTMX requests
    document.addEventListener('htmx:beforeRequest', (e) => {
      this.onHtmxBeforeRequest(e);
    });

    document.addEventListener('offline-status-change', (e) => {
      this.onOfflineStatusChange(e as CustomEvent);
    });
  }

  private onHtmxBeforeRequest(e: Event): void {
    if (!isOfflineMode()) return;
    const elt = (e as CustomEvent).detail?.elt as HTMLElement | undefined;
    if (!elt) return;
    if (['quick-stats', 'account-balances'].includes(elt.id)) {
      (e as CustomEvent).detail.cancel = true;
      void this.renderSection(elt.id);
    }
  }

  private onOfflineStatusChange(e: CustomEvent): void {
    if (e.detail?.online === false) {
      void this.renderAll();
    } else {
      this.clearAll();
    }
  }

  private async renderAll(): Promise<void> {
    if (this.rendering) return;
    if (!isDexieActive()) {
      this.showUnavailable();
      return;
    }
    this.rendering = true;
    try {
      const { recentFacts, quickStats, accountBalances } = await factsManager.initDashboard();
      this.renderQuickStats(quickStats);
      this.renderAccountBalances(accountBalances);
      this.renderRecentFacts(recentFacts);
      // Show card that is normally hidden when offline
      const card = document.getElementById('recent-transactions-card');
      if (card) card.removeAttribute('data-offline-hidden');
    } catch (err) {
      debugLog('[OfflineDashboard] renderAll failed:', err);
      this.showUnavailable();
    } finally {
      this.rendering = false;
    }
  }

  private async renderSection(sectionId: string): Promise<void> {
    try {
      if (sectionId === 'quick-stats') {
        const stats = await factsManager.calculateQuickStats();
        this.renderQuickStats(stats);
      } else if (sectionId === 'account-balances') {
        const balances = await factsManager.loadAccountBalances();
        this.renderAccountBalances(balances);
      }
    } catch (err) {
      debugLog('[OfflineDashboard] renderSection failed:', err);
    }
  }

  private renderQuickStats(data: QuickStats): void {
    const container = document.getElementById('quick-stats');
    if (!container) return;
    container.innerHTML = OFFLINE_BADGE + buildQuickStatsHTML(data);
  }

  private renderAccountBalances(data: AccountBalance[]): void {
    const container = document.getElementById('account-balances');
    if (!container) return;
    container.innerHTML = OFFLINE_BADGE + buildAccountBalancesHTML(data);
  }

  private renderRecentFacts(data: RecentFact[]): void {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    if (data.length === 0) {
      container.innerHTML = OFFLINE_BADGE + `<div class="alert alert-info"><span>Записи не найдены</span></div>`;
      return;
    }
    const mapped: RecentTransaction[] = data.map(f => ({
      id: f.id,
      record_type: f.recordType,
      fact_date: f.factDate,
      financial_center_name: f.financialCenterName,
      article_name: f.articleName,
      article_type: f.articleType,
      amount: f.amount.toString(),
      description: f.comment,
      is_offline_sync: f.syncStatus === 'pending',
      recurring_plan_id: null,
      has_reminder: false,
    }));
    container.innerHTML = OFFLINE_BADGE + buildRecentTransactionsHTML(mapped);
  }

  private clearAll(): void {
    const qs = document.getElementById('quick-stats');
    if (qs) qs.innerHTML = SPINNER;
    const ab = document.getElementById('account-balances');
    if (ab) ab.innerHTML = SPINNER;
    const card = document.getElementById('recent-transactions-card');
    if (card) card.setAttribute('data-offline-hidden', 'true');
    // Re-trigger HTMX loads for server data
    const htmx = (window as any).htmx;
    if (htmx) {
      htmx.trigger(document.getElementById('quick-stats'), 'load');
      htmx.trigger(document.getElementById('account-balances'), 'load');
    }
    void loadRecentTransactions();
  }

  private showUnavailable(): void {
    const qs = document.getElementById('quick-stats');
    if (qs) qs.innerHTML = UNAVAILABLE_BADGE;
    const ab = document.getElementById('account-balances');
    if (ab) ab.innerHTML = UNAVAILABLE_BADGE;
  }
}

export const offlineDashboard = new OfflineDashboardCoordinator();
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:coverage -- --reporter=verbose tests/unit/dashboard/offlineDashboard.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit (skip type-check until Task 3 exports buildRecentTransactionsHTML)**

```bash
git add frontend/web/static/js/dashboard/features/offlineDashboard.ts tests/unit/dashboard/offlineDashboard.test.ts
git commit -m "feat(dashboard): add OfflineDashboardCoordinator with Dexie rendering"
```

> **Note:** `npm run type-check` will fail here because `buildRecentTransactionsHTML` is not yet exported from `recentTransactions.ts`. Run type-check after completing Task 3.

---

## Task 3: recentTransactions.ts — export helper, remove early-return

**Files:**
- Modify: `frontend/web/static/js/dashboard/recentTransactions.ts`

`buildRecentTransactionsHTML` is private — offlineDashboard needs it. Also remove the offline early-return that prevents API load.

- [ ] **Step 1: Export buildRecentTransactionsHTML and remove offline guard**

In `frontend/web/static/js/dashboard/recentTransactions.ts`:

Change line 27-35:
```typescript
export async function loadRecentTransactions(): Promise<void> {
  const container = document.getElementById('recent-transactions');
  if (!container) return;

  // Check offline mode
  const isOffline = document.documentElement.classList.contains('offline-mode');
  if (isOffline) {
    return;
  }
```

To:
```typescript
export async function loadRecentTransactions(): Promise<void> {
  const container = document.getElementById('recent-transactions');
  if (!container) return;
```

And change line 71 from:
```typescript
function buildRecentTransactionsHTML(facts: RecentTransaction[]): string {
```

To:
```typescript
export function buildRecentTransactionsHTML(facts: RecentTransaction[]): string {
```

- [ ] **Step 2: Type-check (validates both Task 2 + Task 3 together)**

```bash
npm run type-check
```

Expected: No errors. This also validates `offlineDashboard.ts` import of `buildRecentTransactionsHTML`.

- [ ] **Step 3: Run all unit tests to verify no regressions**

```bash
npm run test:coverage -- --reporter=verbose tests/unit/dashboard/
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/dashboard/recentTransactions.ts
git commit -m "refactor(dashboard): export buildRecentTransactionsHTML, remove offline early-return"
```

---

## Task 4: dashboard/index.ts — initialize coordinator

**Files:**
- Modify: `frontend/web/static/js/dashboard/index.ts`

Add offlineDashboard import, export, and init call.

- [ ] **Step 1: Add import, export and init**

In `frontend/web/static/js/dashboard/index.ts`, after the line `export { factsManager } from './features/factsManager';`, add:

```typescript
// Offline Dashboard Coordinator (task-012)
export { offlineDashboard } from './features/offlineDashboard';
```

In the `initModule()` function, after `dashboardExports.init();`, add:

```typescript
  // Initialize offline dashboard coordinator
  offlineDashboard.init();
```

And add the import at the top of the Module Initialization section:

```typescript
import { offlineDashboard } from './features/offlineDashboard';
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Run full unit test suite**

```bash
npm run test:coverage
```

Expected: All tests PASS, coverage thresholds met.

- [ ] **Step 4: Build bundles**

```bash
npm run build
```

Expected: No errors, bundles generated.

- [ ] **Step 5: Commit**

```bash
git add frontend/web/static/js/dashboard/index.ts
git commit -m "feat(dashboard): initialize offlineDashboard coordinator in index.ts"
```

---

## Task 5: Playwright E2E tests

**Files:**
- Create: `tests/e2e/webapp/test_offline_dashboard.spec.ts`

E2E tests run against `fbd.ikeniborn.ru` (dev environment). Authentication uses storage state from global setup. **Requires Dexie to be activated and synced** in the test environment; tests check the offline badge presence, not exact data.

- [ ] **Step 1: Write E2E tests**

Create `tests/e2e/webapp/test_offline_dashboard.spec.ts`:

```typescript
/**
 * E2E Tests: Offline Dashboard
 *
 * Verifies offline dashboard rendering using Playwright's network simulation.
 * Tests: offline badge visible, sections rendered, online restore works.
 *
 * Prerequisites:
 * - Dexie must be activated (enablePGlite=true in localStorage) on fbd.ikeniborn.ru
 * - At least one fact must be synced to IndexedDB before going offline
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Load dashboard online first to sync Dexie
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#quick-stats', { state: 'visible', timeout: 15000 });

    // Wait for HTMX sections to load (spinner disappears)
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && !qs.querySelector('.loading');
    }, { timeout: 15000 });
  });

  test('offline badge visible in quick-stats when page loaded offline', async ({ page, context }) => {
    // Go offline before reload
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline rendering (coordinator proactive renderAll)
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    await expect(page.locator('#quick-stats')).toContainText('Данные из локального хранилища');
    await expect(page.locator('#account-balances')).toContainText('Данные из локального хранилища');
  });

  test('recent-transactions card becomes visible when offline', async ({ page, context }) => {
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Card should become visible (data-offline-hidden removed)
    await page.waitForFunction(() => {
      const card = document.getElementById('recent-transactions-card');
      return card && !card.hasAttribute('data-offline-hidden');
    }, { timeout: 10000 });

    const card = page.locator('#recent-transactions-card');
    await expect(card).not.toHaveAttribute('data-offline-hidden');
  });

  test('coming back online removes offline badge and restores HTMX data', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline badge
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Come back online
    await context.setOffline(false);

    // Dispatch offline-status-change event manually (simulates what offline manager does)
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('offline-status-change', { detail: { online: true } }));
    });

    // Wait for offline badge to disappear
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && !qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 15000 });

    // card should be hidden again
    await expect(page.locator('#recent-transactions-card')).toHaveAttribute('data-offline-hidden', 'true');
  });

  test('adding transaction offline reflects in quick-stats after re-render', async ({ page, context }) => {
    const dexieActive = await page.evaluate(() => localStorage.getItem('enablePGlite') === 'true');
    if (!dexieActive) { test.skip(); return; }

    // Go offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for offline badge
    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Capture expense total before
    const expenseBefore = await page.evaluate(() => {
      const qs = document.getElementById('quick-stats');
      return qs?.innerHTML ?? '';
    });

    // Open add transaction modal and add expense offline
    await page.click('#fab-btn');
    await page.waitForSelector('dialog#modal_fact[open]', { timeout: 5000 });
    await page.fill('input[name="amount"]', '999');
    await page.click('button[type="submit"]');
    await page.waitForSelector('dialog#modal_fact:not([open])', { timeout: 5000 });

    // Dispatch WS event to trigger re-render (same as online flow)
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('offline-status-change', { detail: { online: false } }));
    });

    await page.waitForFunction((before: string) => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML !== before && qs.innerHTML.includes('Данные из локального хранилища');
    }, expenseBefore, { timeout: 10000 });

    // Stats grid must still be visible (not spinner)
    await expect(page.locator('#quick-stats .stats-grid')).toBeVisible();
  });

  test('quick-stats shows data (not empty state) when Dexie has facts', async ({ page, context }) => {
    // Only runs meaningfully if Dexie is active and synced
    const dexieActive = await page.evaluate(() => {
      return localStorage.getItem('enablePGlite') === 'true';
    });

    if (!dexieActive) {
      test.skip();
      return;
    }

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(() => {
      const qs = document.getElementById('quick-stats');
      return qs && qs.innerHTML.includes('Данные из локального хранилища');
    }, { timeout: 10000 });

    // Stats grid should be rendered
    await expect(page.locator('#quick-stats .stats-grid')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests (headed for debugging if needed)**

```bash
npm run test:e2e -- tests/e2e/webapp/test_offline_dashboard.spec.ts
```

If any test fails, run headed to debug:

```bash
npm run test:e2e:headed -- tests/e2e/webapp/test_offline_dashboard.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/webapp/test_offline_dashboard.spec.ts
git commit -m "test(e2e): add offline dashboard E2E tests"
```

---

## Self-Review: Spec Coverage

| Spec requirement | Task |
|------------------|------|
| Dexie data source (not HTML cache) | Task 1 |
| `📴 Данные из локального хранилища` badge per section | Task 2 |
| `html.offline-mode` proactive trigger on page load | Task 2 (Layer 1 in `init()`) |
| `offline-status-change` reactive trigger | Task 2 (`onOfflineStatusChange`) |
| `htmx:beforeRequest` interception with `detail.cancel = true` | Task 2 (`onHtmxBeforeRequest`) |
| `loadRecentFacts` includes pending, excludes deleted | Task 1 |
| `calculateQuickStats` groups by article.type | Task 1 |
| `loadAccountBalances` sign logic, FC with no facts = 0 | Task 1 |
| `RecentFact → RecentTransaction` mapping | Task 2 (`renderRecentFacts`) |
| Race condition mitigation (dual-layer init) | Task 2 |
| `clearAll` restores spinners + HTMX retrigger | Task 2 |
| Remove offline early-return from recentTransactions | Task 3 |
| Export `buildRecentTransactionsHTML` | Task 3 |
| Initialize coordinator in dashboard/index.ts | Task 4 |
| `isDexieActive() = false` → placeholder | Task 2 (`renderAll` checks `isDexieActive()` → `showUnavailable`) |
| Guard flag prevents double renderAll | Task 2 (`this.rendering`) |
| Vitest unit tests (all 12 scenarios) | Tasks 1 + 2 (incl. isDexieActive=false for coordinator) |
| Playwright E2E (4 scenarios) | Task 5 (incl. add offline transaction) |

**No gaps found.**
