/**
 * Recent Transactions Module
 * Client-side rendering for dashboard recent transactions
 *
 * @module dashboard/recentTransactions
 * @version 1.0.0
 */

import { TableFormatters, TableRenderer } from '../shared/tableUtils';
import type { TableColumn, BudgetFact } from '../shared/tableUtils';

interface RecentTransaction extends BudgetFact {
  record_type: 'fact' | 'plan';
}

/**
 * Load recent transactions from API and render
 */
export async function loadRecentTransactions(): Promise<void> {
  const container = document.getElementById('recent-transactions');
  if (!container) return;

  // ✅ Check offline mode
  const isOffline = document.documentElement.classList.contains('offline-mode');
  if (isOffline) {
    // Skip loading in offline mode
    return;
  }

  try {
    // Fetch JSON instead of HTML
    const response = await fetch('/api/v1/facts/recent?limit=10');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const facts: RecentTransaction[] = await response.json();

    if (facts.length === 0) {
      container.innerHTML = TableRenderer.renderEmptyState(
        '📭',
        'Нет последних транзакций',
        'Добавьте первую транзакцию'
      );
      return;
    }

    // Use shared TableRenderer
    const columns = buildRecentTransactionsColumns();
    container.innerHTML = TableRenderer.renderDesktopTable(facts, columns);

  } catch (error) {
    console.error('[RecentTransactions] Load error:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <span>❌ Ошибка загрузки транзакций</span>
      </div>
    `;
  }
}

function buildRecentTransactionsColumns(): TableColumn[] {
  return [
    {
      key: 'type',
      header: 'Тип',
      render: (f: BudgetFact) => {
        const fact = f as RecentTransaction;
        const badgeClass = fact.record_type === 'fact' ? 'badge-primary' : 'badge-secondary';
        const text = fact.record_type === 'fact' ? 'Факт' : 'План';
        return `<span class="badge ${badgeClass} badge-xs">${text}</span>`;
      }
    },
    {
      key: 'date',
      header: 'Дата',
      render: (f) => TableFormatters.formatDate(f.fact_date)
    },
    {
      key: 'account',
      header: 'Счёт',
      render: (f) => TableFormatters.truncateText(f.financial_center_name, 20)
    },
    {
      key: 'category',
      header: 'Категория',
      render: (f) => {
        const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'text');
        const name = TableFormatters.truncateText(f.article_name, 30);
        return `<span class="${colorClass}">${name}</span>`;
      }
    },
    {
      key: 'amount',
      header: 'Сумма',
      render: (f) => {
        const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'amount');
        const formatted = TableFormatters.formatAmount(f.amount, f.article_type);
        return `<span class="${colorClass}">${formatted}</span>`;
      }
    },
    {
      key: 'description',
      header: 'Описание',
      render: (f) => TableFormatters.truncateText(f.description, 30)
    },
    {
      key: 'sync',
      header: '☁️',
      render: (f) => f.is_offline_sync ? '☁️' : ''
    },
    {
      key: 'actions',
      header: 'Действия',
      render: (f) => `
        <button class="btn btn-xs btn-ghost" onclick="editTransaction(${f.id})">✏️</button>
        <button class="btn btn-xs btn-ghost text-error" onclick="deleteTransaction(${f.id})">🗑️</button>
      `
    }
  ];
}
