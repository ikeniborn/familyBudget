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
