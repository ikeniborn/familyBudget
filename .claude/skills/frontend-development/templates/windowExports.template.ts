/**
 * Window Exports Template
 *
 * Purpose: Bridge between ES Modules and global window object for onclick handlers
 *
 * Usage:
 * 1. Import module functions
 * 2. Export to window object
 * 3. Add TypeScript declarations
 * 4. Use in HTML: onclick="window.functionName()"
 *
 * @file frontend/web/static/js/dashboard/adapters/windowExports.ts
 */

// ============================================================
// Step 1: Import Module Functions
// ============================================================

// Modal functions
import { openModalFact } from '../modalFact';
import { openModalPlan } from '../modalPlan';
import { openContextModal } from '../modals/contextModal';

// FAB controls (Desktop)
import {
  toggleDesktopFabMenu,
  closeDesktopFabMenu
} from '../components/desktopFab';

// Component functions
// import { functionName } from '../path/to/module';


// ============================================================
// Step 2: Export to Window Object
// ============================================================

/**
 * Export modal functions
 */
(window as any).openModalFact = openModalFact;
(window as any).openModalPlan = openModalPlan;
(window as any).openContextModal = openContextModal;

/**
 * Export FAB control functions
 */
(window as any).toggleDesktopFabMenu = toggleDesktopFabMenu;
(window as any).closeDesktopFabMenu = closeDesktopFabMenu;

/**
 * Export component functions
 */
// (window as any).functionName = functionName;


// ============================================================
// Step 3: TypeScript Declarations (Type Safety)
// ============================================================

declare global {
  interface Window {
    // Modal functions
    openModalFact: typeof openModalFact;
    openModalPlan: typeof openModalPlan;
    openContextModal: typeof openContextModal;

    // FAB control functions
    toggleDesktopFabMenu: typeof toggleDesktopFabMenu;
    closeDesktopFabMenu: typeof closeDesktopFabMenu;

    // Component functions
    // functionName: typeof functionName;
  }
}

// Required for TypeScript module augmentation
export {};


// ============================================================
// Usage Example in HTML Templates
// ============================================================

/*
<!-- ✅ CORRECT: Use window. prefix -->
<button onclick="window.openModalFact()">Add Fact</button>

<!-- ✅ CORRECT: Multiple functions -->
<button onclick="window.openModalFact(); window.closeFabMenu();">
  Add Fact
</button>

<!-- ❌ WRONG: Missing window. prefix (ReferenceError!) -->
<button onclick="openModalFact()">Add Fact</button>
*/


// ============================================================
// Best Practices
// ============================================================

/*
1. ALWAYS use window. prefix in HTML onclick handlers
2. Group exports by functionality (modals, FAB, components)
3. Add TypeScript declarations for type safety
4. Document exported functions with JSDoc comments
5. Prefer addEventListener over onclick when possible

Example: addEventListener approach (recommended)
----------------------------------------------------
// In module initialization:
document.getElementById('fab-btn')?.addEventListener('click', () => {
  openModalFact(); // No window. prefix needed in JS
});

// In HTML:
<button id="fab-btn">Add Fact</button>
*/


// ============================================================
// Debugging
// ============================================================

/*
To verify exports in browser console:

> typeof window.openModalFact
"function"

> typeof window.openModalPlan
"function"

To list all custom window exports:

> Object.keys(window).filter(key =>
    key.startsWith('open') ||
    key.startsWith('close') ||
    key.startsWith('toggle')
  )
["openModalFact", "openModalPlan", "toggleDesktopFabMenu", ...]
*/
