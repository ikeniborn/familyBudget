/**
 * Progressive loading toast for PGlite initialization
 * Shows phase-by-phase progress with real-time counts
 *
 * Phases:
 * 1. Database → Инициализация IndexedDB
 * 2. Migrations → Применение схемы v7
 * 3. ConflictManager → Настройка менеджера конфликтов
 * 4. Reference Data → Sync статей/счетов/мест затрат (с прогресс-баром)
 * 5. Facts & Plans → Sync транзакций за 90 дней (754 records, с прогресс-баром)
 * 6. Validation → Проверка готовности
 */

interface ProgressPhase {
  phase: string;          // "Database", "Migrations", "Reference Data", etc.
  message: string;        // "Загружено 300 статей"
  current?: number;       // 300
  total?: number;         // 754
}

let currentToastId: string | null = null;

/**
 * Show or update PGlite initialization progress toast
 *
 * @param progress - Current phase and progress info
 */
export function showPGliteProgress(progress: ProgressPhase): void {
  // Build progress bar HTML if counts available
  const progressBar = progress.total ? `
    <progress class="progress progress-primary w-full mt-2"
              value="${progress.current || 0}"
              max="${progress.total}"></progress>
    <div class="text-xs opacity-60 text-center mt-1">
      ${progress.current || 0} / ${progress.total}
    </div>
  ` : '';

  const toastHtml = `
    <div class="flex flex-col gap-2">
      <div class="font-semibold">⏳ Инициализация локальной БД</div>
      <div class="text-sm opacity-80">
        <span class="font-medium">${progress.phase}:</span> ${progress.message}
      </div>
      ${progressBar}
    </div>
  `;

  // Update existing toast or create new one
  if (currentToastId && typeof (window as any).updateToast === 'function') {
    (window as any).updateToast(currentToastId, toastHtml);
  } else if (typeof (window as any).showToast === 'function') {
    currentToastId = (window as any).showToast(toastHtml, 'info', 0); // 0 = don't auto-dismiss
  }
}

/**
 * Hide PGlite progress toast
 */
export function hidePGliteProgress(): void {
  if (currentToastId && typeof (window as any).dismissToast === 'function') {
    (window as any).dismissToast(currentToastId);
    currentToastId = null;
  }
}
