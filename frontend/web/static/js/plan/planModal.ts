/**
 * Plan Page Modal Helpers
 *
 * Implementations of helper functions that were previously defined as
 * inline JS in plan.html. Moved here as part of the plan.html refactoring.
 *
 * Provides: financial centers, cost centers, reminder fields,
 * recurring plans, submit loading state, period buttons.
 */

import * as PlanHelpers from './helpers';

// ============================================================================
// Module State
// ============================================================================

/** Cached cost centers for dropdown filtering */
let allCostCenters: Array<{ id: number; name: string }> = [];

/** CalendarWidget instance for edit modal reminder date */
let editReminderCalendarWidget: any = null;

/** Selected recurring plan IDs for batch operations */
export const selectedRecurringPlanIds = new Set<number>();

// ============================================================================
// Modal Listener Manager
// ============================================================================

/**
 * Encapsulated AbortController for edit modal event listeners.
 * Ensures previous listeners are cleaned up before attaching new ones.
 */
export const ModalListenerManager = (() => {
  let abortController: AbortController | null = null;

  return {
    registerListener(
      element: HTMLElement,
      eventName: string,
      handler: EventListener | EventListenerObject
    ): void {
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      element.addEventListener(eventName, handler, { signal: abortController.signal });
    },
    abort(): void {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    },
  };
})();

// ============================================================================
// Submit Loading State
// ============================================================================

/**
 * Toggle loading state on a form's submit button.
 */
export function setSubmitLoading(form: HTMLFormElement, isLoading: boolean): void {
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.innerHTML = isLoading
    ? '<span class="loading loading-spinner loading-sm"></span> Сохранение...'
    : 'Сохранить';
}

// ============================================================================
// Financial Centers
// ============================================================================

/**
 * Load financial centers and populate the edit modal dropdown (#edit-financial-center).
 * The create modal is handled by dashboard.min.js on openModalPlan().
 */
export async function loadFinancialCenters(): Promise<void> {
  try {
    const response = await fetch('/api/v1/financial-centers?limit=1000&include_global=true', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const centers: Array<{ id: number; name: string }> = data.financial_centers || [];

    const editSelect = document.getElementById('edit-financial-center') as HTMLSelectElement | null;
    if (editSelect && editSelect.options.length <= 1) {
      centers.forEach(center => {
        const opt = document.createElement('option');
        opt.value = String(center.id);
        opt.textContent = center.name;
        editSelect.appendChild(opt);
      });
    }
  } catch (error) {
    PlanHelpers.showToast('Ошибка загрузки счетов: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Cost Centers
// ============================================================================

/**
 * Load cost centers and populate the edit modal dropdown (#edit-cost-center).
 * Also caches all centers for use in filterCostCenterDropdown().
 */
export async function loadCostCenters(): Promise<void> {
  try {
    const response = await fetch('/api/v1/cost-centers?limit=1000&include_global=true', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allCostCenters = data.cost_centers || [];

    const editSelect = document.getElementById('edit-cost-center') as HTMLSelectElement | null;
    if (editSelect && editSelect.options.length <= 1) {
      allCostCenters.forEach(center => {
        const opt = document.createElement('option');
        opt.value = String(center.id);
        opt.textContent = center.name;
        editSelect.appendChild(opt);
      });
    }
  } catch (error) {
    PlanHelpers.showToast('Ошибка загрузки МЗ: ' + (error as Error).message, 'error');
  }
}

/**
 * Filter cost center dropdown based on selected financial center.
 * Shows only cost centers linked to the given FC (or all if FC is null).
 */
export async function filterCostCenterDropdown(
  formSelector: string,
  financialCenterId: number | null
): Promise<void> {
  const select = document.querySelector(
    `${formSelector} select[name="cost_center_id"]`
  ) as HTMLSelectElement | null;
  if (!select) return;

  const currentValue = select.value;
  while (select.options.length > 1) select.remove(1);

  const populateFromCache = () => {
    allCostCenters.forEach(cc => {
      const opt = document.createElement('option');
      opt.value = String(cc.id);
      opt.textContent = cc.name;
      select.appendChild(opt);
    });
    if (currentValue) select.value = currentValue;
  };

  if (!financialCenterId || !navigator.onLine) {
    populateFromCache();
    return;
  }

  try {
    const response = await fetch(
      `/api/v1/cost-centers?limit=1000&financial_center_id=${financialCenterId}`,
      { credentials: 'include' }
    );
    if (response.ok) {
      const data = await response.json();
      const filtered: Array<{ id: number; name: string }> = data.cost_centers || [];
      filtered.forEach(cc => {
        const opt = document.createElement('option');
        opt.value = String(cc.id);
        opt.textContent = cc.name;
        if (String(cc.id) === currentValue) opt.selected = true;
        select.appendChild(opt);
      });
    } else {
      populateFromCache();
    }
  } catch {
    populateFromCache();
  }
}

// ============================================================================
// Edit Reminder Fields
// ============================================================================

/** Reset edit modal reminder fields to empty state. */
export function resetEditReminderFields(): void {
  const fields: Array<HTMLInputElement | HTMLSelectElement | null> = [
    document.getElementById('edit-reminder-date') as HTMLInputElement | null,
    document.getElementById('edit-reminder-hour') as HTMLSelectElement | null,
    document.getElementById('edit-reminder-minute') as HTMLSelectElement | null,
    document.getElementById('edit-reminder-datetime') as HTMLInputElement | null,
  ];
  fields.forEach(el => { if (el) el.value = ''; });
}

/**
 * Populate edit modal reminder fields from an ISO datetime string.
 */
export function populateEditReminderFields(isoDatetime: string): void {
  if (!isoDatetime) return;
  const date = new Date(isoDatetime);
  if (isNaN(date.getTime())) return;

  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  const hourSelect = document.getElementById('edit-reminder-hour') as HTMLSelectElement | null;
  const minuteSelect = document.getElementById('edit-reminder-minute') as HTMLSelectElement | null;

  if (dateInput) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    dateInput.value = `${d}.${m}.${date.getFullYear()}`;
  }
  if (hourSelect) hourSelect.value = String(date.getHours()).padStart(2, '0');
  if (minuteSelect) {
    const mins = Math.round(date.getMinutes() / 5) * 5;
    minuteSelect.value = String(mins % 60).padStart(2, '0');
  }

  const updateFn = (window as any).updateEditReminderDatetime;
  if (typeof updateFn === 'function') updateFn();
}

/**
 * Initialize BudgetShared.CalendarWidget for the edit modal reminder date input.
 */
export function initEditReminderCalendarWidget(): void {
  const dateInput = document.getElementById('edit-reminder-date') as HTMLInputElement | null;
  if (!dateInput) return;

  if (editReminderCalendarWidget) {
    editReminderCalendarWidget.destroy();
    editReminderCalendarWidget = null;
  }

  const BudgetShared = (window as any).BudgetShared;
  if (BudgetShared?.CalendarWidget) {
    editReminderCalendarWidget = new BudgetShared.CalendarWidget({
      inputElement: dateInput,
      mode: 'single',
      minDate: new Date(),
      onSelect: () => {
        const fn = (window as any).updateEditReminderDatetime;
        if (typeof fn === 'function') fn();
      },
    });
  }

  const triggerUpdate = () => {
    const fn = (window as any).updateEditReminderDatetime;
    if (typeof fn === 'function') fn();
  };
  document.getElementById('edit-reminder-hour')?.addEventListener('change', triggerUpdate);
  document.getElementById('edit-reminder-minute')?.addEventListener('change', triggerUpdate);
}

// ============================================================================
// Create Plan Period Buttons
// ============================================================================

/**
 * Initialize period (month) selection buttons in the create plan modal.
 * Labels buttons with month names and wires up click handlers.
 */
export function setupCreatePlanPeriodButtons(): void {
  const periodButtons = document.querySelectorAll<HTMLButtonElement>('.period-btn');
  const hiddenInput = document.querySelector<HTMLInputElement>(
    '#form_modal_add_plan input[name="plan_month"]'
  );
  if (!periodButtons.length || !hiddenInput) return;

  const today = new Date();
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  periodButtons.forEach(btn => {
    const offset = parseInt(btn.dataset.offset || '0');
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    btn.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    btn.dataset.year = String(d.getFullYear());
    btn.dataset.month = String(d.getMonth() + 1).padStart(2, '0');
  });

  const first = periodButtons[0];
  if (first) hiddenInput.value = `${first.dataset.year}-${first.dataset.month}`;

  periodButtons.forEach(btn => {
    btn.addEventListener('click', function (this: HTMLButtonElement) {
      periodButtons.forEach(b => b.classList.remove('btn-active'));
      this.classList.add('btn-active');
      hiddenInput.value = `${this.dataset.year}-${this.dataset.month}`;
    });
  });
}

// ============================================================================
// Recurring Plans
// ============================================================================

/** Update batch-delete button text and disabled state. */
export function updateBatchDeleteRecurringPlansButtonState(): void {
  const btn = document.getElementById('batch-delete-recurring-plans-btn') as HTMLButtonElement | null;
  if (!btn) return;
  const count = selectedRecurringPlanIds.size;
  btn.disabled = count === 0;
  btn.textContent = count > 0
    ? `🗑️ Удалить выбранные (${count})`
    : '🗑️ Удалить выбранные';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFrequencyDisplayText(frequencyType: string, frequencyValue: number | null): string {
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  switch (frequencyType) {
    case 'monthly': return `Ежемесячно, ${frequencyValue || 1}-го`;
    case 'quarterly': return `Ежеквартально, ${frequencyValue || 1}-го`;
    case 'weekly': {
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return `Еженедельно, ${days[frequencyValue ?? 0] || '?'}`;
    }
    case 'yearly': {
      if (frequencyValue) {
        const month = Math.floor(frequencyValue / 100);
        const day = frequencyValue % 100;
        return `Ежегодно, ${day} ${monthNames[month - 1] || '?'}`;
      }
      return 'Ежегодно';
    }
    default: return frequencyType || '—';
  }
}

function getDurationDisplayText(plan: any): string {
  if (plan.end_date) return `до ${plan.end_date}`;
  if (plan.occurrences_count) {
    const remaining = plan.remaining_occurrences ?? plan.occurrences_count;
    return `${remaining} повторений`;
  }
  return 'бессрочно';
}

function renderRecurringPlansTable(plans: any[]): void {
  const tbody = document.getElementById('recurring-plans-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  selectedRecurringPlanIds.clear();
  updateBatchDeleteRecurringPlansButtonState();

  plans.forEach(plan => {
    const tr = document.createElement('tr');
    tr.dataset.planId = String(plan.id);

    const articleName = plan.article_name || String(plan.article_id) || '—';
    const fcName = plan.financial_center_name || '—';
    const amount = plan.amount
      ? parseFloat(plan.amount).toLocaleString('ru-RU', { minimumFractionDigits: 0 })
      : '—';
    const nextDate = plan.next_execution_date || '—';

    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox checkbox-sm recurring-plan-checkbox" data-plan-id="${plan.id}"></td>
      <td class="text-sm">${escapeHtml(articleName)}</td>
      <td class="text-sm">${escapeHtml(fcName)}</td>
      <td class="text-sm font-mono">${escapeHtml(amount)}</td>
      <td class="text-sm">${escapeHtml(getFrequencyDisplayText(plan.frequency_type, plan.frequency_value))}</td>
      <td class="text-sm">${escapeHtml(getDurationDisplayText(plan))}</td>
      <td class="text-sm">${escapeHtml(String(nextDate))}</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll<HTMLInputElement>('.recurring-plan-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const planId = parseInt(cb.dataset.planId || '0');
      if (cb.checked) selectedRecurringPlanIds.add(planId);
      else selectedRecurringPlanIds.delete(planId);
      updateBatchDeleteRecurringPlansButtonState();
    });
  });
}

/**
 * Load active recurring plans from API and render in the recurring plans table.
 */
export async function loadRecurringPlans(): Promise<void> {
  const container = document.getElementById('recurring-plans-table-container');
  const emptyState = document.getElementById('recurring-plans-empty-state');

  try {
    const response = await fetch('/api/v1/recurring-plans/?is_active=true', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      container?.classList.add('hidden');
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');
    container?.classList.remove('hidden');
    renderRecurringPlansTable(data.items);
  } catch (error) {
    PlanHelpers.showToast(
      'Ошибка загрузки регламентных платежей: ' + (error as Error).message,
      'error'
    );
    container?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
  }
}
