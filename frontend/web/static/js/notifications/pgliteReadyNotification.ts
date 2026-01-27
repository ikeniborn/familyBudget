/**
 * PGlite Ready Notification System
 *
 * PHASE 5: User notification when PGlite is ready to use
 *
 * Shows toast with:
 * - "Локальная БД готова!"
 * - Diagnostic info (article count, performance)
 * - Actions: [Да] [Нет] [Подробнее]
 *
 * On "Да": activates PGlite via setPGliteActive(true) and reloads page
 */

import type { ValidationResults } from '@db/pglite';
import { setPGliteActive } from '@db/pglite';

/**
 * Show notification when PGlite is ready
 *
 * @param validationResults - Results from validation suite
 */
export function showPGliteReadyNotification(validationResults: ValidationResults): void {
  // Check if notification already shown
  if (localStorage.getItem('pgliteReadyNotificationShown') === 'true') {
    console.info('[NOTIFICATION] PGlite ready notification already shown');
    return;
  }

  const { details } = validationResults;

  // Create custom toast with actions
  const toastHtml = `
    <div class="flex flex-col gap-2">
      <div class="font-semibold">🚀 Локальная база данных готова!</div>
      <div class="text-sm opacity-80">
        Загружено: ${details.articleCount} статей, ${details.financialCenterCount} счетов, ${details.costCenterCount} мест затрат
      </div>
      <div class="text-sm opacity-80">
        Производительность: ${details.avgQueryTimeMs.toFixed(1)}ms среднее время запроса
      </div>
      <div class="flex gap-2 mt-2">
        <button id="pglite-activate-btn" class="btn btn-primary btn-sm">
          Переключиться
        </button>
        <button id="pglite-dismiss-btn" class="btn btn-ghost btn-sm">
          Позже
        </button>
        <button id="pglite-details-btn" class="btn btn-ghost btn-sm">
          Подробнее
        </button>
      </div>
    </div>
  `;

  // Show toast (persistent, не исчезает автоматически)
  // Note: showToast might not support duration option in base.html implementation
  window.showToast(toastHtml, 'success');
  // TODO: Capture toastId for dismissToast when it's added to window types

  // Обработчики кнопок
  setTimeout(() => {
    const activateBtn = document.getElementById('pglite-activate-btn');
    const dismissBtn = document.getElementById('pglite-dismiss-btn');
    const detailsBtn = document.getElementById('pglite-details-btn');

    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        console.info('[NOTIFICATION] User clicked "Переключиться"');

        // Активируем PGlite
        setPGliteActive(true);

        // Помечаем что notification показан
        localStorage.setItem('pgliteReadyNotificationShown', 'true');

        // TODO: Close toast (dismissToast not in global types yet)
        // if (window.dismissToast) {
        //   window.dismissToast(toastId);
        // }

        // Показываем confirmation
        window.showToast(
          'Переключение на локальную БД выполнено. Страница будет перезагружена.',
          'success'
        );

        // Перезагружаем страницу для применения изменений
        setTimeout(() => window.location.reload(), 1500);
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        console.info('[NOTIFICATION] User dismissed notification');
        // TODO: Close toast (dismissToast not in global types yet)
        // if (window.dismissToast) {
        //   window.dismissToast(toastId);
        // }
      });
    }

    if (detailsBtn) {
      detailsBtn.addEventListener('click', () => {
        console.info('[NOTIFICATION] User clicked "Подробнее"');

        // TODO: Open diagnostic modal
        // const diagnosticModal = (window as any).PGliteDiagnosticModal;
        // if (diagnosticModal) {
        //   diagnosticModal.open();
        // }

        // For now, just show detailed info in console
        console.info('[NOTIFICATION] Validation Results:', validationResults);

        // TODO: Close toast (dismissToast not in global types yet)
        // if (window.dismissToast) {
        //   window.dismissToast(toastId);
        // }
      });
    }
  }, 100); // Small delay to ensure toast is rendered
}
