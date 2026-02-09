/**
 * Desktop FAB (Floating Action Button) Speed Dial
 * Material Design compliant FAB with upward-expanding menu
 *
 * @module components/desktopFab
 * @version 11.1.0
 */

declare const debugLog: (...args: any[]) => void;

/**
 * Переключает Desktop Speed Dial меню
 * @public
 */
export function toggleDesktopFabMenu(): void {
  const wrapper = document.getElementById('desktop-fab-wrapper');
  const backdrop = document.getElementById('desktop-fab-backdrop');

  if (!wrapper) {
    console.error('[FAB] Desktop FAB elements not found');
    return;
  }

  const isOpen = wrapper.classList.contains('open');

  if (isOpen) {
    // Закрыть меню
    wrapper.classList.remove('open');
    wrapper.classList.add('closed');

    // Скрыть backdrop
    if (backdrop) {
      backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
    }
  } else {
    // Открыть меню
    wrapper.classList.remove('closed');
    wrapper.classList.add('open');

    // Показать backdrop
    if (backdrop) {
      backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    }
  }
}

/**
 * Закрывает Desktop Speed Dial меню
 * @public
 */
export function closeDesktopFabMenu(): void {
  const wrapper = document.getElementById('desktop-fab-wrapper');
  const backdrop = document.getElementById('desktop-fab-backdrop');

  if (wrapper) {
    wrapper.classList.remove('open');
    wrapper.classList.add('closed');
  }

  // Скрыть backdrop
  if (backdrop) {
    backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
  }
}

/**
 * Инициализирует Desktop FAB - добавляет global click listener для закрытия меню
 * при клике вне FAB wrapper (улучшение UX после удаления backdrop)
 * @public
 */
export function initDesktopFab(): void {
  // Global click listener для закрытия меню при клике вне FAB
  document.addEventListener('click', (event: MouseEvent) => {
    const wrapper = document.getElementById('desktop-fab-wrapper');
    if (!wrapper || !wrapper.classList.contains('open')) {
      return;
    }

    // Проверяем, был ли клик вне FAB меню
    const target = event.target as Node;
    if (!wrapper.contains(target)) {
      closeDesktopFabMenu();
    }
  });

  debugLog('[DesktopFAB] Initialized with global click handler');
}

/**
 * Экспорт функций в window для обратной совместимости с onclick handlers
 * @internal
 */
export function exportToWindow(): void {
  // Expose functions globally for onclick handlers in fab_toolbar.html
  (window as any).toggleDesktopFabMenu = toggleDesktopFabMenu;
  (window as any).closeDesktopFabMenu = closeDesktopFabMenu;
}

// Auto-initialize on module load
if (typeof document !== 'undefined') {
  // Export to window first (needed for onclick handlers)
  exportToWindow();

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initDesktopFab();
    });
  } else {
    // DOM already ready
    initDesktopFab();
  }
}
