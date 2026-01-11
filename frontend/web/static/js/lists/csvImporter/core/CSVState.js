/**
 * CSV Importer - State Management
 *
 * Centralized state for CSV import wizard (5 steps).
 *
 * Phase 2.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts
 */
// ============================================================================
// Initial State Factory
// ============================================================================
/**
 * Create initial CSV Importer state
 */
export function createInitialState(listsManager) {
    return {
        // Wizard navigation
        currentStep: 1,
        totalSteps: 5,
        // File data
        file: null,
        fileContent: null,
        // Detection results
        detectionResult: null,
        // Column mapping
        columnMapping: {},
        // Validation results
        validationResult: null,
        // Import options
        importOptions: {
            skipInvalid: true,
            skipDuplicates: false,
            createMissingReferences: true,
            aggregateDuplicates: false
        },
        // Preview state
        previewPagination: {
            currentPage: 1,
            rowsPerPage: 10,
            rowsPerPageOptions: [10, 25, 50, 100]
        },
        previewFilters: {
            store: '',
            group: '',
            product: ''
        },
        allPreviewRows: [],
        // UI references
        container: null,
        onBackToStep1: null,
        globalVarName: 'csvImporter',
        // listsManager reference
        listsManager
    };
}
// ============================================================================
// Singleton State (mimics class instance pattern)
// ============================================================================
let state = null;
export const getState = () => {
    if (!state) {
        throw new Error('[CSVState] State not initialized. Call createInitialState() first.');
    }
    return state;
};
export const updateState = (updates) => {
    if (!state) {
        throw new Error('[CSVState] State not initialized. Call createInitialState() first.');
    }
    state = { ...state, ...updates };
};
export const resetState = (listsManager) => {
    state = createInitialState(listsManager);
};
export const initializeState = (listsManager) => {
    state = createInitialState(listsManager);
};
//# sourceMappingURL=CSVState.js.map