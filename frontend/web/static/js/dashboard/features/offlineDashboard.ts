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
  return `${sign}${Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
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
    this.rendering = true;
    try {
      if (!isDexieActive()) {
        this.showUnavailable();
        return;
      }
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
