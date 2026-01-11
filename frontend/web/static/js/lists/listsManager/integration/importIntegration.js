/**
 * Lists Manager - Import Manager Integration
 *
 * Creates ImportManager instance with listsManager compatibility proxy.
 * Bridges modular TypeScript structure with legacy ImportManager class.
 *
 * Phase 3.5: ES Modules Migration
 */
import { createListsManagerProxy } from '../rendering/hierarchyIntegration';
// ============================================================================
// Import Manager Integration
// ============================================================================
/**
 * Initialize Import Manager with listsManager proxy
 *
 * CRITICAL: ImportManager expects listsManager object with specific methods/properties
 * We provide a compatibility proxy that delegates to modular structure
 *
 * Created instance is exported to window.importManager for global access
 */
export function initializeImportManager() {
    if (typeof window.ImportManager === 'undefined') {
        debugLog('[IMPORT] WARNING: ImportManager class not available');
        return;
    }
    // Reuse the same proxy we use for HierarchyView
    const listsManagerProxy = createListsManagerProxy();
    // Create ImportManager instance
    const importManager = new window.ImportManager(listsManagerProxy);
    // Export to window for global access (used by toggleImportWizard)
    window.importManager = importManager;
    debugLog('[IMPORT] ✅ ImportManager initialized with listsManager proxy');
}
//# sourceMappingURL=importIntegration.js.map