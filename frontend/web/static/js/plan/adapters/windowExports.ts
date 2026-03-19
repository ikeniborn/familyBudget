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
}
