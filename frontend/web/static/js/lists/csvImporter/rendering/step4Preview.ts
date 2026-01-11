/**
 * CSV Importer - Step 4 Preview Rendering
 *
 * Renders Step 4 loading state and coordinates preview API call.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 693-736
 */

import { getContainer, getGlobalVarName, setCurrentStep } from '../core/stateManager';
import { getStep1OnClick } from '../utils/navigationHelpers';
import { callPreviewAPI } from '../integration/previewAPI';
import { renderPreviewResults, renderPreviewError } from './resultsSummary';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Step 4: Preview & Validation UI
// ============================================================================

/**
 * Render Step 4: Preview & validation
 * Shows loading state, calls preview API, then renders results or error.
 */
export async function renderStep4(): Promise<void> {
  setCurrentStep(4);

  const step1OnClick = getStep1OnClick();
  const varName = getGlobalVarName();
  const container = getContainer();

  if (!container) return;

  // Show loading state
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

      <div class="flex justify-center items-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <span class="ml-4 text-lg">Валидация данных...</span>
      </div>
    </div>
  `;

  try {
    // Call preview API for validation
    await callPreviewAPI();

    // Render preview with validation results
    renderPreviewResults();

  } catch (error: any) {
    console.error('[CSVImporter] Error in preview:', error);
    renderPreviewError(error.message);
  }

  debugLog('[CSVImporter] Rendered step 4');
}
