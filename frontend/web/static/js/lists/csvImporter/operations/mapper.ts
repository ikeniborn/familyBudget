/**
 * CSV Importer - Column Mapping Operations
 *
 * Handles column mapping management and validation.
 *
 * Phase 3: ES Modules Migration (Step 3)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 638-687
 */

import { getColumnMapping, updateColumnMapping as updateMappingInState, clearColumnMapping } from '../core/stateManager';
import { getRequiredFields } from './detection';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Mapping Management
// ============================================================================

/**
 * Update column mapping for a single column.
 * Automatically validates mapping after update.
 *
 * @param column - CSV column name
 * @param fieldName - Target field name (empty string to unmap)
 * @returns Updated mapping object
 */
export function updateMapping(column: string, fieldName: string): Record<string, string> {
  // Update in state
  updateMappingInState(column, fieldName || '');

  // Get updated mapping
  const mapping = getColumnMapping();

  debugLog('[CSVImporter] Updated mapping:', mapping);

  return mapping;
}

/**
 * Get mapped columns (only columns with assigned fields).
 *
 * @returns Array of mapped CSV columns
 */
export function getMappedColumns(): string[] {
  const mapping = getColumnMapping();
  return Object.keys(mapping).filter(column => mapping[column] !== '');
}

/**
 * Get unmapped columns (columns without assigned fields).
 *
 * @returns Array of unmapped CSV columns
 */
export function getUnmappedColumns(): string[] {
  const mapping = getColumnMapping();
  return Object.keys(mapping).filter(column => mapping[column] === '');
}

/**
 * Get mapped fields (target fields that have been assigned).
 *
 * @returns Array of mapped field names
 */
export function getMappedFields(): string[] {
  const mapping = getColumnMapping();
  return Object.values(mapping).filter((field): field is string => field !== '' && field !== null);
}

/**
 * Reset column mapping to empty state.
 */
export function resetMapping(): void {
  clearColumnMapping();
  debugLog('[CSVImporter] Column mapping reset');
}

// ============================================================================
// Mapping Validation
// ============================================================================

/**
 * Validate column mapping.
 * Checks if all required fields are mapped.
 *
 * @returns Validation result { isValid, missingFields }
 */
export function validateMapping(): { isValid: boolean; missingFields: string[] } {
  const requiredFields = getRequiredFields();
  const mappedFields = getMappedFields();

  const missingFields = requiredFields.filter(field => !mappedFields.includes(field));

  const isValid = missingFields.length === 0;

  debugLog('[CSVImporter] Mapping validation:', { isValid, missingFields });

  return { isValid, missingFields };
}

/**
 * Update mapping validation UI.
 * Shows warning if required fields are missing, success if all mapped.
 *
 * @returns True if validation passed
 */
export function updateMappingValidationUI(): boolean {
  const validationDiv = document.getElementById('mapping-validation');
  if (!validationDiv) {
    console.warn('[CSVImporter] Mapping validation div not found');
    return false;
  }

  const { isValid, missingFields } = validateMapping();

  if (!isValid) {
    validationDiv.innerHTML = `
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Не хватает обязательных полей: ${missingFields.join(', ')}</span>
      </div>
    `;
    return false;
  } else {
    validationDiv.innerHTML = `
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Все обязательные поля сопоставлены!</span>
      </div>
    `;
    return true;
  }
}

/**
 * Check if a specific field is already mapped.
 *
 * @param fieldName - Target field name to check
 * @returns True if field is mapped
 */
export function isFieldMapped(fieldName: string): boolean {
  const mappedFields = getMappedFields();
  return mappedFields.includes(fieldName);
}

/**
 * Get column mapped to a specific field.
 *
 * @param fieldName - Target field name
 * @returns CSV column name or null if not mapped
 */
export function getColumnForField(fieldName: string): string | null {
  const mapping = getColumnMapping();

  for (const [column, field] of Object.entries(mapping)) {
    if (field === fieldName) {
      return column;
    }
  }

  return null;
}

/**
 * Get mapping statistics.
 *
 * @returns Statistics { total, mapped, unmapped, requiredMapped, requiredMissing }
 */
export function getMappingStatistics(): {
  total: number;
  mapped: number;
  unmapped: number;
  requiredMapped: number;
  requiredMissing: number;
} {
  const mapping = getColumnMapping();
  const requiredFields = getRequiredFields();
  const mappedFields = getMappedFields();

  const totalColumns = Object.keys(mapping).length;
  const mappedColumns = getMappedColumns().length;
  const unmappedColumns = getUnmappedColumns().length;

  const requiredMappedCount = requiredFields.filter(field => mappedFields.includes(field)).length;
  const requiredMissingCount = requiredFields.length - requiredMappedCount;

  return {
    total: totalColumns,
    mapped: mappedColumns,
    unmapped: unmappedColumns,
    requiredMapped: requiredMappedCount,
    requiredMissing: requiredMissingCount
  };
}
