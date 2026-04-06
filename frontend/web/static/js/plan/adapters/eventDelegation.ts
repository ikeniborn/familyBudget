/**
 * Plan — Event Delegation
 *
 * Централизованная обработка кликов через data-action.
 * Заменяет inline onclick-атрибуты, аналог facts/adapters/eventDelegation.ts.
 *
 * Поддерживаемые data-action:
 *   apply-filters    — применить фильтры и обновить таблицу
 *   reset-filters    — сбросить фильтры и обновить таблицу
 *   collapse-filters — свернуть секцию фильтров
 *   export-csv       — экспорт отфильтрованных записей в CSV
 *   batch-delete     — массовое удаление выбранных записей
 */

import * as PlanFilters from '../filters';
import * as PlanFactsTable from '../factsTable';
import * as FilterAnalyticsSync from '../filterAnalyticsSync';
import * as PlanCRUD from '../crud';

// Глобальная функция из plan.html (inline JS)
declare function exportFilteredFacts(format: string): void;

/** Предотвращает повторную регистрацию слушателя при вызове setupEventDelegation() дважды */
let _delegationSetup = false;

/**
 * Инициализация делегирования событий.
 * Идемпотентна: повторный вызов не регистрирует второй слушатель.
 */
export function setupEventDelegation(): void {
  if (_delegationSetup) return;
  _delegationSetup = true;
  document.addEventListener('click', handleClick);
}

/**
 * Обработчик всех кликов через делегирование
 */
function handleClick(event: Event): void {
  const el = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  if (!el) return;

  const action = el.dataset.action;
  if (!action) return;

  switch (action) {
    case 'apply-filters':
      applyFilters();
      break;

    case 'reset-filters':
      // Останавливаем всплытие, чтобы collapse-label не переключился
      event.stopPropagation();
      event.preventDefault();
      resetFilters();
      break;

    case 'collapse-filters':
      PlanFilters.collapseFilters();
      break;

    case 'export-csv':
      // exportFilteredFacts определена в plan.html (inline JS)
      if (typeof exportFilteredFacts === 'function') {
        exportFilteredFacts('csv');
      }
      break;

    case 'batch-delete':
      PlanCRUD.batchDeleteFacts();
      break;

    default:
      // Неизвестный action — игнорируем
      break;
  }
}

/**
 * Применить фильтры и перезагрузить таблицу фактов
 */
async function applyFilters(): Promise<void> {
  await PlanFilters.applyFilters();
  await PlanFactsTable.loadFacts();
  FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();
}

/**
 * Сбросить фильтры и перезагрузить таблицу фактов
 */
async function resetFilters(): Promise<void> {
  await PlanFilters.resetFilters();
  await PlanFactsTable.loadFacts();
  FilterAnalyticsSync.debouncedSyncFiltersToAnalytics();
}

/**
 * Очистка делегирования (при необходимости)
 */
export function cleanupEventDelegation(): void {
  document.removeEventListener('click', handleClick);
}
