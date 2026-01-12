/**
 * CSV Importer - State Management
 *
 * Centralized state for CSV import wizard (5 steps).
 *
 * Phase 2.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts
 */

import type { ValidationRow } from './ImportState';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ImportOptions {
    skipInvalid: boolean;
    skipDuplicates: boolean;
    createMissingReferences: boolean;
    aggregateDuplicates: boolean;
}

export interface PreviewPagination {
    currentPage: number;
    rowsPerPage: number;
    rowsPerPageOptions: number[];
}

export interface PreviewFilters {
    store: string;
    group: string;
    product: string;
}

export interface DetectionResult {
    delimiter: string;
    encoding: string;
    headers: string[];
    sampleRows: string[][];
    rowCount: number;
}

export interface ValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
    previewRows: any[];
    statistics: {
        total: number;
        valid: number;
        invalid: number;
        duplicates: number;
    };
}

// ============================================================================
// State Interface
// ============================================================================

/**
 * Complete state for CSVImporter
 *
 * Wizard steps:
 * 1. Upload file
 * 2. Auto-detection results
 * 3. Column mapping
 * 4. Preview & validation
 * 5. Execute import
 */
export interface CSVImporterState {
    // Wizard navigation
    currentStep: number;
    totalSteps: number;

    // File data
    file: File | null;
    fileContent: string | null;

    // Detection results (Step 2)
    detectionResult: DetectionResult | null;

    // Column mapping (Step 3)
    columnMapping: Record<string, string>;

    // Validation results (Step 4)
    validationResult: ValidationResult | null;

    // Import options
    importOptions: ImportOptions;

    // Preview state
    previewPagination: PreviewPagination;
    previewFilters: PreviewFilters;
    allPreviewRows: ValidationRow[];

    // UI references
    container: HTMLElement | null;
    onBackToStep1: (() => void) | null;
    globalVarName: string;

    // listsManager reference
    listsManager: any;
}

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Create initial CSV Importer state
 */
export function createInitialState(listsManager: any): CSVImporterState {
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

let state: CSVImporterState | null = null;

export const getState = (): CSVImporterState => {
    if (!state) {
        throw new Error('[CSVState] State not initialized. Call createInitialState() first.');
    }
    return state;
};

export const updateState = (updates: Partial<CSVImporterState>): void => {
    if (!state) {
        throw new Error('[CSVState] State not initialized. Call createInitialState() first.');
    }
    state = { ...state, ...updates };
};

export const resetState = (listsManager: any): void => {
    state = createInitialState(listsManager);
};

export const initializeState = (listsManager: any): void => {
    state = createInitialState(listsManager);
};
