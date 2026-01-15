/**
 * Transfer Module - Quick Date Selection
 *
 * Quick date buttons and period selection for plan transfers.
 * Migrated from: frontend/web/static/js/transfer.js (lines 78-135, 425-453, 827-870, 901-914)
 */

import { getState } from '../core/TransferState';

// Global dependencies
declare const BudgetShared: any;

/**
 * Setup quick date buttons for fact transfers
 * Migrated from: transfer.js setupQuickDateButtons() (lines 840-870)
 */
export function setupQuickDateButtons(): void {
  const buttons = document.querySelectorAll('[data-quick-date]');

  buttons.forEach(button => {
    button.addEventListener('click', (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      const offset = parseInt(target.dataset.quickDate || '0');

      const state = getState();
      if (!state.dateWidget) return;

      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);

      const dateStr = BudgetShared.DateFormatter.formatForAPI(targetDate);
      state.dateWidget.setDate(dateStr);

      // Reload fact hints
      import('./hints').then(({ loadTransferFactHints }) => {
        loadTransferFactHints('from');
        loadTransferFactHints('to');
      });
    });
  });
}

/**
 * Setup period buttons for plan transfers
 * Migrated from: transfer.js setupPeriodButtons() (lines 533-538)
 */
export function setupPeriodButtons(): void {
  const buttons = document.querySelectorAll('.transfer-period-btn');

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      selectTransferPeriod(index);
    });
  });

  // Initialize month names
  initTransferPeriodButtons();
}

/**
 * Initialize period buttons with month names
 * Migrated from: transfer.js initTransferPeriodButtons() (lines 81-135)
 */
export function initTransferPeriodButtons(): void {
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const now = new Date();

  const buttons = [
    { id: 'transfer_period_btn_1', offset: 0 },
    { id: 'transfer_period_btn_2', offset: 1 },
    { id: 'transfer_period_btn_3', offset: 2 }
  ];

  buttons.forEach(btn => {
    const button = document.getElementById(btn.id);
    if (!button) return;

    const targetDate = new Date(now.getFullYear(), now.getMonth() + btn.offset, 1);
    const monthIndex = targetDate.getMonth();
    const year = targetDate.getFullYear();

    button.textContent = `${monthNames[monthIndex]} ${year}`;
    button.dataset.year = String(year);
    button.dataset.month = String(monthIndex + 1);
  });
}

/**
 * Select transfer period
 * Migrated from: transfer.js selectTransferPeriod() (lines 425-453)
 */
export function selectTransferPeriod(index: number): void {
  const buttons = document.querySelectorAll('.transfer-period-btn');

  buttons.forEach((btn, i) => {
    if (i === index) {
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-info');
    } else {
      btn.classList.remove('btn-info');
      btn.classList.add('btn-outline');
    }
  });

  const selectedButton = buttons[index] as HTMLElement;
  const year = selectedButton.dataset.year;
  const month = selectedButton.dataset.month;

  if (year && month) {
    const period = `${year}-${month.padStart(2, '0')}`;
    const periodInput = document.querySelector<HTMLInputElement>('#transfer_plan_month');
    if (periodInput) {
      periodInput.value = period;
    }

    // Reload plan hints
    import('./hints').then(({ loadTransferPlanHints }) => {
      loadTransferPlanHints('from');
      loadTransferPlanHints('to');
    });
  }
}
