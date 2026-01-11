/**
 * CSV Importer - Step 3 Column Mapping Rendering
 *
 * Renders column mapping UI with dropdowns for each CSV column.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 550-633
 */

import {
  getContainer,
  getGlobalVarName,
  getDetectionResult,
  setCurrentStep,
  setColumnMapping,
  getColumnMapping
} from '../core/stateManager';
import { escapeHtml } from '../utils/formatting';
import { getStep1OnClick } from '../utils/navigationHelpers';
import { validateMapping } from '../operations/mapper';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Step 3: Column Mapping UI
// ============================================================================

/**
 * Render Step 3: Column mapping interface
 * Shows dropdowns to map CSV columns to system fields.
 */
export function renderStep3(): void {
  setCurrentStep(3);

  const result = getDetectionResult();
  const step1OnClick = getStep1OnClick();
  const varName = getGlobalVarName();
  const container = getContainer();

  if (!container || !result) return;

  // Initialize column mapping from auto-mapping (already in result from detectionAPI)
  const autoMapping = getColumnMapping();
  if (Object.keys(autoMapping).length === 0 && result.headers) {
    // If no mapping yet, use auto-detected mapping from detection result
    // NOTE: DetectionResult doesn't have auto_mapping, so we'll init empty mapping
    const emptyMapping: Record<string, string> = {};
    result.headers.forEach(col => {
      emptyMapping[col] = '';
    });
    setColumnMapping(emptyMapping);
  }

  const fieldOptions = [
    { value: '', label: '-- Не использовать --' },
    { value: 'store', label: '🏪 Магазин (обязательно)' },
    { value: 'product_group', label: '📦 Группа товаров (обязательно)' },
    { value: 'product_name', label: '🛒 Товар (обязательно)' },
    { value: 'quantity', label: '📊 Количество' },
    { value: 'unit', label: '📏 Единица измерения' },
    { value: 'comment', label: '💬 Комментарий' }
  ];

  const currentMapping = getColumnMapping();

  container.innerHTML = `
    <div class="csv-wizard-step">
      <div class="mb-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li><a onclick="${step1OnClick}">Шаг 1: Загрузка файла</a></li>
            <li><a onclick="window.${varName}.renderStep2()">Шаг 2: Определение формата</a></li>
            <li class="font-bold">Шаг 3: Сопоставление колонок</li>
            <li class="opacity-50">Шаг 4: Предпросмотр</li>
            <li class="opacity-50">Шаг 5: Импорт</li>
          </ul>
        </div>
      </div>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Укажите соответствие между колонками CSV и полями системы</span>
      </div>

      <div class="space-y-4 mb-6">
        ${result.headers.map((column: string) => `
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">
                CSV колонка: <span class="badge badge-ghost">${escapeHtml(column)}</span>
              </span>
            </label>
            <select class="select select-bordered"
                    data-column="${escapeHtml(column)}"
                    onchange="window.${varName}.updateMapping('${escapeHtml(column)}', this.value)">
              ${fieldOptions.map(opt => `
                <option value="${opt.value}"
                        ${currentMapping[column] === opt.value ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
          </div>
        `).join('')}
      </div>

      <div id="mapping-validation" class="mb-4"></div>

      <div class="flex gap-2">
        <button class="btn btn-outline" onclick="window.${varName}.renderStep2()">
          ← Назад
        </button>
        <button class="btn btn-primary" onclick="window.${varName}.validateAndContinue()">
          Далее: Предпросмотр →
        </button>
      </div>
    </div>
  `;

  // Validate mapping on load
  validateMapping();

  debugLog('[CSVImporter] Rendered step 3');
}
