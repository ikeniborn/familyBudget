/**
 * CSV Importer - Import API Integration
 *
 * Handles CSV import execution and post-import actions.
 *
 * Phase 3: ES Modules Migration (Step 5)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 1574-1709
 */

import { getFileData, getDetectionResult, getColumnMapping, getContainer } from '../core/stateManager';
import { encodeBase64 } from '../operations/fileProcessor';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;
declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
declare const toggleImportWizard: () => void;

export interface ImportOptions {
  shopping_list_id: number;
  skip_duplicates: boolean;
  skip_invalid: boolean;
  create_missing_references: boolean;
  aggregate_duplicates: boolean;
}

export interface ImportResult {
  success: boolean;
  shopping_list_id: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  created_stores?: Array<{ id: number; name: string }>;
  created_product_groups?: Array<{ id: number; name: string }>;
  errors?: Array<{ row_index: number; message: string }>;
}

export interface ImportCallbacks {
  loadStores: () => Promise<void>;
  loadProductGroups: () => Promise<void>;
  loadShoppingListItems: (listId: number) => Promise<void>;
  renderItemsTable: () => void;
  initStoreChoices: () => void;
  initProductGroupChoices: () => void;
}

// ============================================================================
// Import API Call
// ============================================================================

/**
 * Call backend API to execute CSV import.
 *
 * @param options - Import options (list ID, skip flags, create missing)
 * @returns Import result with counts and created entities
 */
export async function callImportAPI(options: ImportOptions): Promise<ImportResult> {
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
    shopping_list_id: options.shopping_list_id,
    skip_duplicates: options.skip_duplicates,
    skip_invalid: options.skip_invalid,
    create_missing_references: options.create_missing_references,
    aggregate_duplicates: options.aggregate_duplicates
  };

  debugLog('[CSVImporter] Executing import with:', requestData);

  const response = await fetch('/api/v1/shopping-lists/import/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to execute import');
  }

  const result = await response.json();
  debugLog('[CSVImporter] Import result:', result);

  return result;
}

// ============================================================================
// Post-Import Actions
// ============================================================================

/**
 * Handle successful import result.
 * Reloads stores/groups, updates UI, shows success toasts.
 *
 * @param result - Import result from API
 * @param callbacks - listsManager callbacks for UI updates
 */
export async function handleImportSuccess(result: ImportResult, callbacks: ImportCallbacks): Promise<void> {
  const { shopping_list_id, created_stores, created_product_groups, imported_count, skipped_count, error_count } = result;

  // Show success toast
  showToast(
    `✅ Импорт завершён! Импортировано: ${imported_count}, Пропущено: ${skipped_count}, Ошибок: ${error_count}`,
    'success',
    5000
  );

  // ✅ CRITICAL: Load stores and product groups BEFORE rendering items table
  // Otherwise new stores/groups won't be found in cache and show "N/A"
  if (created_stores && created_stores.length > 0) {
    debugLog('[CSVImporter] Reloading stores (before render)...', created_stores);
    await callbacks.loadStores();
  }

  if (created_product_groups && created_product_groups.length > 0) {
    debugLog('[CSVImporter] Reloading product groups (before render)...', created_product_groups);
    await callbacks.loadProductGroups();
  }

  // Reload shopping list items
  await callbacks.loadShoppingListItems(shopping_list_id);

  // Re-render items table (now with updated stores/productGroups cache)
  callbacks.renderItemsTable();

  // Reinitialize Choices.js dropdowns for modal forms
  if (created_stores && created_stores.length > 0) {
    callbacks.initStoreChoices();
  }

  if (created_product_groups && created_product_groups.length > 0) {
    callbacks.initProductGroupChoices();
  }

  // Show created references in success toast
  const createdRefs: string[] = [];
  if (created_stores && created_stores.length > 0) {
    createdRefs.push(`Магазины: ${created_stores.map(s => s.name).join(', ')}`);
  }
  if (created_product_groups && created_product_groups.length > 0) {
    createdRefs.push(`Группы: ${created_product_groups.map(g => g.name).join(', ')}`);
  }
  if (createdRefs.length > 0) {
    showToast(`📦 Создано:\n${createdRefs.join('\n')}`, 'info', 5000);
  }

  // Close import accordion
  const importWizardContainer = document.getElementById('import-wizard-container');
  if (importWizardContainer && typeof toggleImportWizard !== 'undefined' && !importWizardContainer.classList.contains('hidden')) {
    toggleImportWizard();
  }

  // Reset wizard
  const container = getContainer();
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Handle import error result.
 * Shows error toasts with first 5 errors.
 *
 * @param result - Import result with errors
 */
export function handleImportError(result: ImportResult): void {
  const { error_count, errors } = result;

  if (!errors || errors.length === 0) {
    showToast('❌ Импорт завершён с ошибками', 'error', 10000);
    return;
  }

  const errorMessages = errors.slice(0, 5).map(e =>
    `Строка ${e.row_index + 1}: ${e.message}`
  ).join('\n');

  showToast(
    `❌ Импорт завершён с ошибками (${error_count}):\n${errorMessages}`,
    'error',
    10000
  );
}

// ============================================================================
// Execute Import (High-level)
// ============================================================================

/**
 * Execute CSV import with full workflow.
 * Reads checkbox options, calls API, handles success/error, updates UI.
 *
 * @param currentListId - Current shopping list ID
 * @param callbacks - listsManager callbacks for UI updates
 */
export async function executeImport(currentListId: number | null, callbacks: ImportCallbacks): Promise<void> {
  try {
    if (!currentListId) {
      showToast('Пожалуйста, выберите список для импорта', 'error');
      return;
    }

    // Read checkbox options
    const skipInvalidCheckbox = document.getElementById('skip-invalid-checkbox') as HTMLInputElement | null;
    const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox') as HTMLInputElement | null;
    const createMissingCheckbox = document.getElementById('create-missing-checkbox') as HTMLInputElement | null;
    const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox') as HTMLInputElement | null;

    const options: ImportOptions = {
      shopping_list_id: currentListId,
      skip_invalid: skipInvalidCheckbox?.checked || false,
      skip_duplicates: skipDuplicatesCheckbox?.checked || false,
      create_missing_references: createMissingCheckbox?.checked || false,
      aggregate_duplicates: aggregateDuplicatesCheckbox?.checked || false
    };

    // Show loading toast
    showToast('Импорт данных...', 'info');

    // Call import API
    const result = await callImportAPI(options);

    // Handle result
    if (result.success || result.imported_count > 0) {
      await handleImportSuccess(result, callbacks);
    } else {
      handleImportError(result);
    }

  } catch (error: unknown) {
    debugLog('[CSVImporter] Error executing import:', error);
    const message = error instanceof Error ? error.message : String(error);
    showToast(`Ошибка импорта: ${message}`, 'error');
  }
}
