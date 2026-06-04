/**
 * Import Manager Module
 *
 * Coordinates CSV and Google Sheets import methods.
 * Step 1: Method selection (CSV or Google Sheets)
 * Steps 2+: Delegates to CSVImporter or GoogleSheetsImporter
 */

class ImportManager {
    constructor(listsManager) {
        this.listsManager = listsManager;
        this.csvImporter = null;  // Will be initialized when CSV method selected
        this.googleSheetsImporter = null;  // Will be initialized when Google Sheets selected
        this.currentMethod = null;  // 'csv' | 'google-sheets'
        this.container = null;
    }

    /**
     * Initialize import manager
     */
    init() {
        this.container = document.getElementById('import-wizard');
        if (!this.container) {
            console.error('[ImportManager] Container #import-wizard not found');
            return;
        }

        this.renderMethodSelection();
        debugLog('[ImportManager] Initialized');
    }

    /**
     * Render method selection (Step 1)
     */
    renderMethodSelection() {
        this.currentMethod = null;

        this.container.innerHTML = `
            <div class="import-method-selection">
                <h3 class="font-bold text-lg mb-4">Выберите способ импорта:</h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- CSV Method Card -->
                    <div class="card bg-base-200 shadow-md hover:shadow-lg transition cursor-pointer"
                         onclick="window.importManager.selectMethod('csv')">
                        <div class="card-body items-center text-center">
                            <div class="text-5xl mb-2">📄</div>
                            <h4 class="card-title">CSV файл</h4>
                            <p class="text-sm text-base-content/70">
                                Загрузите CSV файл с вашего компьютера
                            </p>
                            <div class="card-actions mt-4">
                                <button class="btn btn-primary btn-sm">
                                    Выбрать CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Google Sheets Method Card -->
                    <div class="card bg-base-200 shadow-md hover:shadow-lg transition cursor-pointer"
                         onclick="window.importManager.selectMethod('google-sheets')">
                        <div class="card-body items-center text-center">
                            <div class="text-5xl mb-2">📊</div>
                            <h4 class="card-title">Google Sheets</h4>
                            <p class="text-sm text-base-content/70">
                                Укажите ссылку на публичную таблицу
                            </p>
                            <div class="card-actions mt-4">
                                <button class="btn btn-success btn-sm">
                                    Использовать Google Sheets
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-6">
                    <h4 class="font-bold mb-2">Общие требования к данным:</h4>
                    <ul class="list-disc list-inside text-sm text-base-content/70 space-y-1">
                        <li><strong>Обязательные колонки:</strong> Магазин, Группа товаров, Товар</li>
                        <li><strong>Опциональные:</strong> Количество, Единица измерения, Комментарий</li>
                        <li><strong>Формат:</strong> Первая строка должна содержать заголовки колонок</li>
                    </ul>
                </div>

                <div class="mt-4">
                    <details class="collapse collapse-arrow bg-base-100">
                        <summary class="collapse-title text-sm font-medium">
                            📋 Пример формата данных
                        </summary>
                        <div class="collapse-content">
                            <div class="overflow-x-auto">
                                <table class="table table-xs">
                                    <thead>
                                        <tr>
                                            <th>Магазин</th>
                                            <th>Группа товаров</th>
                                            <th>Товар</th>
                                            <th>Количество</th>
                                            <th>Единица</th>
                                            <th>Комментарий</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Пятёрочка</td>
                                            <td>Молочные</td>
                                            <td>Молоко 3.2%</td>
                                            <td>2</td>
                                            <td>шт</td>
                                            <td>В красной упаковке</td>
                                        </tr>
                                        <tr>
                                            <td>Пятёрочка</td>
                                            <td>Хлеб</td>
                                            <td>Батон белый</td>
                                            <td>1</td>
                                            <td>шт</td>
                                            <td></td>
                                        </tr>
                                        <tr>
                                            <td>Магнит</td>
                                            <td>Овощи</td>
                                            <td>Картофель</td>
                                            <td>5</td>
                                            <td>кг</td>
                                            <td>Для супа</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        `;

        debugLog('[ImportManager] Rendered method selection');
    }

    /**
     * Select import method
     * @param {string} method - 'csv' or 'google-sheets'
     */
    selectMethod(method) {
        this.currentMethod = method;
        debugLog('[ImportManager] Selected method:', method);

        if (method === 'csv') {
            // Initialize CSV importer if not already
            if (!this.csvImporter && typeof CSVImporter !== 'undefined') {
                this.csvImporter = new CSVImporter(this.listsManager);
                // Expose globally for onclick handlers in rendered HTML
                window.csvImporter = this.csvImporter;
            }

            if (this.csvImporter) {
                // Delegate to CSV importer
                this.csvImporter.container = this.container;
                this.csvImporter.renderStep1();
            } else {
                console.error('[ImportManager] CSVImporter not loaded');
                showToast('Ошибка: CSV импортер не загружен', 'error');
                this.renderMethodSelection();
            }

        } else if (method === 'google-sheets') {
            // Initialize Google Sheets importer if not already
            if (!this.googleSheetsImporter && typeof GoogleSheetsImporter !== 'undefined') {
                this.googleSheetsImporter = new GoogleSheetsImporter(this.listsManager);
                // Expose globally for onsubmit handlers in rendered HTML
                window.googleSheetsImporter = this.googleSheetsImporter;
            }

            if (this.googleSheetsImporter) {
                // Delegate to Google Sheets importer
                // Use init() so fetchSavedGoogleSheetsUrl() runs on every open
                this.googleSheetsImporter.container = this.container;
                this.googleSheetsImporter.init().catch(e => console.error('[ImportManager] GoogleSheetsImporter init error:', e));
            } else {
                console.error('[ImportManager] GoogleSheetsImporter not loaded');
                showToast('Ошибка: Google Sheets импортер не загружен', 'error');
                this.renderMethodSelection();
            }

        } else {
            console.error('[ImportManager] Unknown method:', method);
            this.renderMethodSelection();
        }
    }

    /**
     * Reset to method selection
     */
    reset() {
        this.renderMethodSelection();
        debugLog('[ImportManager] Reset to method selection');
    }
}

// Make available globally
window.ImportManager = ImportManager;

debugLog('[ImportManager] Module loaded');
