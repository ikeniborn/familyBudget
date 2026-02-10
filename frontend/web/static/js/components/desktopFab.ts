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
  const status = document.getElementById('fab-status');

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

    // Accessibility: объявить состояние для screen readers
    if (status) {
      status.textContent = 'Меню действий закрыто.';
    }
  } else {
    // Открыть меню
    wrapper.classList.remove('closed');
    wrapper.classList.add('open');

    // Показать backdrop
    if (backdrop) {
      backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    }

    // Accessibility: объявить состояние для screen readers
    if (status) {
      // Count visible menu items
      const visibleItems = wrapper.querySelectorAll('.fab-menu-item:not([style*="display: none"])');
      status.textContent = `Меню действий открыто. ${visibleItems.length} опции доступны.`;
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
  const status = document.getElementById('fab-status');

  if (wrapper) {
    wrapper.classList.remove('open');
    wrapper.classList.add('closed');
  }

  // Скрыть backdrop
  if (backdrop) {
    backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
  }

  // Accessibility: объявить состояние для screen readers
  if (status) {
    status.textContent = 'Меню действий закрыто.';
  }
}

/**
 * Обновляет видимость Desktop FAB пунктов меню в зависимости от online/offline статуса
 * @public
 */
export function updateOfflineVisibility(): void {
  const isOffline = document.documentElement.classList.contains('offline-mode');
  const desktopFab = document.querySelector('.desktop-fab-wrapper') as HTMLElement | null;

  if (!desktopFab) {
    return;
  }

  if (isOffline) {
    // Скрыть "Добавить план" (требует сервер)
    // Оставить "Добавить факт" (работает offline через Dexie.js)
    const planButton = desktopFab.querySelector('[onclick*="openModalPlan"]') as HTMLElement | null;
    const planMenuItem = planButton?.closest('.fab-menu-item') as HTMLElement | null;
    if (planMenuItem) {
      planMenuItem.style.display = 'none';
      debugLog('[DesktopFAB] Hidden "Plan" menu item in offline mode');
    }
  } else {
    // Восстановить все пункты в online режиме
    const planButton = desktopFab.querySelector('[onclick*="openModalPlan"]') as HTMLElement | null;
    const planMenuItem = planButton?.closest('.fab-menu-item') as HTMLElement | null;
    if (planMenuItem) {
      planMenuItem.style.display = '';
      debugLog('[DesktopFAB] Restored "Plan" menu item in online mode');
    }
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

  // Инициализировать offline visibility
  updateOfflineVisibility();

  // Слушать изменения online/offline статуса
  window.addEventListener('online', updateOfflineVisibility);
  window.addEventListener('offline', updateOfflineVisibility);

  // MutationObserver для отслеживания изменений класса offline-mode на <html>
  const offlineObserver = new MutationObserver(() => {
    updateOfflineVisibility();
  });
  offlineObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  debugLog('[DesktopFAB] Initialized with global click handler and offline mode support');
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
