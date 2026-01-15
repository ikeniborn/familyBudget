/**
 * Hierarchy View Window Exports
 *
 * Exports HierarchyView class to window object for backward compatibility
 * with HTML templates that use onclick="window.hierarchyView.toggleNode(...)"
 */

import { HierarchyView } from '../rendering/HierarchyView';

/**
 * Export HierarchyView class to window object
 * Called during lists-bundle.ts initialization
 */
export function exportHierarchyViewToWindow(): void {
  Object.defineProperty(window, 'HierarchyView', {
    value: HierarchyView,
    writable: false,
    configurable: false,
    enumerable: true,
  });
}
