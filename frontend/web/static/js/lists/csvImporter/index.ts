/**
 * csvImporter - Public API for CSV import wizard
 *
 * Modular architecture (Phase 2.4: ES Modules Migration):
 * - core/: State management + CSV parsing
 * - steps/: 5-step wizard (Upload, Detection, Mapping, Preview, Execute)
 * - validation/: Row validation + error handling
 *
 * Features:
 * - Multi-step wizard with breadcrumb navigation
 * - Auto-detection of CSV delimiter and headers
 * - Column mapping with preview
 * - Validation with detailed error reporting
 * - Import options (skip invalid, create missing, etc.)
 * - Web Worker for large file processing
 *
 * Usage:
 * ```typescript
 * import CSVImporter from '@web/lists/csvImporter';
 *
 * const importer = new CSVImporter(listsManager);
 * importer.renderStep1();
 * ```
 */

// ============================================================================
// Core State
// ============================================================================

export { getState, updateState, resetState } from './core/ImportState';
export type {
  ImportState,
  DetectionResult,
  ValidationRow,
  ValidationResult,
  ImportOptions,
  PreviewPagination,
  PreviewFilters
} from './core/ImportState';

// ============================================================================
// CSV Parser (TODO: Create csvParser.ts)
// ============================================================================

/*
export {
  parseCSV,
  detectDelimiter,
  detectEncoding,
  encodeBase64
} from './core/csvParser';
*/

// ============================================================================
// Step Renderers (TODO: Create step modules)
// ============================================================================

/*
export {
  renderStep1,
  handleFileSelect
} from './steps/step1Upload';

export {
  renderStep2,
  analyzeFile
} from './steps/step2Detection';

export {
  renderStep3,
  createColumnMapping
} from './steps/step3Mapping';

export {
  renderStep4,
  validateMapping,
  applyFilters,
  changePage,
  changeRowsPerPage
} from './steps/step4Preview';

export {
  renderStep5,
  executeImport
} from './steps/step5Execute';
*/

// ============================================================================
// Validation (TODO: Create validator.ts)
// ============================================================================

/*
export {
  validateRow,
  checkDuplicates,
  validateReferences
} from './validation/validator';
*/

// ============================================================================
// Temporary: Re-export legacy class for compatibility
// ============================================================================

// TODO Phase 2.4: Remove after full modularization
// For now, we only have ImportState, so we can't instantiate CSVImporter yet
// This will be uncommented once step modules are created

/*
export class CSVImporter {
  constructor(listsManager: any) {
    // Implementation using modules
  }
}

export default CSVImporter;
*/
