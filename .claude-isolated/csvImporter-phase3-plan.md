# csvImporter Phase 3 Migration Plan

## Executive Summary

**Goal:** Refactor monolithic csvImporter.ts (1,724 lines) into modular structure matching listsManager pattern

**Current State:** 40% complete (foundation only)
- ✅ core/CSVState.ts (created)
- ✅ core/ImportState.ts (created)
- ❌ csvImporter.ts (1,724 lines monolithic class)

**Target State:** 100% modular
- core/ - State management (ZERO dependencies)
- operations/ - Business logic (validation, mapping, detection)
- rendering/ - UI rendering (step1-5, preview table)
- integration/ - API calls (preview, import, detection)
- utils/ - Helper functions (escapeHtml, pluralize, etc.)
- index.ts - Barrel exports

**Estimated Time:** 2-3 days
**Risk Level:** Medium (large refactor, but clear structure)

---

## Current csvImporter.ts Structure Analysis

### Class: CSVImporter (1,724 lines)

#### Properties (15):
- listsManager, currentStep, totalSteps
- file, fileContent, detectionResult
- columnMapping, validationResult
- container, onBackToStep1, globalVarName
- importOptions, previewPagination, previewFilters, allPreviewRows

#### Methods by Category (42 total):

**1. Worker Management (2):**
- static initializeWorker()
- async encodeBase64(content)

**2. Navigation (4):**
- getStep1OnClick()
- getStepOnClick(step)
- init()
- (implicit step navigation via onclick)

**3. Step Rendering (5):**
- renderStep1() - File upload UI
- renderStep2() - Auto-detection results
- renderStep3() - Column mapping UI
- renderStep4() - Preview & validation
- (executeImport serves as step 5)

**4. File Operations (3):**
- async handleFileSelect(event)
- readFileContent(file)
- async analyzeFile()

**5. Detection & Mapping (4):**
- detectDelimiter(firstLine)
- autoMapColumns(columns)
- updateMapping(column, fieldName)
- validateMapping()

**6. Validation & API (5):**
- async validateAndContinue()
- async callPreviewAPI(options)
- async revalidateWithOptions()
- hasReferenceErrors(result)
- hasDuplicateWarnings(result)

**7. Preview Management (11):**
- getUniqueFilterValues(field)
- getFilteredPaginatedRows()
- handleFilterChange(filterType, value)
- handleRowsPerPageChange(value)
- handlePageChange(page)
- clearFilters()
- updatePreviewTable()
- renderPreviewTableHTML()
- renderPreviewResults()
- renderPreviewError(errorMessage)
- handleSkipDuplicatesChange()

**8. Import Execution (1):**
- async executeImport()

**9. Utilities (7):**
- getRowValidationClass(status)
- getStatusBadge(status)
- getFieldLabel(field)
- pluralize(count, one, few, many)
- escapeHtml(text)
- (+ internal helpers in various methods)

---

## Proposed Modular Structure

```
lists/csvImporter/
├── index.ts                    # Barrel export (public API)
├── core/
│   ├── CSVState.ts            # ✅ EXISTING - CSV parsing state
│   ├── ImportState.ts         # ✅ EXISTING - Import wizard state
│   └── stateManager.ts        # NEW - State management functions
├── operations/
│   ├── detection.ts           # NEW - Delimiter detection, auto-mapping
│   ├── validator.ts           # NEW - Mapping validation, error checking
│   ├── mapper.ts              # NEW - Column mapping logic
│   └── fileProcessor.ts       # NEW - File reading, encoding
├── rendering/
│   ├── step1Upload.ts         # NEW - Step 1 UI
│   ├── step2Detection.ts      # NEW - Step 2 UI
│   ├── step3Mapping.ts        # NEW - Step 3 UI
│   ├── step4Preview.ts        # NEW - Step 4 UI
│   ├── previewTable.ts        # NEW - Preview table rendering
│   └── resultsSummary.ts      # NEW - Results/errors rendering
├── integration/
│   ├── importAPI.ts           # NEW - Import execution API
│   ├── detectionAPI.ts        # NEW - Server-side detection API
│   └── previewAPI.ts          # NEW - Preview/validation API
└── utils/
    ├── formatting.ts          # NEW - escapeHtml, pluralize
    ├── statusHelpers.ts       # NEW - Status badges, validation classes
    └── filterHelpers.ts       # NEW - Preview filtering/pagination
```

---

## Migration Steps (Detailed)

### Step 1: Extract Core State Management (30 min)

**File:** `core/stateManager.ts`

**Extract from csvImporter.ts:**
- Constructor initialization → initializeState()
- Property access → getState(), updateState()
- State reset logic

**Functions to create:**
```typescript
export function initializeState(listsManager: any): void
export function getState(): Readonly<ImportState>
export function updateState(updates: Partial<ImportState>): void
export function resetState(): void
export function getCurrentStep(): number
export function setCurrentStep(step: number): void
```

**Dependencies:** ZERO (imports from CSVState.ts, ImportState.ts only for types)

---

### Step 2: Extract File Operations (45 min)

**File:** `operations/fileProcessor.ts`

**Extract methods:**
- handleFileSelect(event)
- readFileContent(file)
- encodeBase64(content)
- initializeWorker() (static method → module function)

**Functions to create:**
```typescript
export async function handleFileSelect(event: Event, onSuccess: (file: File, content: string) => void): Promise<void>
export function readFileContent(file: File): Promise<string | ArrayBuffer | null>
export async function encodeBase64(content: string): Promise<string>
export function initializeWorker(): void
export function getWorkerWrapper(): any
```

**Dependencies:** core/stateManager (for updateState)

---

### Step 3: Extract Detection & Mapping (1 hour)

**File:** `operations/detection.ts`

**Extract methods:**
- detectDelimiter(firstLine)
- autoMapColumns(columns)

**Functions to create:**
```typescript
export function detectDelimiter(firstLine: string): string
export function autoMapColumns(columns: string[]): Record<string, string>
export function analyzeFileContent(content: string): { delimiter: string; columns: string[] }
```

**File:** `operations/mapper.ts`

**Extract methods:**
- updateMapping(column, fieldName)
- validateMapping()

**Functions to create:**
```typescript
export function updateColumnMapping(column: string, fieldName: string): void
export function validateMapping(): { isValid: boolean; missingFields: string[] }
export function getMappedColumns(): Record<string, string>
export function resetMapping(): void
```

**Dependencies:** core/stateManager

---

### Step 4: Extract Validation Operations (1 hour)

**File:** `operations/validator.ts`

**Extract methods:**
- hasReferenceErrors(result)
- hasDuplicateWarnings(result)
- getRowValidationClass(status)

**Functions to create:**
```typescript
export function hasReferenceErrors(result: any): boolean
export function hasDuplicateWarnings(result: any): boolean
export function getRowValidationClass(status: string): string
export function validateImportOptions(): boolean
export function getValidationSummary(result: any): { totalRows: number; validRows: number; errors: any[] }
```

**Dependencies:** ZERO (pure functions)

---

### Step 5: Extract API Integration (1.5 hours)

**File:** `integration/detectionAPI.ts`

**Extract from analyzeFile():**
```typescript
export async function callDetectionAPI(fileContent: string): Promise<any>
export async function detectFormat(file: File, content: string): Promise<any>
```

**File:** `integration/previewAPI.ts`

**Extract methods:**
- callPreviewAPI(options)
- revalidateWithOptions()

**Functions to create:**
```typescript
export async function callPreviewAPI(data: any, options: any): Promise<any>
export async function revalidatePreview(options: any): Promise<void>
```

**File:** `integration/importAPI.ts`

**Extract from executeImport():**
```typescript
export async function executeImport(data: any): Promise<any>
export async function importCSVItems(file: File, mapping: any, options: any): Promise<any>
```

**Dependencies:** core/stateManager (for getState)

---

### Step 6: Extract Rendering Modules (3-4 hours)

**File:** `rendering/step1Upload.ts`

**Extract:** renderStep1()
```typescript
export function renderStep1Upload(container: HTMLElement, globalVarName: string): void
```

**File:** `rendering/step2Detection.ts`

**Extract:** renderStep2()
```typescript
export function renderStep2Detection(container: HTMLElement, detectionResult: any, globalVarName: string): void
```

**File:** `rendering/step3Mapping.ts`

**Extract:** renderStep3()
```typescript
export function renderStep3Mapping(container: HTMLElement, detectionResult: any, columnMapping: any, globalVarName: string): void
```

**File:** `rendering/step4Preview.ts`

**Extract:** renderStep4() + preview management
```typescript
export function renderStep4Preview(container: HTMLElement, validationResult: any, globalVarName: string): void
export function updatePreviewFilters(filterType: string, value: string): void
export function handlePaginationChange(page: number): void
```

**File:** `rendering/previewTable.ts`

**Extract methods:**
- renderPreviewTableHTML()
- getFilteredPaginatedRows()
- updatePreviewTable()

**Functions to create:**
```typescript
export function renderPreviewTable(rows: any[], pagination: any, filters: any): string
export function getFilteredRows(allRows: any[], filters: any): any[]
export function getPaginatedRows(rows: any[], page: number, perPage: number): any[]
export function updatePreviewDisplay(container: HTMLElement): void
```

**File:** `rendering/resultsSummary.ts`

**Extract methods:**
- renderPreviewResults()
- renderPreviewError()

**Functions to create:**
```typescript
export function renderValidationResults(result: any): string
export function renderErrorSummary(error: any): string
export function renderSuccessSummary(result: any): string
```

**Dependencies:** core/stateManager, utils/formatting, utils/statusHelpers

---

### Step 7: Extract Utilities (30 min)

**File:** `utils/formatting.ts`

**Extract methods:**
- escapeHtml(text)
- pluralize(count, one, few, many)
- getFieldLabel(field)

**Functions to create:**
```typescript
export function escapeHtml(text: string): string
export function pluralize(count: number, one: string, few: string, many: string): string
export function getFieldLabel(field: string): string
export function formatFileSize(bytes: number): string
```

**File:** `utils/statusHelpers.ts`

**Extract methods:**
- getStatusBadge(status)
- getRowValidationClass(status)

**Functions to create:**
```typescript
export function getStatusBadge(status: string): string
export function getValidationIcon(status: string): string
export function getStatusText(status: string): string
```

**File:** `utils/filterHelpers.ts`

**Extract methods:**
- getUniqueFilterValues(field)
- handleFilterChange()
- clearFilters()

**Functions to create:**
```typescript
export function getUniqueValues(rows: any[], field: string): string[]
export function applyFilters(rows: any[], filters: any): any[]
export function resetFilters(): void
```

**Dependencies:** ZERO (pure functions)

---

### Step 8: Create Barrel Export (15 min)

**File:** `index.ts`

**Export structure:**
```typescript
// ============================================================================
// Core State Management
// ============================================================================

export {
  initializeState,
  getState,
  updateState,
  resetState,
  getCurrentStep,
  setCurrentStep
} from './core/stateManager';

export type { ImportState, CSVState } from './core/ImportState';

// ============================================================================
// File Operations
// ============================================================================

export {
  handleFileSelect,
  readFileContent,
  encodeBase64,
  initializeWorker
} from './operations/fileProcessor';

// ============================================================================
// Detection & Mapping
// ============================================================================

export {
  detectDelimiter,
  autoMapColumns,
  analyzeFileContent
} from './operations/detection';

export {
  updateColumnMapping,
  validateMapping,
  getMappedColumns,
  resetMapping
} from './operations/mapper';

// ============================================================================
// Validation
// ============================================================================

export {
  hasReferenceErrors,
  hasDuplicateWarnings,
  getRowValidationClass,
  validateImportOptions,
  getValidationSummary
} from './operations/validator';

// ============================================================================
// API Integration
// ============================================================================

export {
  callDetectionAPI,
  detectFormat
} from './integration/detectionAPI';

export {
  callPreviewAPI,
  revalidatePreview
} from './integration/previewAPI';

export {
  executeImport,
  importCSVItems
} from './integration/importAPI';

// ============================================================================
// Rendering
// ============================================================================

export {
  renderStep1Upload
} from './rendering/step1Upload';

export {
  renderStep2Detection
} from './rendering/step2Detection';

export {
  renderStep3Mapping
} from './rendering/step3Mapping';

export {
  renderStep4Preview,
  updatePreviewFilters,
  handlePaginationChange
} from './rendering/step4Preview';

export {
  renderPreviewTable,
  getFilteredRows,
  getPaginatedRows,
  updatePreviewDisplay
} from './rendering/previewTable';

export {
  renderValidationResults,
  renderErrorSummary,
  renderSuccessSummary
} from './rendering/resultsSummary';

// ============================================================================
// Utilities
// ============================================================================

export {
  escapeHtml,
  pluralize,
  getFieldLabel,
  formatFileSize
} from './utils/formatting';

export {
  getStatusBadge,
  getValidationIcon,
  getStatusText
} from './utils/statusHelpers';

export {
  getUniqueValues,
  applyFilters,
  resetFilters
} from './utils/filterHelpers';
```

---

### Step 9: Update lists-bundle.ts (15 min)

**File:** `frontend/web/static/js/lists-bundle.ts`

**Current import (line 6):**
```typescript
import './lists/csvImporter.ts';
```

**Updated import:**
```typescript
// CSV Importer (modular structure as of v7.1.0)
import {
  initializeState as initializeCSVImporter,
  handleFileSelect,
  renderStep1Upload,
  renderStep2Detection,
  renderStep3Mapping,
  renderStep4Preview,
  executeImport
} from './lists/csvImporter/index';
```

**Window exports (if needed for onclick handlers):**
```typescript
// Add to windowExports:
const windowExports = {
  // ... existing exports ...

  // CSV Importer (v7.1.0 - modular)
  initializeCSVImporter,
  csvHandleFileSelect: handleFileSelect,
  csvRenderStep1: renderStep1Upload,
  csvRenderStep2: renderStep2Detection,
  csvRenderStep3: renderStep3Mapping,
  csvRenderStep4: renderStep4Preview,
  csvExecuteImport: executeImport,

  // ... rest of exports ...
};
```

**Note:** Actual window export needs depend on HTML onclick handler requirements. May need CSVImporter class wrapper for backward compatibility.

---

### Step 10: Build & Verify (30 min)

**Commands:**
```bash
# Type check
npm run type-check

# Build
npm run build

# Verify bundle size
ls -lh frontend/web/static/js/lists.min.js

# Check for circular dependencies
npx madge --circular --extensions ts frontend/web/static/js/lists/csvImporter
```

**Expected:**
- ✅ 0 TypeScript errors
- ✅ 0 circular dependencies
- ✅ Bundle size similar (± 5KB)
- ✅ All modules build successfully

---

## Backward Compatibility Strategy

**Option 1: Facade Class (Recommended)**

Keep CSVImporter class as facade in csvImporter.ts, delegate to modules:

```typescript
// csvImporter.ts (facade for backward compatibility)
import {
  initializeState,
  handleFileSelect,
  renderStep1Upload,
  // ... all exports
} from './csvImporter/index';

class CSVImporter {
  constructor(listsManager: any) {
    initializeState(listsManager);
  }

  async handleFileSelect(event: Event) {
    return handleFileSelect(event, (file, content) => {
      // Success callback
    });
  }

  renderStep1() {
    const container = document.getElementById('csv-import-wizard');
    if (container) {
      renderStep1Upload(container, this.globalVarName);
    }
  }

  // ... delegate all methods to module functions
}

window.csvImporter = new CSVImporter(window.listsManager);
```

**Option 2: Direct Module Export**

Remove CSVImporter class, expose module functions directly to window:

```typescript
// lists-bundle.ts
import * as csvImporter from './lists/csvImporter/index';

window.csvImporter = csvImporter;
```

**Recommendation:** Use Option 1 (facade) to minimize HTML changes.

---

## Risk Mitigation

**Risk 1: Breaking onclick handlers**
- **Mitigation:** Keep facade class, test all 5 steps in browser

**Risk 2: Worker initialization breaks**
- **Mitigation:** Extract initializeWorker early, test large file encoding

**Risk 3: State management bugs**
- **Mitigation:** Create stateManager.ts first, verify all state transitions

**Risk 4: Preview filters/pagination breaks**
- **Mitigation:** Extract filter helpers as pure functions, add unit tests

**Risk 5: Bundle size increases**
- **Mitigation:** Monitor bundle size, use tree-shaking, remove dead code

---

## Success Criteria

**Functional:**
- [ ] All 5 wizard steps render correctly
- [ ] File upload works (small + large files)
- [ ] Auto-detection works (client + server)
- [ ] Column mapping works
- [ ] Preview validation works
- [ ] Preview filters/pagination work
- [ ] Import execution works
- [ ] Worker encoding works for large files
- [ ] All toasts/error messages display correctly

**Code Quality:**
- [ ] 0 TypeScript errors
- [ ] 0 circular dependencies
- [ ] All modules < 300 lines
- [ ] core/ modules have ZERO dependencies
- [ ] Barrel export (index.ts) provides clean public API

**Build:**
- [ ] `npm run build` succeeds
- [ ] Bundle size ± 5KB from before
- [ ] Source maps generated correctly

**Documentation:**
- [ ] Update es-modules-migration.md (40% → 100%)
- [ ] Update ARCHITECTURE_REVIEW_TYPESCRIPT_MIGRATION.md
- [ ] Add JSDoc comments to all exported functions

---

## Implementation Order (Priority)

1. **HIGH PRIORITY (Core Functionality):**
   - Step 1: core/stateManager.ts
   - Step 2: operations/fileProcessor.ts
   - Step 5: integration/* (all 3 files)
   - Step 8: index.ts barrel export
   - Step 9: Update lists-bundle.ts

2. **MEDIUM PRIORITY (Rendering):**
   - Step 6: rendering/* (all 6 files)

3. **LOW PRIORITY (Utilities):**
   - Step 3: operations/detection.ts + mapper.ts
   - Step 4: operations/validator.ts
   - Step 7: utils/* (all 3 files)

4. **VERIFICATION:**
   - Step 10: Build & verify

---

## Timeline Estimate

| Step | Module | Time | Cumulative |
|------|--------|------|------------|
| 1 | core/stateManager.ts | 30m | 30m |
| 2 | operations/fileProcessor.ts | 45m | 1h 15m |
| 3 | operations/detection.ts + mapper.ts | 1h | 2h 15m |
| 4 | operations/validator.ts | 1h | 3h 15m |
| 5 | integration/* (3 files) | 1.5h | 4h 45m |
| 6 | rendering/* (6 files) | 4h | 8h 45m |
| 7 | utils/* (3 files) | 30m | 9h 15m |
| 8 | index.ts | 15m | 9h 30m |
| 9 | lists-bundle.ts | 15m | 9h 45m |
| 10 | Build & verify | 30m | 10h 15m |
| | **Buffer (unexpected issues)** | 2h | **12h 15m** |

**Total Estimate:** 10-12 hours (~2 working days)

---

## Next Steps

1. Read csvImporter.ts in detail (focus on key methods)
2. Start with Step 1 (core/stateManager.ts)
3. Proceed methodically through Steps 2-10
4. Test each module incrementally
5. Final browser testing of all 5 wizard steps

---

**Version:** v7.1.0 Phase 3 Migration Plan
**Date:** 2026-01-11
**Author:** Claude Sonnet 4.5 (via Claude Code)
