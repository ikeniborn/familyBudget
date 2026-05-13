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
