/**
 * CSV Importer - State Management Functions
 *
 * High-level state management functions for csvImporter module.
 * Provides initialization, accessors, and utility functions.
 *
 * Phase 3: ES Modules Migration (Step 1)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts
 */

import { getState, updateState, resetState } from './ImportState';
import type { ImportOptions, PreviewPagination, PreviewFilters, DetectionResult, ValidationResult, ValidationRow } from './ImportState';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize CSV import state
 *
 * @param _listsManager - Reference to listsManager instance (for compatibility, unused)
 * @param globalVarName - Global variable name for onclick handlers (default: 'csvImporter')
 */
export function initializeState(_listsManager: any, globalVarName: string = 'csvImporter'): void {
  const container = document.getElementById('csv-import-wizard');

  updateState({
    container,
    globalVarName,
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
    onBackToStep1: null,
    workerWrapper: null
  });
}

// ============================================================================
// Step Navigation
// ============================================================================

/**
 * Get current wizard step
 */
export function getCurrentStep(): number {
  return getState().currentStep;
}

/**
 * Set current wizard step
 *
 * @param step - Step number (1-5)
 */
export function setCurrentStep(step: number): void {
  if (step < 1 || step > getState().totalSteps) {
    debugLog(`[CSVImporter] Invalid step: ${step}`);
    return;
  }

  updateState({ currentStep: step });
}

/**
 * Get total number of steps
 */
export function getTotalSteps(): number {
  return getState().totalSteps;
}

// ============================================================================
// File Data
// ============================================================================

/**
 * Set file and content
 *
 * @param file - File object
 * @param content - File content as string
 */
export function setFileData(file: File, content: string): void {
  updateState({
    file,
    fileContent: content
  });
}

/**
 * Get file data
 */
export function getFileData(): { file: File | null; content: string | null } {
  const state = getState();
  return {
    file: state.file,
    content: state.fileContent
  };
}

/**
 * Clear file data
 */
export function clearFileData(): void {
  updateState({
    file: null,
    fileContent: null
  });
}

// ============================================================================
// Detection Results
// ============================================================================

/**
 * Set detection result
 *
 * @param result - Detection result from auto-detection
 */
export function setDetectionResult(result: DetectionResult): void {
  updateState({ detectionResult: result });
}

/**
 * Get detection result
 */
export function getDetectionResult(): DetectionResult | null {
  return getState().detectionResult;
}

/**
 * Clear detection result
 */
export function clearDetectionResult(): void {
  updateState({ detectionResult: null });
}

// ============================================================================
// Column Mapping
// ============================================================================

/**
 * Set column mapping
 *
 * @param mapping - Mapping of CSV columns to target fields
 */
export function setColumnMapping(mapping: Record<string, string>): void {
  updateState({ columnMapping: mapping });
}

/**
 * Update single column mapping
 *
 * @param column - CSV column name
 * @param fieldName - Target field name
 */
export function updateColumnMapping(column: string, fieldName: string): void {
  const state = getState();
  const newMapping = { ...state.columnMapping };

  if (fieldName) {
    newMapping[column] = fieldName;
  } else {
    delete newMapping[column];
  }

  updateState({ columnMapping: newMapping });
}

/**
 * Get column mapping
 */
export function getColumnMapping(): Record<string, string> {
  return getState().columnMapping;
}

/**
 * Clear column mapping
 */
export function clearColumnMapping(): void {
  updateState({ columnMapping: {} });
}

// ============================================================================
// Validation Results
// ============================================================================

/**
 * Set validation result
 *
 * @param result - Validation result from preview API
 */
export function setValidationResult(result: ValidationResult): void {
  updateState({ validationResult: result });
}

/**
 * Get validation result
 */
export function getValidationResult(): ValidationResult | null {
  return getState().validationResult;
}

/**
 * Clear validation result
 */
export function clearValidationResult(): void {
  updateState({ validationResult: null });
}

// ============================================================================
// Import Options
// ============================================================================

/**
 * Update import options (partial)
 *
 * @param options - Partial import options to update
 */
export function updateImportOptions(options: Partial<ImportOptions>): void {
  const state = getState();
  updateState({
    importOptions: { ...state.importOptions, ...options }
  });
}

/**
 * Get import options
 */
export function getImportOptions(): ImportOptions {
  return getState().importOptions;
}

/**
 * Reset import options to defaults
 */
export function resetImportOptions(): void {
  updateState({
    importOptions: {
      skipInvalid: false,
      skipDuplicates: false,
      createMissingReferences: false,
      aggregateDuplicates: false
    }
  });
}

// ============================================================================
// Preview State
// ============================================================================

/**
 * Update preview pagination
 *
 * @param pagination - Partial pagination options
 */
export function updatePreviewPagination(pagination: Partial<PreviewPagination>): void {
  const state = getState();
  updateState({
    previewPagination: { ...state.previewPagination, ...pagination }
  });
}

/**
 * Get preview pagination
 */
export function getPreviewPagination(): PreviewPagination {
  return getState().previewPagination;
}

/**
 * Update preview filters
 *
 * @param filters - Partial filter options
 */
export function updatePreviewFilters(filters: Partial<PreviewFilters>): void {
  const state = getState();
  updateState({
    previewFilters: { ...state.previewFilters, ...filters }
  });
}

/**
 * Get preview filters
 */
export function getPreviewFilters(): PreviewFilters {
  return getState().previewFilters;
}

/**
 * Clear preview filters
 */
export function clearPreviewFilters(): void {
  updateState({
    previewFilters: {
      store: '',
      group: '',
      product: ''
    }
  });
}

/**
 * Set all preview rows
 *
 * @param rows - All preview rows (for client-side filtering)
 */
export function setAllPreviewRows(rows: ValidationRow[]): void {
  updateState({ allPreviewRows: rows });
}

/**
 * Get all preview rows
 */
export function getAllPreviewRows(): ValidationRow[] {
  return getState().allPreviewRows;
}

// ============================================================================
// UI References
// ============================================================================

/**
 * Get container element
 */
export function getContainer(): HTMLElement | null {
  return getState().container;
}

/**
 * Set container element
 *
 * @param container - Container element for wizard UI
 */
export function setContainer(container: HTMLElement | null): void {
  updateState({ container });
}

/**
 * Get global variable name (for onclick handlers)
 */
export function getGlobalVarName(): string {
  return getState().globalVarName;
}

/**
 * Set global variable name
 *
 * @param varName - Variable name to use in onclick handlers
 */
export function setGlobalVarName(varName: string): void {
  updateState({ globalVarName: varName });
}

/**
 * Set custom Step 1 navigation callback
 * Used when delegated from GoogleSheetsImporter
 *
 * @param callback - Custom navigation callback
 */
export function setOnBackToStep1(callback: (() => void) | null): void {
  updateState({ onBackToStep1: callback });
}

/**
 * Get Step 1 navigation callback
 */
export function getOnBackToStep1(): (() => void) | null {
  return getState().onBackToStep1;
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Set worker wrapper instance
 *
 * @param wrapper - WorkerWrapper instance
 */
export function setWorkerWrapper(wrapper: { execute(payload: any): Promise<any> } | null): void {
  updateState({ workerWrapper: wrapper });
}

/**
 * Get worker wrapper instance
 */
export function getWorkerWrapper(): { execute(payload: any): Promise<any> } | null {
  return getState().workerWrapper;
}

// ============================================================================
// Re-export base accessors for convenience
// ============================================================================

export { getState, updateState, resetState };
