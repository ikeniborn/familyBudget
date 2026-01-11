/**
 * CSV Importer - Results Summary Rendering
 *
 * Renders validation results summary with errors, warnings, statistics, and import options.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 1287-1513
 */

import {
  getContainer,
  getGlobalVarName,
  getValidationResult,
  getImportOptions,
  setAllPreviewRows,
  updatePreviewPagination,
  clearPreviewFilters
} from '../core/stateManager';
import { escapeHtml, pluralize } from '../utils/formatting';
import { getStep1OnClick } from '../utils/navigationHelpers';
import { renderPreviewTableHTML } from './previewTable';
import type { ValidationResult } from '../core/ImportState';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if there are any reference errors in validation result.
 * Reference errors occur when store/product_group not found in DB.
 *
 * IMPORTANT: Returns true if createMissingReferences is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 *
 * @param result - Validation result
 * @returns True if there are reference errors OR option is enabled
 */
function hasReferenceErrors(result: ValidationResult): boolean {
  const importOptions = getImportOptions();

  // Keep checkbox visible if user already enabled the option
  if (importOptions.createMissingReferences) {
    return true;
  }

  // Show checkbox if there are reference errors in current result
  // NOTE: ValidationResult uses invalid[] array, not errors[] array
  // Each invalid row has validation_status and errors array
  if (!result.invalid || result.invalid.length === 0) {
    return false;
  }

  // Check if any invalid row has reference errors
  return result.invalid.some(row =>
    row.errors?.some((e: any) => e.error_type === 'reference')
  );
}

/**
 * Check if there are any duplicate warnings in validation result.
 *
 * IMPORTANT: Returns true if aggregateDuplicates is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 *
 * NOTE: Skip and Aggregate are mutually exclusive - when Skip is enabled,
 * Aggregate must be hidden to prevent user confusion.
 *
 * @param result - Validation result
 * @returns True if there are duplicate warnings OR aggregation is enabled
 */
function hasDuplicateWarnings(result: ValidationResult): boolean {
  const importOptions = getImportOptions();

  // Hide aggregate checkbox if skip duplicates is enabled (mutually exclusive)
  if (importOptions.skipDuplicates) {
    return false;
  }

  // Keep checkbox visible if user already enabled the option
  if (importOptions.aggregateDuplicates) {
    return true;
  }

  // Show checkbox if there are duplicate warnings
  return result.statistics.duplicates > 0;
}

// ============================================================================
// Preview Results Rendering
// ============================================================================

/**
 * Render preview results with validation.
 * Shows validation summary, errors/warnings, preview table, and import options.
 */
export function renderPreviewResults(): void {
  const result = getValidationResult();
  const step1OnClick = getStep1OnClick();
  const varName = getGlobalVarName();
  const container = getContainer();
  const importOptions = getImportOptions();

  if (!container || !result) return;

  // Store all preview rows for client-side filtering/pagination
  // Combine valid and invalid rows
  const allRows = [...result.valid, ...result.invalid];
  setAllPreviewRows(allRows);

  // Reset pagination and filters on new validation
  updatePreviewPagination({ currentPage: 1 });
  clearPreviewFilters();

  // Determine overall status
  const statusClass = result.validCount === result.totalRows ? 'alert-success' : 'alert-warning';
  const statusIcon = result.validCount === result.totalRows
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
  const statusText = result.validCount === result.totalRows
    ? 'Все данные валидны и готовы к импорту'
    : `Обнаружены проблемы: ${result.invalidCount} строк с ошибками`;

  // Build errors list (collect all errors from invalid rows)
  const allErrors: Array<{rowIndex: number; message: string}> = [];
  result.invalid.forEach(row => {
    if (row.errors && row.errors.length > 0) {
      // Errors are objects with field and message properties
      row.errors.forEach(err => {
        allErrors.push({ rowIndex: row.rowIndex, message: err.message });
      });
    }
  });

  const errorsSection = allErrors.length > 0 ? `
    <div class="collapse collapse-arrow bg-error/10 mb-4">
      <input type="checkbox" id="import-errors-toggle" class="peer" checked />
      <label for="import-errors-toggle" class="collapse-title font-medium text-error cursor-pointer">
        ❌ Ошибки (${allErrors.length})
      </label>
      <div class="collapse-content">
        <ul class="list-disc list-inside text-sm space-y-1">
          ${allErrors.slice(0, 10).map(e => `
            <li>Строка ${e.rowIndex + 1}: ${escapeHtml(e.message)}</li>
          `).join('')}
          ${allErrors.length > 10 ? `<li class="text-base-content/70">... и еще ${allErrors.length - 10} ошибок</li>` : ''}
        </ul>
      </div>
    </div>
  ` : '';

  // Build warnings list (collect all warnings from all rows)
  const allWarnings: Array<{rowIndex: number; message: string}> = [];
  allRows.forEach(row => {
    if (row.warnings && row.warnings.length > 0) {
      // Warnings are objects with field and message properties
      row.warnings.forEach(warn => {
        allWarnings.push({ rowIndex: row.rowIndex, message: warn.message });
      });
    }
  });

  const warningsSection = allWarnings.length > 0 ? `
    <div class="collapse collapse-arrow bg-warning/10 mb-4">
      <input type="checkbox" id="import-warnings-toggle" class="peer" />
      <label for="import-warnings-toggle" class="collapse-title font-medium text-warning cursor-pointer">
        ⚠️ Предупреждения (${allWarnings.length})
      </label>
      <div class="collapse-content">
        <ul class="list-disc list-inside text-sm space-y-1">
          ${allWarnings.slice(0, 10).map(w => `
            <li>Строка ${w.rowIndex + 1}: ${escapeHtml(w.message)}</li>
          `).join('')}
          ${allWarnings.length > 10 ? `<li class="text-base-content/70">... и еще ${allWarnings.length - 10} предупреждений</li>` : ''}
        </ul>
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="csv-wizard-step">
      <div class="mb-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li><a onclick="${step1OnClick}">Шаг 1: Загрузка файла</a></li>
            <li><a onclick="window.${varName}.renderStep2()">Шаг 2: Определение формата</a></li>
            <li><a onclick="window.${varName}.renderStep3()">Шаг 3: Сопоставление колонок</a></li>
            <li class="font-bold">Шаг 4: Предпросмотр</li>
            <li class="opacity-50">Шаг 5: Импорт</li>
          </ul>
        </div>
      </div>

      <!-- Status Alert -->
      <div class="alert ${statusClass} mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          ${statusIcon}
        </svg>
        <span>${statusText}</span>
      </div>

      <!-- Statistics -->
      <div class="stats stats-vertical sm:stats-horizontal shadow mb-6 w-full">
        <div class="stat">
          <div class="stat-title">Всего строк</div>
          <div class="stat-value text-primary">${result.totalRows}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Валидных</div>
          <div class="stat-value text-success">${result.validCount}</div>
        </div>
        <div class="stat">
          <div class="stat-title">С ошибками</div>
          <div class="stat-value text-error">${result.invalidCount}</div>
        </div>
      </div>

      <!-- Aggregation Notice -->
      ${importOptions.aggregateDuplicates ? `
      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <strong>Агрегация включена</strong>
          <p class="text-sm">Дубликаты объединены: количество суммируется, комментарии объединяются через запятую.</p>
        </div>
      </div>
      ` : ''}

      <!-- Errors and Warnings -->
      ${errorsSection}
      ${warningsSection}

      <!-- Preview Table with Filters and Pagination -->
      <div id="preview-table-container" class="mb-6">
        ${renderPreviewTableHTML()}
      </div>

      <!-- Import Options -->
      ${result.invalidCount > 0 ? `
      <div class="form-control mb-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" id="skip-invalid-checkbox" class="checkbox checkbox-primary"
                 ${importOptions.skipInvalid ? 'checked' : ''} />
          <span class="label-text">Пропустить строки с ошибками (${result.invalidCount})</span>
        </label>
      </div>
      ` : ''}

      ${result.statistics.duplicates > 0 ? `
      <div class="form-control mb-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" id="skip-duplicates-checkbox" class="checkbox checkbox-warning"
                 ${importOptions.skipDuplicates ? 'checked' : ''}
                 onchange="window.${varName}.handleSkipDuplicatesChange()" />
          <span class="label-text">Пропустить дубликаты (${result.statistics.duplicates})</span>
        </label>
      </div>
      ` : ''}

      <!-- Aggregate duplicates - conditional display -->
      ${hasDuplicateWarnings(result) ? `
      <div id="aggregate-duplicates-container" class="form-control mb-2 ${importOptions.skipDuplicates ? 'hidden' : ''}">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" id="aggregate-duplicates-checkbox" class="checkbox checkbox-info"
                 ${importOptions.aggregateDuplicates ? 'checked' : ''}
                 onchange="window.${varName}.revalidateWithOptions()" />
          <span class="label-text">Агрегировать количество дубликатов</span>
        </label>
        <label class="label pt-0">
          <span class="label-text-alt text-xs opacity-70">Суммировать количество, объединить комментарии через запятую</span>
        </label>
      </div>
      ` : ''}

      <!-- Create missing references - conditional display -->
      ${hasReferenceErrors(result) ? `
      <div class="form-control mb-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" id="create-missing-checkbox" class="checkbox checkbox-success"
                 ${importOptions.createMissingReferences ? 'checked' : ''}
                 onchange="window.${varName}.revalidateWithOptions()" />
          <span class="label-text">Загрузить с новой группой или магазином</span>
        </label>
        <label class="label pt-0">
          <span class="label-text-alt text-xs opacity-70">Автоматически создавать отсутствующие магазины и группы товаров</span>
        </label>
      </div>
      ` : ''}

      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="window.${varName}.renderStep3()">
          ← Назад
        </button>
        <button id="import-button" class="btn btn-success" onclick="window.${varName}.executeImport()" ${result.validCount === 0 ? 'disabled' : ''}>
          ✓ Импортировать ${result.validCount} ${pluralize(result.validCount, 'строку', 'строки', 'строк')}
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// Preview Error Rendering
// ============================================================================

/**
 * Render preview error state.
 * Shows error message with navigation options.
 *
 * @param errorMessage - Error message to display
 */
export function renderPreviewError(errorMessage: string): void {
  const step1OnClick = getStep1OnClick();
  const varName = getGlobalVarName();
  const container = getContainer();

  if (!container) return;

  container.innerHTML = `
    <div class="csv-wizard-step">
      <div class="mb-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li><a onclick="${step1OnClick}">Шаг 1: Загрузка файла</a></li>
            <li><a onclick="window.${varName}.renderStep2()">Шаг 2: Определение формата</a></li>
            <li><a onclick="window.${varName}.renderStep3()">Шаг 3: Сопоставление колонок</a></li>
            <li class="font-bold">Шаг 4: Предпросмотр</li>
            <li class="opacity-50">Шаг 5: Импорт</li>
          </ul>
        </div>
      </div>

      <div class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Ошибка валидации: ${escapeHtml(errorMessage)}</span>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="window.${varName}.renderStep3()">
          ← Назад к маппингу
        </button>
        <button class="btn btn-primary" onclick="window.${varName}.renderStep4()">
          🔄 Повторить
        </button>
      </div>
    </div>
  `;
}
