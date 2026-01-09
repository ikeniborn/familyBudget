/**
 * CSV Importer - Module Structure
 *
 * Phase 2.4: Foundation (types extracted)
 *
 * STATUS: csvImporter.ts (1,724 lines) - complex wizard with 5 steps
 * STRATEGY: Types extracted, class remains for future gradual refactoring
 *
 * Current usage: window.csvImporter (global instance)
 */

// ============================================================================
// Type Definitions (Phase 2.4: Complete)
// ============================================================================

export {
    createInitialState,
    getState,
    updateState,
    resetState,
    initializeState
} from './core/CSVState';

export type {
    ImportOptions,
    PreviewPagination,
    PreviewFilters,
    DetectionResult,
    ValidationResult,
    CSVImporterState
} from './core/CSVState';

// ============================================================================
// Future Modules (not yet implemented)
// ============================================================================

/*
// File operations
export {
    readFileContent,
    encodeBase64,
    detectEncoding
} from './core/fileReader';

// CSV detection
export {
    detectDelimiter,
    detectHeaders,
    parseSampleRows
} from './validation/detector';

// Column mapping
export {
    autoMapColumns,
    validateMapping,
    getRequiredFields
} from './validation/validator';

// Step renderers
export { renderStep1 } from './steps/step1Upload';
export { renderStep2 } from './steps/step2Detection';
export { renderStep3 } from './steps/step3Mapping';
export { renderStep4 } from './steps/step4Preview';
export { renderStep5 } from './steps/step5Execute';

// API integration
export {
    callPreviewAPI,
    executeImport
} from './integration/importAPI';
*/
