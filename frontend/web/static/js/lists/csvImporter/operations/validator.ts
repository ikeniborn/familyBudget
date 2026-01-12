/**
 * CSV Importer - Validation Operations
 *
 * Handles validation result analysis and error detection.
 *
 * Phase 3: ES Modules Migration (Step 4)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 1247-1535
 */

import { getImportOptions } from '../core/stateManager';

// ============================================================================
// Type Declarations
// ============================================================================

export interface ValidationRow {
  row_index: number;
  status: 'valid' | 'warning' | 'error';
  errors: Array<{ field: string; message: string; error_type?: string }>;
  warnings: Array<{ field: string; message: string }>;
  data: Record<string, any>;
}

export interface ValidationError {
  row_index: number;
  field: string;
  message: string;
  error_type?: string;
}

export interface ValidationWarning {
  row_index: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  is_valid: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_rows: ValidationRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics?: {
    missing_stores: number;
    missing_groups: number;
    duplicates: number;
  };
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Check if validation result has reference errors.
 * Reference errors occur when stores or product groups don't exist.
 *
 * IMPORTANT: Returns true if createMissingReferences option is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 *
 * @param result - Validation result from preview API
 * @returns True if there are reference errors OR option is enabled
 */
export function hasReferenceErrors(result: ValidationResult): boolean {
  const options = getImportOptions();

  // Keep checkbox visible if user already enabled the option
  if (options.createMissingReferences) {
    return true;
  }

  // Show checkbox if there are reference errors in current result
  if (!result.errors || result.errors.length === 0) {
    return false;
  }

  return result.errors.some(e => e.error_type === 'reference');
}

/**
 * Check if validation result has duplicate warnings.
 *
 * IMPORTANT: Returns true if aggregateDuplicates option is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 *
 * NOTE: Skip and Aggregate are mutually exclusive - when skipDuplicates is enabled,
 * this returns false to prevent user confusion.
 *
 * @param result - Validation result from preview API
 * @returns True if there are duplicate warnings OR aggregation is enabled
 */
export function hasDuplicateWarnings(result: ValidationResult): boolean {
  const options = getImportOptions();

  // Hide aggregate checkbox if skip duplicates is enabled (mutually exclusive)
  if (options.skipDuplicates) {
    return false;
  }

  // Keep checkbox visible if user already enabled the option
  if (options.aggregateDuplicates) {
    return true;
  }

  // Show checkbox if there are duplicate warnings
  return result.warnings && result.warnings.length > 0;
}

/**
 * Check if validation result has any errors.
 *
 * @param result - Validation result
 * @returns True if there are errors
 */
export function hasErrors(result: ValidationResult): boolean {
  return result.errors && result.errors.length > 0;
}

/**
 * Check if validation result has any warnings.
 *
 * @param result - Validation result
 * @returns True if there are warnings
 */
export function hasWarnings(result: ValidationResult): boolean {
  return result.warnings && result.warnings.length > 0;
}

// ============================================================================
// Validation Summary
// ============================================================================

/**
 * Get validation summary statistics.
 *
 * @param result - Validation result
 * @returns Summary object with counts
 */
export function getValidationSummary(result: ValidationResult): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorCount: number;
  warningCount: number;
  isValid: boolean;
} {
  return {
    totalRows: result.total_rows || 0,
    validRows: result.valid_rows || 0,
    invalidRows: result.invalid_rows || 0,
    errorCount: result.errors?.length || 0,
    warningCount: result.warnings?.length || 0,
    isValid: result.is_valid || false
  };
}

/**
 * Get error breakdown by type.
 *
 * @param result - Validation result
 * @returns Error counts by type
 */
export function getErrorBreakdown(result: ValidationResult): Record<string, number> {
  if (!result.errors || result.errors.length === 0) {
    return {};
  }

  const breakdown: Record<string, number> = {};

  for (const error of result.errors) {
    const type = error.error_type || 'unknown';
    breakdown[type] = (breakdown[type] || 0) + 1;
  }

  return breakdown;
}

/**
 * Get error breakdown by field.
 *
 * @param result - Validation result
 * @returns Error counts by field name
 */
export function getErrorsByField(result: ValidationResult): Record<string, number> {
  if (!result.errors || result.errors.length === 0) {
    return {};
  }

  const byField: Record<string, number> = {};

  for (const error of result.errors) {
    const field = error.field || 'unknown';
    byField[field] = (byField[field] || 0) + 1;
  }

  return byField;
}

// ============================================================================
// Row Validation
// ============================================================================

/**
 * Get CSS class for row validation status.
 *
 * @param status - Row status ('valid', 'warning', 'error')
 * @returns CSS class name for background color
 */
export function getRowValidationClass(status: string): string {
  switch (status) {
    case 'error':
      return 'bg-error/10';
    case 'warning':
      return 'bg-warning/10';
    default:
      return '';
  }
}

/**
 * Get validation icon for row status.
 *
 * @param status - Row status ('valid', 'warning', 'error')
 * @returns Unicode icon character
 */
export function getValidationIcon(status: string): string {
  switch (status) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    default:
      return '✓';
  }
}

/**
 * Get validation status text.
 *
 * @param status - Row status ('valid', 'warning', 'error')
 * @returns Human-readable status text (Russian)
 */
export function getValidationStatusText(status: string): string {
  switch (status) {
    case 'error':
      return 'Ошибка';
    case 'warning':
      return 'Предупреждение';
    default:
      return 'Валидна';
  }
}

// ============================================================================
// Import Options Validation
// ============================================================================

/**
 * Validate import options for mutual exclusivity.
 * Skip and Aggregate cannot be enabled simultaneously.
 *
 * @returns True if options are valid
 */
export function validateImportOptions(): boolean {
  const options = getImportOptions();

  // Skip and Aggregate are mutually exclusive
  if (options.skipDuplicates && options.aggregateDuplicates) {
    return false;
  }

  return true;
}

/**
 * Check if import can proceed based on validation result.
 *
 * @param result - Validation result
 * @returns Object with canImport flag and reason (if false)
 */
export function canProceedWithImport(result: ValidationResult): { canImport: boolean; reason?: string } {
  // Check if validation passed
  if (!result.is_valid) {
    return {
      canImport: false,
      reason: `Обнаружены ошибки валидации: ${result.invalid_rows} строк с ошибками`
    };
  }

  // Check if there are any valid rows
  if (result.valid_rows === 0) {
    return {
      canImport: false,
      reason: 'Нет валидных строк для импорта'
    };
  }

  // Check import options
  if (!validateImportOptions()) {
    return {
      canImport: false,
      reason: 'Некорректные настройки импорта (Skip и Aggregate нельзя включить одновременно)'
    };
  }

  return { canImport: true };
}
