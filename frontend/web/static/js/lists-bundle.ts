// Lists Bundle - Aggregates all shopping lists modules
// Generated: 2026-01-10
// Part of v7.0 ES modules migration

// Core lists functionality (TypeScript modules)
// REMOVED: import './lists/listsManager'; - Ambiguous module resolution
// ✅ FIX: Import only what's needed from modular structure below
import './lists/csvImporter';

// Import/export functionality (JavaScript modules)
import './lists/googleSheetsImporter';
import './lists/importManager';

// UI modules
import './lists/hierarchyView';

// Export functions to window for HTML onclick handlers
// Import from modular structure
import { switchView, initializeResponsiveView } from './lists/listsManager/index';

// Expose to window (prevent tree-shaking)
try {
  if (typeof window !== 'undefined') {
    // Use Object.defineProperty to prevent overwriting
    Object.defineProperty(window, 'switchView', {
      value: switchView,
      writable: false,      // Prevent accidental overwriting
      configurable: false,  // Prevent redefinition
      enumerable: true      // Make visible in console
    });

    Object.defineProperty(window, 'initializeResponsiveView', {
      value: initializeResponsiveView,
      writable: false,
      configurable: false,
      enumerable: true
    });

    if ((window as any).logAPI) {
      (window as any).logAPI.info('[LISTS_BUNDLE] ✅ Exports locked', {
        switchView: typeof (window as any).switchView,
        initializeResponsiveView: typeof (window as any).initializeResponsiveView,
        timestamp: new Date().toISOString()
      });
    }
  }
} catch (error) {
  console.error('[LISTS_BUNDLE] ❌ CRITICAL ERROR:', error);
  console.error('Details:', {
    name: (error as Error).name,
    message: (error as Error).message,
    stack: (error as Error).stack
  });
  // Alert user of critical failure
  if (typeof alert !== 'undefined') {
    alert('ОШИБКА: Не удалось загрузить модуль списков. Обратитесь к администратору.');
  }
}
// Logging using project standards (logAPI loaded from base.html)
if (typeof window !== 'undefined' && (window as any).logAPI) {
  (window as any).logAPI.info('[LISTS_BUNDLE] All modules loaded successfully');
}
