/**
 * CSV Importer - Public API
 *
 * Barrel export file providing access to all public csvImporter functionality.
 *
 * Phase 3: ES Modules Migration (Step 8)
 */

// ============================================================================
// Core State Management
// ============================================================================

export {
  initializeState,
  getCurrentStep,
  setCurrentStep,
  getTotalSteps,
  setFileData,
  getFileData,
  clearFileData,
  setDetectionResult,
  getDetectionResult,
  clearDetectionResult,
  setColumnMapping,
  updateColumnMapping,
  getColumnMapping,
  clearColumnMapping,
  setValidationResult,
  getValidationResult,
  clearValidationResult,
  updateImportOptions,
  getImportOptions,
  resetImportOptions,
  updatePreviewPagination,
  getPreviewPagination,
  updatePreviewFilters,
  getPreviewFilters,
  clearPreviewFilters,
  setAllPreviewRows,
  getAllPreviewRows,
  getContainer,
  setContainer,
  getGlobalVarName,
  setGlobalVarName,
  setOnBackToStep1,
  getOnBackToStep1,
  setWorkerWrapper,
  getWorkerWrapper,
  getState,
  updateState,
  resetState
} from './core/stateManager';

export type {
  DetectionResult,
  ValidationRow,
  ValidationResult,
  ImportOptions,
  PreviewPagination,
  PreviewFilters,
  ImportState
} from './core/ImportState';

// ============================================================================
// File Operations
// ============================================================================

export {
  readFileContent,
  encodeBase64,
  initializeWorker,
  getWorker,
  handleFileSelect,
  formatFileSize,
  validateCSVFile
} from './operations/fileProcessor';

// ============================================================================
// Detection & Mapping
// ============================================================================

export {
  detectDelimiter,
  parseColumns
} from './operations/detection';

export {
  updateMapping,
  getMappedColumns,
  getUnmappedColumns,
  getMappedFields,
  resetMapping,
  validateMapping,
  updateMappingValidationUI,
  isFieldMapped,
  getColumnForField,
  getMappingStatistics
} from './operations/mapper';

export {
  hasReferenceErrors,
  hasDuplicateWarnings,
  hasErrors,
  hasWarnings,
  getValidationSummary,
  getErrorBreakdown,
  getErrorsByField,
  getRowValidationClass as getRowValidationClassFromValidator,
  getValidationIcon,
  getValidationStatusText,
  validateImportOptions,
  canProceedWithImport
} from './operations/validator';

// ============================================================================
// API Integration
// ============================================================================

export {
  callDetectionAPI,
  detectFormatClientSide,
  detectFormat,
  analyzeFile
} from './integration/detectionAPI';

export {
  callPreviewAPI,
  revalidateWithOptions,
  handleSkipDuplicatesChange
} from './integration/previewAPI';

export type {
  PreviewAPIOptions
} from './integration/previewAPI';

export {
  callImportAPI,
  handleImportSuccess,
  handleImportError,
  executeImport
} from './integration/importAPI';

export type {
  ImportOptions as ImportAPIOptions,
  ImportResult,
  ImportCallbacks
} from './integration/importAPI';

// ============================================================================
// Rendering
// ============================================================================

export {
  renderStep1
} from './rendering/step1Upload';

export {
  renderStep2
} from './rendering/step2Detection';

export {
  renderStep3
} from './rendering/step3Mapping';

export {
  renderStep4
} from './rendering/step4Preview';

export {
  getUniqueFilterValues,
  getFilteredPaginatedRows,
  handleFilterChange,
  handleRowsPerPageChange,
  handlePageChange,
  clearFilters,
  updatePreviewTable,
  renderPreviewTableHTML
} from './rendering/previewTable';

export {
  renderPreviewResults,
  renderPreviewError
} from './rendering/resultsSummary';

// ============================================================================
// Utilities
// ============================================================================

export {
  escapeHtml,
  pluralize
} from './utils/formatting';

export {
  getStep1OnClick,
  getStepOnClick
} from './utils/navigationHelpers';

export {
  getRowValidationClass,
  getStatusBadge,
  getFieldLabel
} from './utils/statusHelpers';
