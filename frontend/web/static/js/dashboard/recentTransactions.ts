/**
 * Recent Transactions Module
 * Client-side rendering for dashboard recent transactions
 * Full-featured rendering matching /api/v1/facts/recent-html endpoint
 *
 * @module dashboard/recentTransactions
 * @version 2.0.0 (Table Optimization Plan)
 */

interface RecentTransaction {
  id: number;
  record_type: 'fact' | 'plan';
  fact_date: string;
  financial_center_name: string | null;
  article_name: string;
  article_type: 'expense' | 'income' | 'debit' | 'credit';
  amount: string;
  description: string | null;
  recurring_plan_id: number | null;
  has_reminder: boolean;
}

/**
 * Load recent transactions from API and render
 */
export async function loadRecentTransactions(): Promise<void> {
  const container = document.getElementById('recent-transactions');
  if (!container) return;

  try {
    const response = await fetch('/api/v1/facts/recent?limit=10');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const facts: RecentTransaction[] = await response.json();

    if (facts.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>Записи не найдены. Добавьте первую запись!</span>
        </div>
      `;
      return;
    }

    // Build desktop + mobile HTML (matching /recent-html endpoint)
    container.innerHTML = buildRecentTransactionsHTML(facts);

  } catch (error) {
    console.error('[RecentTransactions] Load error:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>Ошибка загрузки записей. Попробуйте обновить страницу.</span>
      </div>
    `;
  }
}

/**
 * Build full HTML with desktop table + mobile list
 * Matches backend /api/v1/facts/recent-html rendering
 */
export function buildRecentTransactionsHTML(facts: RecentTransaction[]): string {
  // Desktop table (hidden on mobile, shown on tablet+)
  let desktopHTML = `
    <div class="hidden md:block overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Дата</th>
            <th>Счёт</th>
            <th>Категория</th>
            <th>Сумма</th>
            <th>Описание</th>
            <th title="Напоминание">🔔</th>
            <th title="Регламентный платеж">🔄</th>
            <th>⚙️ Действия</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Mobile list (hidden on desktop)
  let mobileHTML = `
    <div class="block md:hidden divide-y divide-base-200">
  `;

  for (const fact of facts) {
    // Record type badges
    const recordTypeBadgeSm = fact.record_type === 'plan'
      ? '<span class="badge badge-info badge-xs">План</span>'
      : '<span class="badge badge-success badge-xs">Факт</span>';

    const recordTypeBadge = fact.record_type === 'plan'
      ? '<span class="badge badge-info badge-sm">План</span>'
      : '<span class="badge badge-success badge-sm">Факт</span>';

    // Format dates
    const factDate = new Date(fact.fact_date);
    const factDateFull = factDate.toLocaleDateString('ru-RU');
    const factDateShort = factDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

    // Amount color class (matching backend logic)
    let amountClass = 'font-bold';
    if (fact.article_type === 'expense') amountClass = 'text-error font-bold';
    else if (fact.article_type === 'income') amountClass = 'text-success font-bold';
    else if (fact.article_type === 'debit') amountClass = 'text-info font-bold';
    else if (fact.article_type === 'credit') amountClass = 'text-warning font-bold';

    // Format amount (integer rubles, add sign, add spaces)
    const amountInt = Number(fact.amount) || 0;
    const amountFormatted = amountInt.toLocaleString('ru-RU').replace(',', ' ');
    let amountDisplay = amountFormatted;
    if (fact.article_type === 'expense' || fact.article_type === 'debit') {
      amountDisplay = `-${amountFormatted}`;
    } else if (fact.article_type === 'income' || fact.article_type === 'credit') {
      amountDisplay = `+${amountFormatted}`;
    }

    // Financial center
    const fcName = fact.financial_center_name || '—';

    // Description
    const description = fact.description || '—';
    const descriptionFull = description;
    const descriptionTruncated = description.length > 30 ? description.substring(0, 30) + '...' : description;

    // Icons
    const recurringIcon = fact.recurring_plan_id ? '🔄' : '';
    const recurringTitle = fact.recurring_plan_id ? 'Регламентный платеж' : '';
    const reminderIcon = fact.has_reminder ? '🔔' : '';
    const reminderTitle = fact.has_reminder ? 'Напоминание' : '';

    // Desktop row
    const editButton = `<button class="btn btn-xs btn-primary gap-1" onclick="openEditFromDashboard(${fact.id})">✏️</button>`;
    const deleteButton = `<button class="btn btn-xs btn-error btn-square" onclick="event.stopPropagation(); deleteFactFromDashboard(${fact.id}, ${fact.recurring_plan_id ? 1 : 0})" title="Удалить">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>`;

    desktopHTML += `
      <tr data-fact-id="${fact.id}">
        <td>${recordTypeBadgeSm}</td>
        <td class="whitespace-nowrap">${factDateFull}</td>
        <td class="whitespace-nowrap">${fcName}</td>
        <td>${fact.article_name}</td>
        <td class="${amountClass} whitespace-nowrap">${amountDisplay}</td>
        <td class="max-w-xs truncate" title="${descriptionFull}">${descriptionTruncated}</td>
        <td class="text-center" title="${reminderTitle}">${reminderIcon}</td>
        <td class="text-center" title="${recurringTitle}">${recurringIcon}</td>
        <td>
          <div class="flex gap-1">
            ${editButton}
            ${deleteButton}
          </div>
        </td>
      </tr>
    `;

    // Mobile row (tap entire row to edit)
    const line2Parts = [factDateShort];
    if (fcName !== '—') line2Parts.push(fcName);
    if (description !== '—') line2Parts.push(description);
    const line2Text = line2Parts.join(' • ');

    const recurringSpan = recurringIcon ? `<span class="text-secondary text-xs" title="${recurringTitle}">${recurringIcon}</span>` : '';
    const reminderSpan = reminderIcon ? `<span class="text-warning text-xs" title="${reminderTitle}">${reminderIcon}</span>` : '';

    mobileHTML += `
      <div class="py-2 cursor-pointer hover:bg-base-200 transition-colors rounded-lg px-2 -mx-2"
           data-fact-id="${fact.id}"
           onclick="openEditFromDashboard(${fact.id})">
        <div class="flex items-center gap-2">
          ${recordTypeBadge}
          <span class="flex-1 font-medium truncate">${fact.article_name}</span>
          ${reminderSpan}
          ${recurringSpan}
          <span class="${amountClass} whitespace-nowrap">${amountDisplay}</span>
        </div>
        <div class="text-xs text-base-content/60 mt-1 truncate">
          ${line2Text}
        </div>
      </div>
    `;
  }

  desktopHTML += `
        </tbody>
      </table>
    </div>
  `;

  mobileHTML += `
    </div>
  `;

  return desktopHTML + mobileHTML;
}
