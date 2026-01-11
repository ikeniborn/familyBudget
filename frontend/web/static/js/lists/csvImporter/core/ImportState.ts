/**
 * CSV Import State Management
 *
 * Central state for csvImporter module.
 * This module has ZERO dependencies to prevent circular dependencies.
 *
 * Phase 2.4: ES Modules Migration
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 36-135
 */

export {}; // Force module scope

// ============================================================================
// Type Definitions
// ============================================================================

export interface DetectionResult {
  delimiter: string;
  hasHeader: boolean;
  headers: string[];
  sampleRows: any[][];
  rowCount: number;
  encoding?: string;
}

export interface ValidationRow {
  rowIndex: number;
  original: Record<string, any>;
  mapped: Record<string, any>;
  errors: Array<{ field: string; message: string; error_type?: string }>;
  warnings: Array<{ field: string; message: string }>;
  isValid: boolean;
}

export interface ValidationResult {
  valid: ValidationRow[];
  invalid: ValidationRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  statistics: {
    missingStores: number;
    missingGroups: number;
    missingProducts: number;
    duplicates: number;
  };
}

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

export interface ImportState {
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

  // Import options (Step 4)
  importOptions: ImportOptions;

  // Preview state (Step 4)
  previewPagination: PreviewPagination;
  previewFilters: PreviewFilters;
  allPreviewRows: ValidationRow[];

  // UI references
  container: HTMLElement | null;
  onBackToStep1: (() => void) | null;
  globalVarName: string;

  // Web Worker reference (class-level in original)
  workerWrapper: any;
}

// ============================================================================
// State Storage (Singleton)
// ============================================================================

let state: ImportState = {
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
    skipInvalid: false,
    skipDuplicates: false,
    createMissingReferences: false,
    aggregateDuplicates: false
  },

  // Preview state
  previewPagination: {
    currentPage: 1,
    rowsPerPage: 15,
    rowsPerPageOptions: [10, 15, 25, 50, 100]
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

  // Web Worker
  workerWrapper: null
};

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current CSV import state (read-only)
 */
export const getState = (): Readonly<ImportState> => state;

/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 */
export const updateState = (updates: Partial<ImportState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 */
export const resetState = (): void => {
  // Clean up resources
  if (state.container) {
    // Don't remove DOM, just clear reference
    state.container = null;
  }

  // Reset state
  state = {
    currentStep: 1,
    totalSteps: 5,
    file: null,
    fileContent: null,
    detectionResult: null,
    columnMapping: {},
    validationResult: null,
    importOptions: {
      skipInvalid: false,
      skipDuplicates: false,
      createMissingReferences: false,
      aggregateDuplicates: false
    },
    previewPagination: {
      currentPage: 1,
      rowsPerPage: 15,
      rowsPerPageOptions: [10, 15, 25, 50, 100]
    },
    previewFilters: {
      store: '',
      group: '',
      product: ''
    },
    allPreviewRows: [],
    container: null,
    onBackToStep1: null,
    globalVarName: 'csvImporter',
    workerWrapper: null
  };
};
