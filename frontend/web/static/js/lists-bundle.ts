// Lists Bundle - Aggregates all shopping lists modules
// Generated: 2026-01-11 (Phase 3 csvImporter migration: modular foundation complete)
// Part of v7.0 ES modules migration

// Core lists functionality (TypeScript modules)
// csvImporter.ts: Monolithic class (1,724 lines) - TEMPORARY
// Modular structure: frontend/web/static/js/lists/csvImporter/ (20 files, 3733 lines, 111 exports) - READY
// Phase 3 complete: Infrastructure ready, replacement deferred to Phase 4 (requires importManager.js + googleSheetsImporter.js migration)
import './lists/csvImporter.ts';

// Import/export functionality (JavaScript modules)
import './lists/googleSheetsImporter';
import './lists/importManager';

// Dexie progress notification (v11.0+)
import { showDexieProgress, hideDexieProgress } from './notifications/dexieProgressToast';

// === МОДУЛЬНЫЕ ЭКСПОРТЫ (заменяет legacy listsManager.js) ===
import {
  // Initialization
  initializeListsManager,
  loadShoppingLists,

  // View switching
  switchView,
  initializeResponsiveView,
  renderLandingView,
  renderDetailView,

  // Modals
  openAddItemModal,
  openEditItemModal,
  openCreateListModal,
  closeCreateListModal,
  handleCreateList,
  closeItemModal,
  openDeleteListModal,
  closeDeleteListModal,

  // Search/Filter
  clearSearch,
  toggleHideCompleted,
  toggleSearchField,
  handleSearch,

  // FAB
  toggleListsFAB,

  // Hierarchy integration (v7.0.1)
  initializeHierarchyView,

  // Import integration (v7.0.1)
  initializeImportManager,

  // Item operations (v7.0.1 - for onclick handlers)
  toggleItemCompleted,
  deleteItem,
  handleSaveItem,

  // Modal handlers (v7.x.x - CRITICAL fixes)
  handleDeleteFromModal,
  confirmDeleteList,

  // Bulk delete operations (v7.x.x - CRITICAL fixes)
  confirmDelete,
  closeDeleteConfirmModal,

  // Global helpers (v7.x.x - Navigation & modals)
  openModal,
  navigateHomeOfflineFriendly,
  handleMobileAddButton,
  updateMobileAddButton,

  // WebSocket handlers (v7.0.1 - for budgetWSClient compatibility)
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted
} from './lists/listsManager/index';

// Адаптеры с confirm dialogs
import {
  markAllCompletedWithConfirm,
  unmarkAllCompletedWithConfirm,
  deleteCompletedWithConfirm
} from './lists/listsManager/adapters/windowExports';

// Hierarchy View export (TypeScript migration v7.x)
import { exportHierarchyViewToWindow } from './lists/listsManager/adapters/hierarchyExports';
exportHierarchyViewToWindow();

// === ЭКСПОРТ В WINDOW (для onclick handlers) ===
const windowExports = {
  // Initialization
  initializeListsManager,
  initializeHierarchyView,  // v7.0.1 - HierarchyView integration
  initializeImportManager,  // v7.0.1 - ImportManager integration
  loadShoppingLists,

  // Navigation
  showLandingView: renderLandingView,  // Alias
  showDetailView: renderDetailView,  // Alias for backward compatibility

  // Modals (уже в модулях)
  openAddItemModal,
  openEditItemModal,
  openCreateListModal,
  closeCreateListModal,
  handleCreateList,         // lists.html:281 - Form submit for list creation
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

  // Item operations (onclick handlers) - v7.x.x CRITICAL fixes
  handleSaveItem,           // lists.html:311 - Form submit
  handleDeleteFromModal,    // lists.html:408 - Delete from modal

  // List operations - v7.x.x CRITICAL fixes
  confirmDeleteList,        // lists.html:474 - Confirm list deletion

  // Bulk delete operations - v7.x.x CRITICAL fixes
  confirmDelete,            // lists.html:448 - Confirm bulk delete
  closeDeleteConfirmModal,  // lists.html:447 - Close bulk delete modal

  // Global helpers - v7.x.x CRITICAL fixes
  openModal,                // lists.html:56,62,68 - Open budget modals (stub)
  navigateHomeOfflineFriendly,  // lists.html:38 - Home navigation
  handleMobileAddButton,    // lists.html:XX - Mobile "Add" button (NEW)
  updateMobileAddButton,    // Called by renderLandingView/renderDetailView (NEW)

  markAllCompletedWithConfirm,
  unmarkAllCompletedWithConfirm,
  deleteCompletedWithConfirm,

  // Hierarchy (TypeScript v7.x+)
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

  // Import wizard helpers
  closeImportWizard: () => {
    const container = document.getElementById('import-wizard-container');
    if (!container) return;

    const icon = document.getElementById('import-toggle-icon');
    const hint = document.getElementById('import-toggle-hint');
    const isOpen = !container.classList.contains('hidden');

    if (isOpen) {
      container.classList.add('hidden');
      if (icon) icon.textContent = '▶';
      if (hint) hint.classList.remove('hidden');

      const wizardContainer = document.getElementById('import-wizard');
      if (wizardContainer) wizardContainer.innerHTML = '';
      if (window.importManager) {
        window.importManager.container = null;
        window.importManager.currentMethod = null;
      }
    }
  },

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
  },

  // PGlite progress notifications (v10.1.38+)
  showDexieProgress,
  hideDexieProgress
};

// Экспорт в window (Object.assign - надёжнее работает после минификации)
try {
  if (typeof window !== 'undefined') {
    // Object.assign работает корректно после Vite минификации
    // (в отличие от Object.entries().forEach() который tree-shaking может удалить)
    Object.assign(window, windowExports);

    // Create window.listsManager object for backward compatibility
    // (used in onclick handlers: window.listsManager.showDetailView, toggleItemCompleted)
    // (used by budgetWSClient: addItemToUI, updateItemInUI, removeItemFromUI)
    Object.defineProperty(window, 'listsManager', {
      value: {
        showDetailView: renderDetailView,
        toggleItemCompleted,
        deleteItem,
        // WebSocket compatibility aliases (v7.0.1)
        addItemToUI: handleItemCreated,
        updateItemInUI: handleItemUpdated,
        removeItemFromUI: handleItemDeleted
      },
      writable: false,
      configurable: false,
      enumerable: true
    });

  }
} catch (error) {
  console.error('[LISTS_BUNDLE] ❌ CRITICAL ERROR:', error);
  if (typeof alert !== 'undefined') {
    alert('ОШИБКА: Не удалось загрузить модуль списков. Обратитесь к администратору.');
  }
}
