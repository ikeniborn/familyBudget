/**
 * CSV Importer - Preview API Integration
 *
 * Handles CSV validation and preview API calls.
 *
 * Phase 3: ES Modules Migration (Step 5)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 744-835
 */

import {
  getFileData,
  getDetectionResult,
  getColumnMapping,
  setValidationResult,
  getValidationResult,
  getImportOptions,
  updateImportOptions
} from '../core/stateManager';
import { encodeBase64 } from '../operations/fileProcessor';
import type { ValidationResult } from '../core/ImportState';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;

export interface PreviewAPIOptions {
  create_missing_references?: boolean;
  aggregate_duplicates?: boolean;
}

// ============================================================================
// Preview API Call
// ============================================================================

/**
 * Call backend API for CSV preview and validation.
 * Validates CSV data against database, checks for errors and duplicates.
 *
 * @param options - Preview options (create_missing_references, aggregate_duplicates)
 * @returns Validation result
 */
export async function callPreviewAPI(options: PreviewAPIOptions = {}): Promise<ValidationResult> {
  const { content } = getFileData();
  const detectionResult = getDetectionResult();
  const columnMapping = getColumnMapping();

  if (!content) {
    throw new Error('File content is empty');
  }

  if (!detectionResult) {
    throw new Error('Detection result is missing');
  }

  // Encode file content to base64
  const fileContent = await encodeBase64(content);

  // Prepare request payload (transform camelCase to snake_case for API)
  const requestData = {
    file_content: fileContent,
    delimiter: detectionResult.delimiter,
    encoding: detectionResult.encoding,
    has_header: detectionResult.hasHeader,
    column_mapping: columnMapping,
    create_missing_references: options.create_missing_references || false,
    aggregate_duplicates: options.aggregate_duplicates || false
  };

  debugLog('[CSVImporter] Calling preview API with:', requestData);

  const response = await fetch('/api/v1/shopping-lists/import/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to validate CSV data');
  }

  const apiResult = await response.json();

  // Transform API response (snake_case) to ValidationResult (camelCase)
  const validationResult: ValidationResult = {
    valid: apiResult.valid || [],
    invalid: apiResult.invalid || [],
    totalRows: apiResult.total_rows || 0,
    validCount: apiResult.valid_rows || 0,
    invalidCount: apiResult.invalid_rows || 0,
    statistics: {
      missingStores: apiResult.statistics?.missing_stores || 0,
      missingGroups: apiResult.statistics?.missing_groups || 0,
      missingProducts: apiResult.statistics?.missing_products || 0,
      duplicates: apiResult.statistics?.duplicates || 0
    }
  };

  debugLog('[CSVImporter] Validation result:', validationResult);

  // Store in state
  setValidationResult(validationResult);

  return validationResult;
}

// ============================================================================
// Revalidation with Options
// ============================================================================

/**
 * Revalidate CSV with current checkbox options.
 * Reads checkbox states, updates import options, calls preview API, and re-renders results.
 *
 * Called when user toggles checkboxes to update valid_rows count.
 *
 * @returns Updated validation result
 */
export async function revalidateWithOptions(): Promise<ValidationResult> {
  // Read current checkbox states
  const createMissingCheckbox = document.getElementById('create-missing-checkbox') as HTMLInputElement | null;
  const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox') as HTMLInputElement | null;
  const skipInvalidCheckbox = document.getElementById('skip-invalid-checkbox') as HTMLInputElement | null;
  const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox') as HTMLInputElement | null;

  // Save all checkbox states to preserve across rerender
  updateImportOptions({
    createMissingReferences: createMissingCheckbox?.checked || false,
    aggregateDuplicates: aggregateDuplicatesCheckbox?.checked || false,
    skipInvalid: skipInvalidCheckbox?.checked || false,
    skipDuplicates: skipDuplicatesCheckbox?.checked || false
  });

  const importOptions = getImportOptions();

  const options: PreviewAPIOptions = {
    create_missing_references: importOptions.createMissingReferences,
    aggregate_duplicates: importOptions.aggregateDuplicates
  };

  debugLog('[CSVImporter] Revalidating with options:', options);

  // Show loading on import button
  const importButton = document.getElementById('import-button') as HTMLButtonElement | null;
  if (importButton) {
    importButton.disabled = true;
    importButton.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Пересчёт...';
  }

  try {
    // Save previous row count to compare (for aggregation info toast)
    const prevValidationResult = getValidationResult();
    const prevRowCount = prevValidationResult?.totalRows || 0;

    // Call preview API with new options
    const result = await callPreviewAPI(options);

    // Show aggregation info toast if enabled and rows were merged
    const newRowCount = result.totalRows || 0;
    if (importOptions.aggregateDuplicates && prevRowCount > 0 && prevRowCount > newRowCount) {
      const mergedCount = prevRowCount - newRowCount;
      showToast(
        `✓ Агрегация: ${prevRowCount} строк → ${newRowCount} строк (${mergedCount} дубликатов объединено)`,
        'info',
        5000
      );
    }

    return result;

  } catch (error: unknown) {
    debugLog('[CSVImporter] Error revalidating:', error);
    const message = error instanceof Error ? error.message : String(error);
    showToast(`Ошибка пересчёта: ${message}`, 'error');
    throw error;
  }
}

/**
 * Handle Skip Duplicates checkbox state change.
 * Implements mutually exclusive behavior: Skip and Aggregate are incompatible.
 *
 * When Skip is enabled, Aggregate is auto-disabled and hidden.
 */
export function handleSkipDuplicatesChange(): void {
  const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox') as HTMLInputElement | null;
  const aggregateDuplicatesContainer = document.getElementById('aggregate-duplicates-container');
  const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox') as HTMLInputElement | null;

  if (!skipDuplicatesCheckbox) return;

  const skipDuplicatesEnabled = skipDuplicatesCheckbox.checked;

  debugLog('[CSVImporter] Skip Duplicates toggled:', skipDuplicatesEnabled);

  if (skipDuplicatesEnabled) {
    // Hide and disable Aggregate Duplicates (mutually exclusive)
    if (aggregateDuplicatesContainer) {
      aggregateDuplicatesContainer.classList.add('hidden');
    }

    if (aggregateDuplicatesCheckbox) {
      aggregateDuplicatesCheckbox.checked = false;
      debugLog('[CSVImporter] Auto-disabled Aggregate Duplicates (incompatible with Skip)');
    }

    // Update import options
    updateImportOptions({
      skipDuplicates: true,
      aggregateDuplicates: false
    });

  } else {
    // Show Aggregate Duplicates container again
    if (aggregateDuplicatesContainer) {
      aggregateDuplicatesContainer.classList.remove('hidden');
    }

    updateImportOptions({
      skipDuplicates: false
    });
  }
}
