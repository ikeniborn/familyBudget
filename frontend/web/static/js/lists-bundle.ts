// Lists Bundle - Aggregates all shopping lists modules
// Generated: 2026-01-09
// Part of v7.0 ES modules migration

// Core lists functionality (TypeScript modules)
import './lists/listsManager';
import './lists/csvImporter';

// Import/export functionality (JavaScript modules)
import './lists/googleSheetsImporter';
import './lists/importManager';

// UI modules
import './lists/hierarchyView';

// Shared utilities
import './transfer';
import './htmxWidgets';
import './admin-facts-common';

// Logging using project standards (logAPI loaded from base.html)
if (typeof window !== 'undefined' && (window as any).logAPI) {
  (window as any).logAPI.info('[LISTS_BUNDLE] All modules loaded successfully');
}
