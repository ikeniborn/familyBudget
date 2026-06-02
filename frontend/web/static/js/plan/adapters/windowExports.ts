/**
 * Plan — Window Exports Adapter
 *
 * Централизованный экспорт публичного API страницы план в window object.
 * Аналог facts/adapters/windowExports.ts.
 *
 * Вызывается из plan/index.ts после инициализации всех модулей,
 * чтобы inline onclick-обработчики и внешние скрипты имели доступ к API.
 *
 * @example
 *   import { setupWindowExports } from './adapters/windowExports';
 *   setupWindowExports(planAppObject, savePlanModalFn);
 */

import * as PlanModal from '../planModal';
import * as PlanHelpers from '../helpers';

// Типы PlanApp определены в plan/index.ts через declare global Window
// Используем any здесь, чтобы избежать циклической зависимости с index.ts

/**
 * Экспортировать объект PlanApp и вспомогательные функции в window.
 * savePlanModal берётся прямо из planApp, чтобы не передавать его дважды.
 *
 * @param planApp - Объект PlanApp для window.PlanApp (содержит savePlanModal)
 */
export function setupWindowExports(
  planApp: NonNullable<typeof window.PlanApp>
): void {
  // Основное пространство имён
  window.PlanApp = planApp;

  // Прямой алиас savePlanModal — без optional chaining,
  // чтобы ошибка «функция не определена» была видима сразу
  window.savePlanModal = planApp.savePlanModal;

  // -----------------------------------------------------------------------
  // CRUD operations
  // -----------------------------------------------------------------------
  window.showEditModal = planApp.showEditModal;
  window.closeEditModal = planApp.closeEditModal;
  window.deleteFact = planApp.deleteFact;
  window.deleteFromEditModal = planApp.deleteFromEditModal;
  window.updateFact = planApp.updateFact;
  window.batchDelete = planApp.batchDeleteFacts;       // HTML использует batchDelete
  window.openAddPlanModal = planApp.openAddPlanModal;
  window.createPlan = planApp.createPlan;
  window.batchDeleteRecurringPlans = planApp.batchDeleteRecurringPlans;
  // cast needed: window type uses string | null, planApp narrows to 'single' | 'all' | null
  window.recurringDeleteResolve = planApp.recurringDeleteResolve as (choice: string | null) => void;

  // -----------------------------------------------------------------------
  // Filter operations
  // -----------------------------------------------------------------------
  window.applyFilters = planApp.applyFilters;
  window.resetFilters = planApp.resetFilters;
  window.collapseFilters = planApp.collapseFilters;

  // -----------------------------------------------------------------------
  // Table operations
  // -----------------------------------------------------------------------
  window.loadFacts = planApp.loadFacts;
  window.toggleSelectAll = planApp.FactsTable.toggleSelectAll;

  // -----------------------------------------------------------------------
  // Analytics operations
  // -----------------------------------------------------------------------
  window.selectAnalyticsMonth = planApp.selectAnalyticsMonth;

  // -----------------------------------------------------------------------
  // Recurring plan helpers
  // -----------------------------------------------------------------------
  window.updateFrequencyFields = planApp.updateFrequencyFields;
  window.updateYearlyFrequencyValue = planApp.updateYearlyFrequencyValue;
  window.updateDurationFields = planApp.updateDurationFields;
  window.updateRecurringPreview = planApp.updateRecurringPreview;

  // -----------------------------------------------------------------------
  // Reminder helpers
  // -----------------------------------------------------------------------
  window.updateReminderDatetime = planApp.updateReminderDatetime;
  window.updateEditReminderDatetime = planApp.updateEditReminderDatetime;

  // -----------------------------------------------------------------------
  // Глобальные переменные состояния (ранее — inline JS plan.html)
  // -----------------------------------------------------------------------
  // allCategories: пустой массив, заполняется в loadArticlesDropdown (index.ts)
  if (!(window as any).allCategories) {
    (window as any).allCategories = [];
  }
  (window as any).ModalListenerManager = PlanModal.ModalListenerManager;
  (window as any).showNotification = PlanHelpers.showNotification;

  // -----------------------------------------------------------------------
  // Plan Modal helpers (ранее были в inline JS plan.html — Unit 4 рефакторинг)
  // -----------------------------------------------------------------------
  (window as any).setSubmitLoading = PlanModal.setSubmitLoading;
  (window as any).loadFinancialCenters = PlanModal.loadFinancialCenters;
  (window as any).loadCostCenters = PlanModal.loadCostCenters;
  (window as any).filterCostCenterDropdown = PlanModal.filterCostCenterDropdown;
  (window as any).resetEditReminderFields = PlanModal.resetEditReminderFields;
  (window as any).populateEditReminderFields = PlanModal.populateEditReminderFields;
  (window as any).initEditReminderCalendarWidget = PlanModal.initEditReminderCalendarWidget;
  (window as any).setupCreatePlanPeriodButtons = PlanModal.setupCreatePlanPeriodButtons;
  (window as any).loadRecurringPlans = PlanModal.loadRecurringPlans;
  (window as any).updateBatchDeleteRecurringPlansButtonState = PlanModal.updateBatchDeleteRecurringPlansButtonState;
  (window as any).selectedRecurringPlanIds = PlanModal.selectedRecurringPlanIds;

  // prefillReminderDateTime и resetReminderFields — делегируем в dashboard
  // (реализации в dashboard.min.js, экспортируются через window.Dashboard)
  (window as any).prefillReminderDateTime = (modalId: string) =>
    (window as any).Dashboard?.prefillReminderDateTime?.(modalId);
  (window as any).resetReminderFields = (modalId: string) =>
    (window as any).Dashboard?.resetReminderFields?.(modalId);

  // getReminderStatusBadge — уже есть в helpers.ts
  (window as any).getReminderStatusBadge = PlanHelpers.getReminderStatusBadge;
}
