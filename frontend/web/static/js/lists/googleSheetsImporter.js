/**
 * Google Sheets Importer Module
 *
 * Multi-step wizard for Google Sheets import:
 * Step 1: Enter Google Sheets URL (custom)
 * Steps 2-5: Reuse CSVImporter logic (analysis, mapping, preview, execute)
 *
 * Strategy: Fetch Google Sheets as CSV, then delegate to CSVImporter
 */

class GoogleSheetsImporter {
    constructor(listsManager) {
        this.listsManager = listsManager;
        this.currentStep = 1;
        this.totalSteps = 5;

        // Google Sheets data
        this.googleSheetsUrl = null;
        this.spreadsheetId = null;
        this.sheetGid = null;

        // Saved URL data
        this.savedUrl = null;
        this.hasSavedUrl = false;
        this.shouldSaveUrl = true;  // Default: save URL after successful import

        // CSV data (after fetch)
        this.fileContent = null;  // Base64 CSV from backend

        // CSV Importer for Steps 2-5
        this.csvImporter = null;

        // Container
        this.container = null;
    }

    /**
     * Initialize Google Sheets importer
     */
    async init() {
        // Container should be set by ImportManager
        if (!this.container) {
            this.container = document.getElementById('import-wizard');
        }

        if (!this.container) {
            console.error('[GoogleSheetsImporter] Container not found');
            return;
        }

        // Load saved URL from backend
        await this.fetchSavedGoogleSheetsUrl();

        this.renderStep1();
        debugLog('[GoogleSheetsImporter] Initialized');
    }

    /**
     * Fetch saved Google Sheets URL from backend
     */
    async fetchSavedGoogleSheetsUrl() {
        try {
            const listId = this.listsManager.currentListId;
            if (!listId) {
                debugLog('[GoogleSheetsImporter] No currentListId, skipping URL fetch');
                return;
            }
            const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                debugLog('[GoogleSheetsImporter] Failed to fetch saved URL:', response.status);
                return;
            }

            const data = await response.json();
            this.savedUrl = data.google_sheets_url;
            this.hasSavedUrl = data.has_saved_url;

            debugLog('[GoogleSheetsImporter] Fetched saved URL:', {
                hasSavedUrl: this.hasSavedUrl,
                url: this.savedUrl ? this.savedUrl.substring(0, 50) + '...' : null
            });
        } catch (error) {
            console.error('[GoogleSheetsImporter] Error fetching saved URL:', error);
        }
    }

    /**
     * Save Google Sheets URL to backend
     * @param {string|null} url - URL to save (null to clear)
     */
    async saveGoogleSheetsUrl(url) {
        try {
            const listId = this.listsManager.currentListId;
            if (!listId) {
                debugLog('[GoogleSheetsImporter] No currentListId, cannot save URL');
                return false;
            }
            const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    google_sheets_url: url
                })
            });

            if (!response.ok) {
                const error = await response.json();
                // Handle Pydantic validation errors (detail is array of objects)
                let errorMessage;
                if (Array.isArray(error.detail)) {
                    errorMessage = error.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
                } else if (typeof error.detail === 'string') {
                    errorMessage = error.detail;
                } else if (error.detail) {
                    errorMessage = JSON.stringify(error.detail);
                } else {
                    errorMessage = `HTTP ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            this.savedUrl = data.google_sheets_url;
            this.hasSavedUrl = data.has_saved_url;

            debugLog('[GoogleSheetsImporter] Saved URL:', {
                hasSavedUrl: this.hasSavedUrl,
                url: this.savedUrl ? this.savedUrl.substring(0, 50) + '...' : null
            });

            return true;
        } catch (error) {
            console.error('[GoogleSheetsImporter] Error saving URL:', error);
            return false;
        }
    }

    /**
     * Clear saved URL
     */
    async clearSavedUrl() {
        const success = await this.saveGoogleSheetsUrl(null);
        if (success) {
            showToast('Сохранённая ссылка удалена', 'success');
            this.renderStep1();
        } else {
            showToast('Ошибка при удалении ссылки', 'error');
        }
    }

    /**
     * Handle save URL checkbox change
     * @param {Event} event - Change event
     */
    handleSaveUrlCheckboxChange(event) {
        this.shouldSaveUrl = event.target.checked;
        debugLog('[GoogleSheetsImporter] Save URL checkbox:', this.shouldSaveUrl);
    }

    /**
     * Step 1: Enter Google Sheets URL
     */
    renderStep1() {
        this.currentStep = 1;

        // Build saved URL alert HTML
        const savedUrlAlert = this.hasSavedUrl ? `
            <div class="alert alert-success mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                    <p class="font-bold">Найдена сохранённая ссылка</p>
                    <p class="text-sm opacity-80 truncate max-w-md">${this.escapeHtml(this.savedUrl)}</p>
                </div>
                <button type="button"
                        class="btn btn-sm btn-ghost"
                        onclick="window.googleSheetsImporter.clearSavedUrl().catch(e => console.error('[GoogleSheetsImporter] Clear URL error:', e))"
                        title="Удалить сохранённую ссылку">
                    ✕
                </button>
            </div>
        ` : '';

        // Build save URL checkbox HTML
        const saveUrlCheckbox = `
            <div class="form-control mb-4">
                <label class="label cursor-pointer justify-start gap-3">
                    <input type="checkbox"
                           id="save-url-checkbox"
                           class="checkbox checkbox-primary checkbox-sm"
                           ${this.shouldSaveUrl ? 'checked' : ''}
                           onchange="window.googleSheetsImporter.handleSaveUrlCheckboxChange(event)">
                    <span class="label-text">Сохранить ссылку для будущего использования</span>
                </label>
            </div>
        `;

        this.container.innerHTML = `
            <div class="google-sheets-wizard-step">
                <div class="mb-4">
                    <div class="text-sm breadcrumbs">
                        <ul>
                            <li class="font-bold">Шаг 1: Ввод ссылки</li>
                            <li class="opacity-50">Шаг 2: Анализ данных</li>
                            <li class="opacity-50">Шаг 3: Сопоставление колонок</li>
                            <li class="opacity-50">Шаг 4: Предпросмотр</li>
                            <li class="opacity-50">Шаг 5: Импорт</li>
                        </ul>
                    </div>
                </div>

                ${savedUrlAlert}

                <div class="alert alert-info mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p class="font-bold">Важно!</p>
                        <p class="text-sm">Google Sheets должна быть публичной: <strong>"Доступ по ссылке → Просмотр для всех"</strong></p>
                    </div>
                </div>

                <form onsubmit="window.googleSheetsImporter.handleUrlSubmit(event)">
                    <div class="form-control mb-4">
                        <label class="label">
                            <span class="label-text font-medium">Ссылка на Google Sheets</span>
                        </label>
                        <input type="url"
                               id="google-sheets-url-input"
                               class="input input-bordered w-full"
                               placeholder="https://docs.google.com/spreadsheets/d/1ABC.../edit#gid=0"
                               value="${this.hasSavedUrl ? this.escapeHtml(this.savedUrl) : ''}"
                               required
                               pattern=".*docs\\.google\\.com/spreadsheets.*">
                        <label class="label">
                            <span class="label-text-alt">Вставьте ссылку из адресной строки браузера</span>
                        </label>
                    </div>

                    ${saveUrlCheckbox}

                    <div class="flex gap-2">
                        <button type="button"
                                class="btn btn-ghost"
                                onclick="window.importManager.reset()">
                            ← Назад к выбору метода
                        </button>
                        <button type="submit" class="btn btn-primary">
                            🔍 Загрузить данные
                        </button>
                    </div>
                </form>

                <div class="mt-6 space-y-4">
                    <details class="collapse collapse-arrow bg-base-200">
                        <summary class="collapse-title font-medium">
                            📖 Как получить ссылку
                        </summary>
                        <div class="collapse-content">
                            <ol class="list-decimal list-inside space-y-2 text-sm">
                                <li>Откройте Google Sheets в браузере</li>
                                <li>Нажмите кнопку <strong>"Настройки доступа"</strong> (в правом верхнем углу)</li>
                                <li>Выберите <strong>"Доступ по ссылке"</strong></li>
                                <li>Установите <strong>"Просмотр для всех, у кого есть ссылка"</strong></li>
                                <li>Нажмите <strong>"Готово"</strong></li>
                                <li>Скопируйте ссылку из адресной строки браузера</li>
                            </ol>
                        </div>
                    </details>

                    <details class="collapse collapse-arrow bg-base-200">
                        <summary class="collapse-title font-medium">
                            📋 Формат данных
                        </summary>
                        <div class="collapse-content">
                            <ul class="list-disc list-inside space-y-2 text-sm">
                                <li><strong>Первая строка</strong> - заголовки колонок</li>
                                <li><strong>Обязательные колонки:</strong> Магазин, Группа товаров, Товар</li>
                                <li><strong>Опциональные:</strong> Количество, Единица, Комментарий</li>
                                <li>Лист автоматически определяется из URL (параметр #gid)</li>
                                <li>Если #gid не указан - будет использован первый лист</li>
                            </ul>
                        </div>
                    </details>

                    <details class="collapse collapse-arrow bg-base-200">
                        <summary class="collapse-title font-medium">
                            🛠️ Устранение неполадок
                        </summary>
                        <div class="collapse-content">
                            <ul class="list-disc list-inside space-y-2 text-sm">
                                <li><strong>"Таблица не публична"</strong> → Проверьте настройки доступа (шаг 2-4 выше)</li>
                                <li><strong>"Таблица не найдена"</strong> → Проверьте правильность ссылки</li>
                                <li><strong>"Неверный формат ссылки"</strong> → Используйте ссылку из адресной строки браузера</li>
                                <li><strong>Нужен конкретный лист?</strong> → Откройте этот лист и скопируйте URL с #gid=...</li>
                            </ul>
                        </div>
                    </details>
                </div>
            </div>
        `;

        debugLog('[GoogleSheetsImporter] Rendered step 1');
    }

    /**
     * Handle URL submit
     * @param {Event} event - Form submit event
     */
    async handleUrlSubmit(event) {
        event.preventDefault();

        const urlInput = document.getElementById('google-sheets-url-input');
        this.googleSheetsUrl = urlInput.value.trim();

        if (!this.googleSheetsUrl) {
            showToast('Введите ссылку на Google Sheets', 'error');
            return;
        }

        // Basic validation
        if (!this.googleSheetsUrl.includes('docs.google.com/spreadsheets')) {
            showToast('Неверный формат ссылки. Используйте ссылку на Google Sheets', 'error');
            return;
        }

        try {
            // Show loading
            showToast('Загрузка данных из Google Sheets...', 'info');

            debugLog('[GoogleSheetsImporter] Fetching Google Sheets:', this.googleSheetsUrl);

            // Fetch Google Sheets as CSV via backend
            const response = await fetch('/api/v1/shopping-lists/google-sheets/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    google_sheets_url: this.googleSheetsUrl
                })
            });

            if (!response.ok) {
                const error = await response.json();
                // Handle Pydantic validation errors (detail is array of objects)
                let errorMessage;
                if (Array.isArray(error.detail)) {
                    // Extract messages from Pydantic validation errors
                    errorMessage = error.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
                } else if (typeof error.detail === 'string') {
                    errorMessage = error.detail;
                } else if (error.detail) {
                    errorMessage = JSON.stringify(error.detail);
                } else {
                    errorMessage = `HTTP ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            const fetchResult = await response.json();
            this.fileContent = fetchResult.file_content;
            this.spreadsheetId = fetchResult.spreadsheet_id;
            this.sheetGid = fetchResult.sheet_gid;

            debugLog('[GoogleSheetsImporter] Fetched successfully:', {
                spreadsheetId: this.spreadsheetId,
                sheetGid: this.sheetGid,
                size: this.fileContent.length
            });

            // Save URL if checkbox is checked
            if (this.shouldSaveUrl) {
                const saved = await this.saveGoogleSheetsUrl(this.googleSheetsUrl);
                if (saved) {
                    showToast('✅ Данные загружены, ссылка сохранена', 'success');
                } else {
                    showToast('✅ Данные загружены (ссылка не сохранена)', 'warning');
                }
            } else {
                showToast('✅ Данные загружены из Google Sheets', 'success');
            }

            // Now delegate to CSVImporter for Steps 2-5
            this.delegateToCSVImporter();

        } catch (error) {
            console.error('[GoogleSheetsImporter] Error fetching Google Sheets:', error);

            // Check if this is an access/authorization issue (user action required)
            const message = error.message.toLowerCase();
            const isAccessIssue = message.includes('авторизац') ||
                                  message.includes('публичн') ||
                                  message.includes('доступ') ||
                                  message.includes('401') ||
                                  message.includes('403');

            if (isAccessIssue) {
                showToast(`⚠️ ${error.message}`, 'warning');
            } else {
                showToast(`❌ Ошибка загрузки: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Delegate to CSVImporter for Steps 2-5
     * Strategy: Create CSVImporter instance and pass our CSV data
     */
    async delegateToCSVImporter() {
        // Initialize CSV importer if not already
        if (!this.csvImporter) {
            if (typeof CSVImporter === 'undefined') {
                console.error('[GoogleSheetsImporter] CSVImporter not loaded');
                showToast('Ошибка: CSV импортер не загружен', 'error');
                return;
            }

            this.csvImporter = new CSVImporter(this.listsManager);
            // Expose globally for onclick handlers in rendered HTML
            window.csvImporter = this.csvImporter;

            // Set custom navigation: clicking "Step 1" should return to Google Sheets URL input
            this.csvImporter.onBackToStep1 = 'window.googleSheetsImporter.renderStep1()';
        }

        // Decode base64 content from Google Sheets API to raw CSV text
        // The API returns base64-encoded CSV, but CSVImporter expects raw text
        try {
            const rawCsvText = decodeURIComponent(escape(atob(this.fileContent)));
            this.csvImporter.fileContent = rawCsvText;
        } catch (e) {
            console.error('[GoogleSheetsImporter] Error decoding base64:', e);
            showToast('Ошибка декодирования данных', 'error');
            return;
        }

        this.csvImporter.container = this.container;

        // Start CSV import workflow from Step 2 (analysis)
        // analyzeFile() will encode to base64 for API and then render step 2
        try {
            await this.csvImporter.analyzeFile();
            this.csvImporter.renderStep2();
        } catch (error) {
            console.error('[GoogleSheetsImporter] Error analyzing CSV:', error);
            showToast(`Ошибка анализа: ${error.message}`, 'error');
        }

        debugLog('[GoogleSheetsImporter] Delegated to CSVImporter');
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make available globally
window.GoogleSheetsImporter = GoogleSheetsImporter;

debugLog('[GoogleSheetsImporter] Module loaded');
