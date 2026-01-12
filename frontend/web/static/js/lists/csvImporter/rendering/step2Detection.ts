/**
 * CSV Importer - Step 2 Detection Results Rendering
 *
 * Renders auto-detection results: delimiter, encoding, detected columns, sample data.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 463-545
 */

import { getContainer, getGlobalVarName, getDetectionResult, setCurrentStep } from '../core/stateManager';
import { escapeHtml } from '../utils/formatting';
import { getStep1OnClick } from '../utils/navigationHelpers';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Step 2: Detection Results UI
// ============================================================================

/**
 * Render Step 2: Detection results
 * Shows detected delimiter, encoding, columns, and sample rows.
 */
export function renderStep2(): void {
  setCurrentStep(2);

  const result = getDetectionResult();
  const step1OnClick = getStep1OnClick();
  const varName = getGlobalVarName();
  const container = getContainer();

  if (!container || !result) return;

  container.innerHTML = `
    <div class="csv-wizard-step">
      <div class="mb-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li><a onclick="${step1OnClick}">Шаг 1: Загрузка файла</a></li>
            <li class="font-bold">Шаг 2: Определение формата</li>
            <li class="opacity-50">Шаг 3: Сопоставление колонок</li>
            <li class="opacity-50">Шаг 4: Предпросмотр</li>
            <li class="opacity-50">Шаг 5: Импорт</li>
          </ul>
        </div>
      </div>

      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Файл успешно проанализирован! Обнаружено ${result.rowCount} строк.</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="stat bg-base-200 rounded-lg">
          <div class="stat-title">Разделитель</div>
          <div class="stat-value text-2xl">${escapeHtml(result.delimiter === '\t' ? 'Табуляция' : result.delimiter)}</div>
        </div>
        <div class="stat bg-base-200 rounded-lg">
          <div class="stat-title">Кодировка</div>
          <div class="stat-value text-2xl">${escapeHtml(result.encoding || 'utf-8')}</div>
        </div>
      </div>

      <div class="mb-6">
        <h4 class="font-bold mb-2">Обнаруженные колонки (${result.headers.length}):</h4>
        <div class="flex flex-wrap gap-2">
          ${result.headers.map((col: string) => `
            <div class="badge badge-lg badge-primary">${escapeHtml(col)}</div>
          `).join('')}
        </div>
      </div>

      <div class="mb-6">
        <h4 class="font-bold mb-2">Предпросмотр данных (первые 5 строк):</h4>
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                ${result.headers.map((col: string) => `<th>${escapeHtml(col)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${result.sampleRows.slice(0, 5).map((row: string[]) => `
                <tr>
                  ${row.map((cell: string) => `<td>${escapeHtml(cell || '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="${step1OnClick}">
          ← Назад
        </button>
        <button class="btn btn-primary" onclick="window.${varName}.renderStep3()">
          Далее: Сопоставление колонок →
        </button>
      </div>
    </div>
  `;

  debugLog('[CSVImporter] Rendered step 2');
}
