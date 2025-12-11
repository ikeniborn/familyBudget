/**
 * CSV Importer Module
 *
 * Multi-step wizard for CSV import:
 * Step 1: Upload file
 * Step 2: Auto-detection results
 * Step 3: Column mapping
 * Step 4: Preview & validation
 * Step 5: Execute import
 *
 * Stage 7: CSV Import
 */

class CSVImporter {
    constructor(listsManager) {
        this.listsManager = listsManager;
        this.currentStep = 1;
        this.totalSteps = 5;

        // File data
        this.file = null;
        this.fileContent = null;

        // Detection results
        this.detectionResult = null;

        // Column mapping
        this.columnMapping = {};

        // Validation results
        this.validationResult = null;

        // Container
        this.container = document.getElementById('csv-import-wizard');

        // Custom navigation callbacks (used when delegated from GoogleSheetsImporter)
        // If set, clicking "Step 1" in breadcrumbs will call this instead of renderStep1()
        this.onBackToStep1 = null;
        // Global variable name to use for onclick handlers (default: 'csvImporter')
        this.globalVarName = 'csvImporter';
    }

    /**
     * Get onclick handler for step 1 navigation
     * Returns custom callback if set, otherwise default renderStep1
     */
    getStep1OnClick() {
        if (this.onBackToStep1) {
            return this.onBackToStep1;
        }
        return `window.${this.globalVarName}.renderStep1()`;
    }

    /**
     * Get onclick handler for any step navigation
     * @param {number} step - Step number (1-5)
     */
    getStepOnClick(step) {
        if (step === 1) {
            return this.getStep1OnClick();
        }
        return `window.${this.globalVarName}.renderStep${step}()`;
    }

    /**
     * Initialize CSV importer
     */
    init() {
        if (!this.container) {
            console.error('[CSVImporter] Container not found');
            return;
        }

        this.renderStep1();
    }

    /**
     * Step 1: Upload file
     */
    renderStep1() {
        this.currentStep = 1;

        const varName = this.globalVarName;

        this.container.innerHTML = `
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

    /**
     * Handle file select
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            showToast('Пожалуйста, выберите CSV файл', 'error');
            return;
        }

        this.file = file;

        try {
            // Read file content
            this.fileContent = await this.readFileContent(file);

            // Show loading
            showToast('Анализ файла...', 'info');

            // Analyze file (auto-detection)
            await this.analyzeFile();

            // Move to step 2
            this.renderStep2();
        } catch (error) {
            console.error('[CSVImporter] Error reading file:', error);
            showToast('Ошибка чтения файла', 'error');
        }
    }

    /**
     * Read file content as text
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Analyze CSV file (auto-detection)
     */
    async analyzeFile() {
        try {
            // Encode file content to base64
            const fileContent = btoa(unescape(encodeURIComponent(this.fileContent)));

            // Call backend API for auto-detection
            const response = await fetch('/api/v1/shopping-lists/import/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_content: fileContent
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to analyze CSV file');
            }

            this.detectionResult = await response.json();
            debugLog('[CSVImporter] Detection result:', this.detectionResult);

        } catch (error) {
            console.error('[CSVImporter] Error analyzing file:', error);

            // Fallback to client-side detection if API fails
            debugLog('[CSVImporter] Falling back to client-side detection');

            const lines = this.fileContent.split('\n').filter(l => l.trim());
            if (lines.length === 0) {
                throw new Error('Empty file');
            }

            // Detect delimiter
            const delimiter = this.detectDelimiter(lines[0]);

            // Parse first row (header)
            const header = lines[0].split(delimiter).map(col => col.trim());

            // Parse sample rows
            const sampleRows = lines.slice(1, 11).map(line => {
                const values = line.split(delimiter).map(v => v.trim());
                return Object.fromEntries(header.map((h, i) => [h, values[i] || '']));
            });

            // Auto-map columns (simplified)
            const autoMapping = this.autoMapColumns(header);

            this.detectionResult = {
                delimiter,
                encoding: 'utf-8',
                has_header: true,
                detected_columns: header,
                auto_mapping: autoMapping,
                sample_rows: sampleRows,
                total_rows: lines.length - 1,
                confidence: 0.7
            };

            debugLog('[CSVImporter] Client-side detection result:', this.detectionResult);
        }
    }

    /**
     * Detect CSV delimiter
     */
    detectDelimiter(firstLine) {
        const delimiters = [';', ',', '\t', '|'];
        let maxCount = 0;
        let bestDelimiter = ';';

        for (const delimiter of delimiters) {
            const count = firstLine.split(delimiter).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delimiter;
            }
        }

        return bestDelimiter;
    }

    /**
     * Auto-map columns to expected fields
     */
    autoMapColumns(columns) {
        const mapping = {};
        const synonyms = {
            'store': ['магазин', 'store', 'shop', 'место'],
            'product_group': ['группа', 'category', 'категория', 'group', 'продуктовая группа'],
            'product_name': ['товар', 'product', 'название', 'name', 'продукт', 'наименование'],
            'quantity': ['количество', 'qty', 'кол-во', 'count'],
            'unit': ['единица', 'unit', 'ед', 'мера'],
            'comment': ['комментарий', 'comment', 'note', 'примечание']
        };

        for (const column of columns) {
            const normalizedCol = column.toLowerCase().trim();

            // Try to match with synonyms
            for (const [field, fieldSynonyms] of Object.entries(synonyms)) {
                if (fieldSynonyms.some(syn => normalizedCol.includes(syn.toLowerCase()))) {
                    mapping[column] = field;
                    break;
                }
            }

            if (!mapping[column]) {
                mapping[column] = null; // Unmapped
            }
        }

        return mapping;
    }

    /**
     * Step 2: Show detection results
     */
    renderStep2() {
        this.currentStep = 2;

        const result = this.detectionResult;
        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;

        this.container.innerHTML = `
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
                    <span>Файл успешно проанализирован! Обнаружено ${result.total_rows} строк.</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="stat bg-base-200 rounded-lg">
                        <div class="stat-title">Разделитель</div>
                        <div class="stat-value text-2xl">${this.escapeHtml(result.delimiter === '\t' ? 'Табуляция' : result.delimiter)}</div>
                    </div>
                    <div class="stat bg-base-200 rounded-lg">
                        <div class="stat-title">Кодировка</div>
                        <div class="stat-value text-2xl">${this.escapeHtml(result.encoding)}</div>
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold mb-2">Обнаруженные колонки (${result.detected_columns.length}):</h4>
                    <div class="flex flex-wrap gap-2">
                        ${result.detected_columns.map(col => `
                            <div class="badge badge-lg badge-primary">${this.escapeHtml(col)}</div>
                        `).join('')}
                    </div>
                </div>

                <div class="mb-6">
                    <h4 class="font-bold mb-2">Предпросмотр данных (первые 5 строк):</h4>
                    <div class="overflow-x-auto">
                        <table class="table table-sm table-zebra">
                            <thead>
                                <tr>
                                    ${result.detected_columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${result.sample_rows.slice(0, 5).map(row => `
                                    <tr>
                                        ${result.detected_columns.map(col => `<td>${this.escapeHtml(row[col] || '')}</td>`).join('')}
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

    /**
     * Step 3: Column mapping
     */
    renderStep3() {
        this.currentStep = 3;

        const result = this.detectionResult;
        const autoMapping = result.auto_mapping;
        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;

        // Initialize column mapping from auto-mapping
        this.columnMapping = { ...autoMapping };

        const fieldOptions = [
            { value: '', label: '-- Не использовать --' },
            { value: 'store', label: '🏪 Магазин (обязательно)' },
            { value: 'product_group', label: '📦 Группа товаров (обязательно)' },
            { value: 'product_name', label: '🛒 Товар (обязательно)' },
            { value: 'quantity', label: '📊 Количество' },
            { value: 'unit', label: '📏 Единица измерения' },
            { value: 'comment', label: '💬 Комментарий' }
        ];

        this.container.innerHTML = `
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
                    ${result.detected_columns.map(column => `
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">
                                    CSV колонка: <span class="badge badge-ghost">${this.escapeHtml(column)}</span>
                                </span>
                            </label>
                            <select class="select select-bordered"
                                    data-column="${this.escapeHtml(column)}"
                                    onchange="window.${varName}.updateMapping('${this.escapeHtml(column)}', this.value)">
                                ${fieldOptions.map(opt => `
                                    <option value="${opt.value}"
                                            ${autoMapping[column] === opt.value ? 'selected' : ''}>
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
        this.validateMapping();

        debugLog('[CSVImporter] Rendered step 3');
    }

    /**
     * Update column mapping
     */
    updateMapping(column, fieldName) {
        this.columnMapping[column] = fieldName || null;
        this.validateMapping();
        debugLog('[CSVImporter] Updated mapping:', this.columnMapping);
    }

    /**
     * Validate column mapping
     */
    validateMapping() {
        const validationDiv = document.getElementById('mapping-validation');
        if (!validationDiv) return;

        const requiredFields = ['store', 'product_group', 'product_name'];
        const mappedFields = Object.values(this.columnMapping).filter(f => f !== null);

        const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));

        if (missingRequired.length > 0) {
            validationDiv.innerHTML = `
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Не хватает обязательных полей: ${missingRequired.join(', ')}</span>
                </div>
            `;
            return false;
        } else {
            validationDiv.innerHTML = `
                <div class="alert alert-success">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Все обязательные поля сопоставлены!</span>
                </div>
            `;
            return true;
        }
    }

    /**
     * Validate mapping and continue
     */
    async validateAndContinue() {
        if (this.validateMapping()) {
            await this.renderStep4();
        } else {
            showToast('Пожалуйста, сопоставьте все обязательные поля', 'warning');
        }
    }

    /**
     * Step 4: Preview & validation
     */
    async renderStep4() {
        this.currentStep = 4;

        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;

        // Show loading state
        this.container.innerHTML = `
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
            await this.callPreviewAPI();

            // Render preview with validation results
            this.renderPreviewResults();

        } catch (error) {
            console.error('[CSVImporter] Error in preview:', error);
            this.renderPreviewError(error.message);
        }

        debugLog('[CSVImporter] Rendered step 4');
    }

    /**
     * Call preview API for validation
     */
    async callPreviewAPI() {
        // Encode file content to base64
        const fileContent = btoa(unescape(encodeURIComponent(this.fileContent)));

        // Prepare request payload
        const requestData = {
            file_content: fileContent,
            delimiter: this.detectionResult.delimiter,
            encoding: this.detectionResult.encoding,
            has_header: this.detectionResult.has_header,
            column_mapping: this.columnMapping,
        };

        debugLog('[CSVImporter] Calling preview API with:', requestData);

        const response = await fetch('/api/v1/shopping-lists/import/preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to validate CSV data');
        }

        this.validationResult = await response.json();
        debugLog('[CSVImporter] Validation result:', this.validationResult);
    }

    /**
     * Render preview results with validation
     */
    renderPreviewResults() {
        const result = this.validationResult;
        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;

        // Determine overall status
        const statusClass = result.is_valid ? 'alert-success' : 'alert-warning';
        const statusIcon = result.is_valid
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
        const statusText = result.is_valid
            ? 'Все данные валидны и готовы к импорту'
            : `Обнаружены проблемы: ${result.invalid_rows} строк с ошибками`;

        // Build preview table rows
        const previewTableRows = result.preview_rows.map(row => {
            const rowClass = this.getRowValidationClass(row.validation_status);
            const statusBadge = this.getStatusBadge(row.validation_status);

            // Get mapped field names for display
            const mappedFields = Object.entries(this.columnMapping)
                .filter(([_, field]) => field)
                .map(([_, field]) => field);

            // Build data cells
            const dataCells = mappedFields.map(field => {
                const value = row.data[field] || '';
                const hasError = row.errors?.some(e => e.field === field);
                const hasWarning = row.warnings?.some(w => w.field === field);
                const cellClass = hasError ? 'bg-error/20 text-error' : (hasWarning ? 'bg-warning/20 text-warning' : '');

                return `<td class="${cellClass}">${this.escapeHtml(value)}</td>`;
            }).join('');

            // Build error/warning tooltip
            const issues = [...(row.errors || []), ...(row.warnings || [])];
            const issueTooltip = issues.length > 0
                ? `title="${issues.map(i => this.escapeHtml(i.message)).join('; ')}"`
                : '';

            return `
                <tr class="${rowClass}" ${issueTooltip}>
                    <td class="text-center">${row.row_index + 1}</td>
                    <td class="text-center">${statusBadge}</td>
                    ${dataCells}
                </tr>
            `;
        }).join('');

        // Build header cells
        const mappedFields = Object.entries(this.columnMapping)
            .filter(([_, field]) => field)
            .map(([csvCol, field]) => ({ csvCol, field }));

        const headerCells = mappedFields.map(({ csvCol, field }) => {
            const fieldLabel = this.getFieldLabel(field);
            return `<th title="CSV: ${this.escapeHtml(csvCol)}">${fieldLabel}</th>`;
        }).join('');

        // Build errors list (if any)
        const errorsSection = result.errors.length > 0 ? `
            <div class="collapse collapse-arrow bg-error/10 mb-4">
                <input type="checkbox" checked />
                <div class="collapse-title font-medium text-error">
                    ❌ Ошибки (${result.errors.length})
                </div>
                <div class="collapse-content">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${result.errors.slice(0, 10).map(e => `
                            <li>Строка ${e.row_index + 1}: <strong>${this.escapeHtml(e.field)}</strong> - ${this.escapeHtml(e.message)}</li>
                        `).join('')}
                        ${result.errors.length > 10 ? `<li class="text-base-content/70">... и еще ${result.errors.length - 10} ошибок</li>` : ''}
                    </ul>
                </div>
            </div>
        ` : '';

        // Build warnings list (if any)
        const warningsSection = result.warnings.length > 0 ? `
            <div class="collapse collapse-arrow bg-warning/10 mb-4">
                <input type="checkbox" />
                <div class="collapse-title font-medium text-warning">
                    ⚠️ Предупреждения (${result.warnings.length})
                </div>
                <div class="collapse-content">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${result.warnings.slice(0, 10).map(w => `
                            <li>Строка ${w.row_index + 1}: <strong>${this.escapeHtml(w.field)}</strong> - ${this.escapeHtml(w.message)}</li>
                        `).join('')}
                        ${result.warnings.length > 10 ? `<li class="text-base-content/70">... и еще ${result.warnings.length - 10} предупреждений</li>` : ''}
                    </ul>
                </div>
            </div>
        ` : '';

        this.container.innerHTML = `
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

                <!-- Status Alert -->
                <div class="alert ${statusClass} mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        ${statusIcon}
                    </svg>
                    <span>${statusText}</span>
                </div>

                <!-- Statistics -->
                <div class="stats stats-vertical sm:stats-horizontal shadow mb-6 w-full">
                    <div class="stat">
                        <div class="stat-title">Всего строк</div>
                        <div class="stat-value text-primary">${result.total_rows}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-title">Валидных</div>
                        <div class="stat-value text-success">${result.valid_rows}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-title">С ошибками</div>
                        <div class="stat-value text-error">${result.invalid_rows}</div>
                    </div>
                </div>

                <!-- Errors and Warnings -->
                ${errorsSection}
                ${warningsSection}

                <!-- Preview Table -->
                <div class="mb-6">
                    <h4 class="font-bold mb-2">Предпросмотр данных (первые ${result.preview_rows.length} строк):</h4>
                    <div class="overflow-x-auto">
                        <table class="table table-sm table-zebra">
                            <thead>
                                <tr>
                                    <th class="text-center">№</th>
                                    <th class="text-center">Статус</th>
                                    ${headerCells}
                                </tr>
                            </thead>
                            <tbody>
                                ${previewTableRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Import Options -->
                ${result.invalid_rows > 0 ? `
                <div class="form-control mb-4">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="skip-invalid-checkbox" class="checkbox checkbox-primary" />
                        <span class="label-text">Пропустить строки с ошибками (${result.invalid_rows})</span>
                    </label>
                </div>
                ` : ''}

                ${result.warnings.length > 0 ? `
                <div class="form-control mb-4">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="skip-duplicates-checkbox" class="checkbox checkbox-warning" />
                        <span class="label-text">Пропустить дубликаты (${result.warnings.length})</span>
                    </label>
                </div>
                ` : ''}

                <!-- Create missing references option -->
                <div class="form-control mb-4">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="create-missing-checkbox" class="checkbox checkbox-success" />
                        <span class="label-text">Загрузить с новой группой или магазином</span>
                    </label>
                    <label class="label pt-0">
                        <span class="label-text-alt text-xs opacity-70">Автоматически создавать отсутствующие магазины и группы товаров</span>
                    </label>
                </div>

                <div class="flex gap-2">
                    <button class="btn btn-outline" onclick="window.${varName}.renderStep3()">
                        ← Назад
                    </button>
                    <button class="btn btn-success" onclick="window.${varName}.executeImport()" ${result.valid_rows === 0 ? 'disabled' : ''}>
                        ✓ Импортировать ${result.valid_rows} ${this.pluralize(result.valid_rows, 'строку', 'строки', 'строк')}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render preview error
     */
    renderPreviewError(errorMessage) {
        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;

        this.container.innerHTML = `
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

                <div class="alert alert-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Ошибка валидации: ${this.escapeHtml(errorMessage)}</span>
                </div>

                <div class="flex gap-2">
                    <button class="btn btn-outline" onclick="window.${varName}.renderStep3()">
                        ← Назад к маппингу
                    </button>
                    <button class="btn btn-primary" onclick="window.${varName}.renderStep4()">
                        🔄 Повторить
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get CSS class for row based on validation status
     */
    getRowValidationClass(status) {
        switch (status) {
            case 'error': return 'bg-error/10';
            case 'warning': return 'bg-warning/10';
            default: return '';
        }
    }

    /**
     * Get badge HTML for validation status
     */
    getStatusBadge(status) {
        switch (status) {
            case 'error': return '<span class="badge badge-error badge-sm">❌</span>';
            case 'warning': return '<span class="badge badge-warning badge-sm">⚠️</span>';
            default: return '<span class="badge badge-success badge-sm">✓</span>';
        }
    }

    /**
     * Get human-readable field label
     */
    getFieldLabel(field) {
        const labels = {
            'store': '🏪 Магазин',
            'product_group': '📦 Группа',
            'product_name': '🛒 Товар',
            'quantity': '📊 Кол-во',
            'unit': '📏 Ед.',
            'comment': '💬 Комментарий'
        };
        return labels[field] || field;
    }

    /**
     * Pluralize Russian word
     */
    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;

        if (mod100 >= 11 && mod100 <= 19) {
            return many;
        }
        if (mod10 === 1) {
            return one;
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return few;
        }
        return many;
    }

    /**
     * Execute CSV import
     */
    async executeImport() {
        try {
            // Get current shopping list ID
            const currentListId = this.listsManager.currentListId;
            if (!currentListId) {
                showToast('Пожалуйста, выберите список для импорта', 'error');
                return;
            }

            // Read checkbox options
            const skipInvalidCheckbox = document.getElementById('skip-invalid-checkbox');
            const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox');
            const createMissingCheckbox = document.getElementById('create-missing-checkbox');
            const skipInvalid = skipInvalidCheckbox ? skipInvalidCheckbox.checked : false;
            const skipDuplicates = skipDuplicatesCheckbox ? skipDuplicatesCheckbox.checked : false;
            const createMissing = createMissingCheckbox ? createMissingCheckbox.checked : false;

            // Show loading
            showToast('Импорт данных...', 'info');

            // Encode file content to base64
            const fileContent = btoa(unescape(encodeURIComponent(this.fileContent)));

            // Prepare request payload
            const requestData = {
                file_content: fileContent,
                delimiter: this.detectionResult.delimiter,
                encoding: this.detectionResult.encoding,
                has_header: this.detectionResult.has_header,
                column_mapping: this.columnMapping,
                shopping_list_id: currentListId,
                skip_duplicates: skipDuplicates,
                skip_invalid: skipInvalid,
                create_missing_references: createMissing,
            };

            debugLog('[CSVImporter] Executing import with:', requestData);

            // Call backend API
            const response = await fetch('/api/v1/shopping-lists/import/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to execute import');
            }

            const result = await response.json();
            debugLog('[CSVImporter] Import result:', result);

            // Show results
            if (result.success || result.imported_count > 0) {
                showToast(
                    `✅ Импорт завершён! Импортировано: ${result.imported_count}, Пропущено: ${result.skipped_count}, Ошибок: ${result.error_count}`,
                    'success',
                    5000
                );

                // Reload shopping list items
                await this.listsManager.loadShoppingListItems(currentListId);

                // Re-render items table
                this.listsManager.renderItemsTable();

                // Close import accordion
                const importToggle = document.getElementById('import-toggle');
                if (importToggle) {
                    importToggle.checked = false;
                }

                // Reset wizard
                this.container.innerHTML = '';

            } else {
                // Show errors
                const errorMessages = result.errors.slice(0, 5).map(e =>
                    `Строка ${e.row_index + 1}: ${e.message}`
                ).join('\n');

                showToast(
                    `❌ Импорт завершён с ошибками (${result.error_count}):\n${errorMessages}`,
                    'error',
                    10000
                );
            }

        } catch (error) {
            console.error('[CSVImporter] Error executing import:', error);
            showToast(`Ошибка импорта: ${error.message}`, 'error');
        }
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make available globally
window.CSVImporter = CSVImporter;

debugLog('[CSVImporter] Module loaded');
