/**
 * CSV Importer - Step 1 Upload Rendering
 *
 * Renders file upload UI with drag & drop, format requirements, and example.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 223-284
 */

import { getContainer, getGlobalVarName, setCurrentStep } from '../core/stateManager';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Step 1: File Upload UI
// ============================================================================

/**
 * Render Step 1: File upload interface
 * Shows drag & drop zone, format requirements, and CSV example.
 */
export function renderStep1(): void {
  setCurrentStep(1);

  const varName = getGlobalVarName();
  const container = getContainer();

  if (!container) return;

  container.innerHTML = `
    <div class="csv-wizard-step">
      <div class="mb-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li class="font-bold">Шаг 1: Загрузка файла</li>
            <li class="opacity-50">Шаг 2: Определение формата</li>
            <li class="opacity-50">Шаг 3: Сопоставление колонок</li>
            <li class="opacity-50">Шаг 4: Предпросмотр</li>
            <li class="opacity-50">Шаг 5: Импорт</li>
          </ul>
        </div>
      </div>

      <div class="border-2 border-dashed border-base-300 rounded-lg p-8 text-center">
        <input type="file"
               id="csv-file-input"
               accept=".csv"
               class="hidden"
               onchange="window.${varName}.handleFileSelect(event)">

        <label for="csv-file-input" class="cursor-pointer">
          <div class="text-6xl mb-4">📄</div>
          <h3 class="text-xl font-bold mb-2">Выберите CSV файл</h3>
          <p class="text-base-content/70 mb-4">
            Нажмите или перетащите файл сюда
          </p>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('csv-file-input').click()">
            📁 Выбрать файл
          </button>
        </label>
      </div>

      <div class="mt-6">
        <h4 class="font-bold mb-2">Требования к формату:</h4>
        <ul class="list-disc list-inside text-sm text-base-content/70 space-y-1">
          <li>Формат: CSV (разделитель: запятая, точка с запятой, табуляция)</li>
          <li>Обязательные колонки: Магазин, Группа товаров, Товар</li>
          <li>Опциональные: Количество, Единица, Комментарий</li>
          <li>Кодировка: UTF-8, Windows-1251, или auto-detect</li>
        </ul>
      </div>

      <div class="mt-6">
        <h4 class="font-bold mb-2">Пример CSV:</h4>
        <pre class="bg-base-200 p-4 rounded-lg text-sm overflow-x-auto"><code>Магазин;Группа;Товар;Количество;Единица;Комментарий
Пятёрочка;Молочные;Молоко 3.2%;2;шт;В красной упаковке
Пятёрочка;Хлеб;Батон белый;1;шт;
Магнит;Овощи;Картофель;5;кг;Для супа</code></pre>
      </div>
    </div>
  `;

  debugLog('[CSVImporter] Rendered step 1');
}
