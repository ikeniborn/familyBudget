// Lists Bundle - Aggregates all shopping lists modules
// Generated: 2026-01-10
// Part of v7.0 ES modules migration

// Core lists functionality (TypeScript modules)
import './lists/csvImporter';

// Import/export functionality (JavaScript modules)
import './lists/googleSheetsImporter';
import './lists/importManager';

// UI modules
import './lists/hierarchyView';

// === МОДУЛЬНЫЕ ЭКСПОРТЫ (заменяет legacy listsManager.js) ===
import {
  // View switching
  switchView,
  initializeResponsiveView,
  renderLandingView,

  // Modals
  openAddItemModal,
  openCreateListModal,
  closeCreateListModal,
  closeItemModal,
  openDeleteListModal,
  closeDeleteListModal,

  // Search/Filter
  clearSearch,
  toggleHideCompleted,
  toggleSearchField,
  handleSearch,

  // FAB
  toggleListsFAB
} from './lists/listsManager/index';

// Адаптеры с confirm dialogs
import {
  markAllCompletedWithConfirm,
  unmarkAllCompletedWithConfirm,
  deleteCompletedWithConfirm
} from './lists/listsManager/adapters/windowExports';

// === ЭКСПОРТ В WINDOW (для onclick handlers) ===
const windowExports = {
  // Navigation
  showLandingView: renderLandingView,  // Alias

  // Modals (уже в модулях)
  openAddItemModal,
  openCreateListModal,
  closeCreateListModal,
  closeItemModal,
  openDeleteListModal,
  closeDeleteListModal,

  // Search/Filter
  clearItemsSearch: clearSearch,  // Alias
  toggleHideCompleted,
  toggleSearchField,
  handleItemsSearch: handleSearch,  // Alias

  // View switching
  switchView,
  initializeResponsiveView,

  // FAB
  toggleListsFAB,
  markAllCompletedWithConfirm,
  unmarkAllCompletedWithConfirm,
  deleteCompletedWithConfirm,

  // Hierarchy (делегируется на hierarchyView.js)
  toggleAllNodes: () => {
    if (window.hierarchyView) {
      const btn = document.getElementById('hierarchy-toggle-btn');
      if (!btn) return;

      const action = btn.dataset.action || 'expand';

      if (action === 'expand') {
        window.hierarchyView.expandAll();
        btn.dataset.action = 'collapse';
        const icon = document.getElementById('hierarchy-toggle-icon');
        const text = document.getElementById('hierarchy-toggle-text');
        if (icon) icon.textContent = '⬆️';
        if (text) text.textContent = 'Свернуть';
      } else {
        window.hierarchyView.collapseAll();
        btn.dataset.action = 'expand';
        const icon = document.getElementById('hierarchy-toggle-icon');
        const text = document.getElementById('hierarchy-toggle-text');
        if (icon) icon.textContent = '⬇️';
        if (text) text.textContent = 'Развернуть';
      }
    }
  },

  // Import wizard (делегируется на importManager.js)
  toggleImportWizard: () => {
    const container = document.getElementById('import-wizard-container');
    if (!container) return;

    const icon = document.getElementById('import-toggle-icon');
    const hint = document.getElementById('import-toggle-hint');
    const isOpen = !container.classList.contains('hidden');

    if (isOpen) {
      // Closing
      container.classList.add('hidden');
      if (icon) icon.textContent = '▶';
      if (hint) hint.classList.remove('hidden');

      const wizardContainer = document.getElementById('import-wizard');
      if (wizardContainer) wizardContainer.innerHTML = '';
      if (window.importManager) {
        window.importManager.container = null;
        window.importManager.currentMethod = null;
      }
    } else {
      // Opening
      container.classList.remove('hidden');
      if (icon) icon.textContent = '▼';
      if (hint) hint.classList.add('hidden');

      if (window.importManager && !window.importManager.container) {
        window.importManager.init();
      }
    }
  }
};

// Защищённый экспорт в window (Object.defineProperty)
try {
  if (typeof window !== 'undefined') {
    Object.entries(windowExports).forEach(([name, fn]) => {
      Object.defineProperty(window, name, {
        value: fn,
        writable: false,
        configurable: false,
        enumerable: true
      });
    });

    if ((window as any).logAPI) {
      (window as any).logAPI.info('[LISTS_BUNDLE] ✅ All exports locked', {
        count: Object.keys(windowExports).length,
        functions: Object.keys(windowExports).sort(),
        timestamp: new Date().toISOString()
      });
    }
  }
} catch (error) {
  console.error('[LISTS_BUNDLE] ❌ CRITICAL ERROR:', error);
  if (typeof alert !== 'undefined') {
    alert('ОШИБКА: Не удалось загрузить модуль списков. Обратитесь к администратору.');
  }
}

// Логирование успешной загрузки
if (typeof window !== 'undefined' && (window as any).logAPI) {
  (window as any).logAPI.info('[LISTS_BUNDLE] All modules loaded successfully');
}
