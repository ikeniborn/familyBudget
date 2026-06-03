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
    /**
     * Initialize Web Worker for CSV processing.
     * Called automatically on first use.
     */
    static initializeWorker() {
        if (!this._workerWrapper && typeof WorkerWrapper !== 'undefined') {
            try {
                this._workerWrapper = new WorkerWrapper('/static/js/workers/csvWorker.min.js', {
                    idleTimeout: 60000, // 60s for CSV (files may be large)
                    debugMode: window.DEBUG_MODE || false
                });
            }
            catch (error) {
                console.warn('[CSVImporter] Failed to initialize worker:', error);
                this._workerWrapper = null;
            }
        }
    }
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
        // Import options (preserved across revalidations)
        this.importOptions = {
            skipInvalid: false,
            skipDuplicates: false,
            createMissingReferences: false,
            aggregateDuplicates: false,
        };
        // Preview pagination state
        this.previewPagination = {
            currentPage: 1,
            rowsPerPage: 15,
            rowsPerPageOptions: [10, 15, 25, 50, 100],
        };
        // Preview filter state
        this.previewFilters = {
            store: '',
            group: '',
            product: '',
        };
        // All preview rows (for client-side filtering/pagination)
        this.allPreviewRows = [];
    }
    /**
     * Encode content to Base64 using Web Worker.
     * Falls back to synchronous encoding on error.
     *
     * @param {string} content - UTF-8 string content
     * @returns {Promise<string>} Base64 encoded string
     */
    async encodeBase64(content) {
        const contentSizeKB = Math.round(content.length / 1024);
        const startTime = performance.now();
        // For large files (>1MB), use worker
        if (content.length > 1000000 && CSVImporter._workerWrapper) {
            try {
                CSVImporter.initializeWorker();
                // Show initial progress
                if (typeof showToast !== 'undefined') {
                    showToast(`Кодирование файла (${contentSizeKB}KB)...`, 'info', 1000);
                }
                const result = await CSVImporter._workerWrapper.execute({
                    action: 'encodeBase64',
                    data: { content }
                });
                const duration = Math.round(performance.now() - startTime);
                if (window.DEBUG_MODE) {
                    console.log(`[CSVImporter] Worker Base64 encoding: ${duration}ms (${contentSizeKB}KB)`);
                }
                return result;
            }
            catch (error) {
                console.warn('[CSVImporter] Worker Base64 encoding failed, using synchronous:', error);
                // Fall through to synchronous
            }
        }
        // Synchronous fallback (original implementation)
        const result = btoa(unescape(encodeURIComponent(content)));
        const duration = Math.round(performance.now() - startTime);
        if (window.DEBUG_MODE && duration > 100) {
            console.log(`[CSVImporter] Synchronous Base64 encoding: ${duration}ms (${contentSizeKB}KB)`);
        }
        return result;
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
        if (!this.container)
            return;
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
                           onchange="window.${varName}.handleFileSelect(event: Event)">

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
        const target = event.target;
        if (!target?.files)
            return;
        const file = target.files[0];
        if (!file)
            return;
        if (!file.name.endsWith('.csv')) {
            showToast('Пожалуйста, выберите CSV файл', 'error');
            return;
        }
        this.file = file;
        try {
            // Read file content
            const content = await this.readFileContent(file);
            this.fileContent = typeof content === 'string' ? content : null;
            // Show loading
            showToast('Анализ файла...', 'info');
            // Analyze file (auto-detection)
            await this.analyzeFile();
            // Move to step 2
            this.renderStep2();
        }
        catch (error) {
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
            reader.onload = (e) => resolve(e.target?.result || null);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    /**
     * Analyze CSV file (auto-detection)
     */
    async analyzeFile() {
        try {
            // Encode file content to base64 (worker-based for large files)
            if (!this.fileContent) {
                throw new Error('File content is empty');
            }
            const fileContent = await this.encodeBase64(this.fileContent);
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
        }
        catch (error) {
            console.error('[CSVImporter] Error analyzing file:', error);
            // Fallback to client-side detection if API fails
            debugLog('[CSVImporter] Falling back to client-side detection');
            if (!this.fileContent) {
                throw new Error('File content is empty');
            }
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
        if (!this.container)
            return;
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
                        ${result.detected_columns.map((col) => `
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
                                    ${result.detected_columns.map((col) => `<th>${this.escapeHtml(col)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${result.sample_rows.slice(0, 5).map((row) => `
                                    <tr>
                                        ${result.detected_columns.map((col) => `<td>${this.escapeHtml(row[col] || '')}</td>`).join('')}
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
        if (!this.container)
            return;
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
                    ${result.detected_columns.map((column) => `
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
        this.columnMapping[column] = fieldName || '';
        this.validateMapping();
        debugLog('[CSVImporter] Updated mapping:', this.columnMapping);
    }
    /**
     * Validate column mapping
     */
    validateMapping() {
        const validationDiv = document.getElementById('mapping-validation');
        if (!validationDiv)
            return;
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
        }
        else {
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
        }
        else {
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
        if (!this.container)
            return;
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
        }
        catch (error) {
            console.error('[CSVImporter] Error in preview:', error);
            this.renderPreviewError(error.message);
        }
        debugLog('[CSVImporter] Rendered step 4');
    }
    /**
     * Call preview API for validation
     * @param {Object} options - Optional behavior flags
     * @param {boolean} options.create_missing_references - Filter reference errors
     * @param {boolean} options.aggregate_duplicates - Aggregate duplicate rows
     */
    async callPreviewAPI(options = {}) {
        // Encode file content to base64 (worker-based for large files)
        if (!this.fileContent) {
            throw new Error('File content is empty');
        }
        const fileContent = await this.encodeBase64(this.fileContent);
        // Prepare request payload
        const requestData = {
            file_content: fileContent,
            delimiter: this.detectionResult.delimiter,
            encoding: this.detectionResult.encoding,
            has_header: this.detectionResult.has_header,
            column_mapping: this.columnMapping,
            create_missing_references: options.create_missing_references || false,
            aggregate_duplicates: options.aggregate_duplicates || false,
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
     * Revalidate with current checkbox options
     * Called when checkboxes change to update valid_rows count
     */
    async revalidateWithOptions() {
        // Read current checkbox states and save to importOptions
        const createMissingCheckbox = document.getElementById('create-missing-checkbox');
        const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox');
        const skipInvalidCheckbox = document.getElementById('skip-invalid-checkbox');
        const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox');
        // Save all checkbox states to preserve across rerender
        this.importOptions.createMissingReferences = createMissingCheckbox?.checked || false;
        this.importOptions.aggregateDuplicates = aggregateDuplicatesCheckbox?.checked || false;
        this.importOptions.skipInvalid = skipInvalidCheckbox?.checked || false;
        this.importOptions.skipDuplicates = skipDuplicatesCheckbox?.checked || false;
        const options = {
            create_missing_references: this.importOptions.createMissingReferences,
            aggregate_duplicates: this.importOptions.aggregateDuplicates,
        };
        debugLog('[CSVImporter] Revalidating with options:', options);
        // Show loading on button
        const importButton = document.getElementById('import-button');
        if (importButton) {
            importButton.disabled = true;
            importButton.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Пересчёт...';
        }
        try {
            // Save previous row count to compare (for aggregation info toast)
            const prevRowCount = this.validationResult?.total_rows || 0;
            await this.callPreviewAPI(options);
            // Show aggregation info toast if enabled and rows were merged
            const newRowCount = this.validationResult?.total_rows || 0;
            if (this.importOptions.aggregateDuplicates && prevRowCount > 0 && prevRowCount > newRowCount) {
                const mergedCount = prevRowCount - newRowCount;
                showToast(`✓ Агрегация: ${prevRowCount} строк → ${newRowCount} строк (${mergedCount} дубликатов объединено)`, 'info', 5000);
            }
            this.renderPreviewResults();
        }
        catch (error) {
            console.error('[CSVImporter] Error revalidating:', error);
            showToast(`Ошибка пересчёта: ${error.message}`, 'error');
        }
    }
    /**
     * Handle Skip Duplicates checkbox state change.
     * Implements mutually exclusive behavior: Skip and Aggregate are incompatible.
     * When Skip is enabled, Aggregate is auto-disabled and hidden.
     */
    handleSkipDuplicatesChange() {
        // Get DOM elements
        const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox');
        const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox');
        // Read current state
        const skipDuplicatesEnabled = skipDuplicatesCheckbox?.checked || false;
        // Save to importOptions
        this.importOptions.skipDuplicates = skipDuplicatesEnabled;
        // Debug log
        debugLog('[CSVImporter] Skip Duplicates toggled:', skipDuplicatesEnabled);
        // Auto-uncheck Aggregate if incompatible (both can't be true)
        if (skipDuplicatesEnabled && aggregateDuplicatesCheckbox?.checked) {
            aggregateDuplicatesCheckbox.checked = false;
            this.importOptions.aggregateDuplicates = false;
            debugLog('[CSVImporter] Auto-disabled Aggregate Duplicates (incompatible with Skip)');
        }
        // Re-render UI with updated visibility logic
        // NOTE: Does NOT call API - just updates UI (skip is a final import option, not preview)
        this.renderPreviewResults();
    }
    /**
     * Get unique values for filter dropdowns from preview rows
     * @param {string} field - Field name (store, product_group, product_name)
     * @returns {string[]} Sorted unique values
     */
    getUniqueFilterValues(field) {
        const values = new Set();
        for (const row of this.allPreviewRows) {
            const value = row.data[field];
            if (value && value.trim()) {
                values.add(value.trim());
            }
        }
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
    }
    /**
     * Apply filters and pagination to preview rows
     * @returns {{filteredRows: Array, totalFiltered: number, startIndex: number, endIndex: number}}
     */
    getFilteredPaginatedRows() {
        // Apply filters
        const filteredRows = this.allPreviewRows.filter(row => {
            // Store filter (exact match from dropdown)
            if (this.previewFilters.store) {
                const storeValue = row.data.store || '';
                if (storeValue !== this.previewFilters.store) {
                    return false;
                }
            }
            // Group filter (exact match from dropdown)
            if (this.previewFilters.group) {
                const groupValue = row.data.product_group || '';
                if (groupValue !== this.previewFilters.group) {
                    return false;
                }
            }
            // Product filter (substring search, case-insensitive)
            if (this.previewFilters.product) {
                const productValue = (row.data.product_name || '').toLowerCase();
                const searchTerm = this.previewFilters.product.toLowerCase();
                if (!productValue.includes(searchTerm)) {
                    return false;
                }
            }
            return true;
        });
        const totalFiltered = filteredRows.length;
        // Apply pagination
        const startIndex = (this.previewPagination.currentPage - 1) * this.previewPagination.rowsPerPage;
        const endIndex = Math.min(startIndex + this.previewPagination.rowsPerPage, totalFiltered);
        const paginatedRows = filteredRows.slice(startIndex, endIndex);
        return {
            filteredRows: paginatedRows,
            totalFiltered,
            startIndex,
            endIndex,
            totalPages: Math.ceil(totalFiltered / this.previewPagination.rowsPerPage),
        };
    }
    /**
     * Handle filter change
     * @param {string} filterType - Filter type (store, group, product)
     * @param {string} value - Filter value
     */
    handleFilterChange(filterType, value) {
        this.previewFilters[filterType] = value;
        // Reset to first page when filter changes
        this.previewPagination.currentPage = 1;
        // Re-render only the table part
        this.updatePreviewTable();
    }
    /**
     * Handle rows per page change
     * @param {number} value - New rows per page value
     */
    handleRowsPerPageChange(value) {
        this.previewPagination.rowsPerPage = parseInt(value, 10);
        // Reset to first page when page size changes
        this.previewPagination.currentPage = 1;
        this.updatePreviewTable();
    }
    /**
     * Handle page change
     * @param {number} page - New page number
     */
    handlePageChange(page) {
        const { totalPages } = this.getFilteredPaginatedRows();
        if (page >= 1 && page <= totalPages) {
            this.previewPagination.currentPage = page;
            this.updatePreviewTable();
        }
    }
    /**
     * Clear all filters
     */
    clearFilters() {
        this.previewFilters = { store: '', group: '', product: '' };
        this.previewPagination.currentPage = 1;
        this.updatePreviewTable();
        // Reset filter inputs
        const storeFilter = document.getElementById('preview-filter-store');
        const groupFilter = document.getElementById('preview-filter-group');
        const productFilter = document.getElementById('preview-filter-product');
        if (storeFilter)
            storeFilter.value = '';
        if (groupFilter)
            groupFilter.value = '';
        if (productFilter)
            productFilter.value = '';
    }
    /**
     * Update only the preview table (for filter/pagination changes)
     */
    updatePreviewTable() {
        const tableContainer = document.getElementById('preview-table-container');
        if (!tableContainer)
            return;
        tableContainer.innerHTML = this.renderPreviewTableHTML();
    }
    /**
     * Render the preview table HTML with filters and pagination
     * @returns {string} HTML string for the preview table section
     */
    renderPreviewTableHTML() {
        const varName = this.globalVarName;
        const result = this.validationResult;
        // Get filter options
        const storeOptions = this.getUniqueFilterValues('store');
        const groupOptions = this.getUniqueFilterValues('product_group');
        // Get filtered/paginated rows
        const { filteredRows, totalFiltered, startIndex, endIndex, totalPages } = this.getFilteredPaginatedRows();
        const currentPage = this.previewPagination.currentPage;
        const rowsPerPage = this.previewPagination.rowsPerPage;
        // Build header cells
        const mappedFields = Object.entries(this.columnMapping)
            .filter(([_, field]) => field)
            .map(([csvCol, field]) => ({ csvCol, field }));
        const headerCells = mappedFields.map(({ csvCol, field }) => {
            const fieldLabel = this.getFieldLabel(field);
            return `<th title="CSV: ${this.escapeHtml(csvCol)}">${fieldLabel}</th>`;
        }).join('');
        // Build table rows
        const tableRows = filteredRows.map(row => {
            const rowClass = this.getRowValidationClass(row.validation_status);
            const statusBadge = this.getStatusBadge(row.validation_status);
            // Build data cells
            const dataCells = mappedFields.map(({ field }) => {
                const value = row.data[field] || '';
                const hasError = row.errors?.some((e) => e.field === field);
                const hasWarning = row.warnings?.some((w) => w.field === field);
                const cellClass = hasError ? 'bg-error/20 text-error' : (hasWarning ? 'bg-warning/20 text-warning' : '');
                return `<td class="${cellClass}">${this.escapeHtml(value)}</td>`;
            }).join('');
            // Build error/warning tooltip
            const issues = [...(row.errors || []), ...(row.warnings || [])];
            const issueTooltip = issues.length > 0
                ? `title="${issues.map((i) => this.escapeHtml(i.message)).join('; ')}"`
                : '';
            return `
                <tr class="${rowClass}" ${issueTooltip}>
                    <td class="text-center sticky left-0 bg-base-100 z-10">${row.row_index + 1}</td>
                    <td class="text-center">${statusBadge}</td>
                    ${dataCells}
                </tr>
            `;
        }).join('');
        // Build rows per page selector
        const rowsPerPageOptions = this.previewPagination.rowsPerPageOptions.map(opt => `<option value="${opt}" ${opt === rowsPerPage ? 'selected' : ''}>${opt}</option>`).join('');
        // Build pagination buttons
        let paginationHTML = '';
        if (totalPages > 1) {
            const pageButtons = [];
            // Previous button
            pageButtons.push(`
                <button class="join-item btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}"
                        onclick="window.${varName}.handlePageChange(${currentPage - 1})"
                        ${currentPage === 1 ? 'disabled' : ''}>«</button>
            `);
            // Page numbers with ellipsis
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            if (startPage > 1) {
                pageButtons.push(`
                    <button class="join-item btn btn-sm" onclick="window.${varName}.handlePageChange(1)">1</button>
                `);
                if (startPage > 2) {
                    pageButtons.push(`<span class="join-item btn btn-sm btn-disabled">...</span>`);
                }
            }
            for (let i = startPage; i <= endPage; i++) {
                pageButtons.push(`
                    <button class="join-item btn btn-sm ${i === currentPage ? 'btn-active' : ''}"
                            onclick="window.${varName}.handlePageChange(${i})">${i}</button>
                `);
            }
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pageButtons.push(`<span class="join-item btn btn-sm btn-disabled">...</span>`);
                }
                pageButtons.push(`
                    <button class="join-item btn btn-sm" onclick="window.${varName}.handlePageChange(${totalPages})">${totalPages}</button>
                `);
            }
            // Next button
            pageButtons.push(`
                <button class="join-item btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}"
                        onclick="window.${varName}.handlePageChange(${currentPage + 1})"
                        ${currentPage === totalPages ? 'disabled' : ''}>»</button>
            `);
            paginationHTML = `
                <div class="flex justify-center mt-4">
                    <div class="join">${pageButtons.join('')}</div>
                </div>
            `;
        }
        // Check if any filters are active
        const hasActiveFilters = this.previewFilters.store || this.previewFilters.group || this.previewFilters.product;
        return `
            <h4 class="font-bold mb-2">Предпросмотр данных (${result.total_rows} ${this.pluralize(result.total_rows, 'строка', 'строки', 'строк')}):</h4>

            <!-- Filters -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 p-3 bg-base-200 rounded-lg">
                <!-- Store filter -->
                <div class="form-control">
                    <label class="label py-0.5">
                        <span class="label-text text-xs">🏪 Магазин</span>
                    </label>
                    <select id="preview-filter-store"
                            class="select select-bordered select-sm min-h-[3rem]"
                            onchange="window.${varName}.handleFilterChange('store', this.value)">
                        <option value="">Все магазины</option>
                        ${storeOptions.map(opt => `
                            <option value="${this.escapeHtml(opt)}" ${this.previewFilters.store === opt ? 'selected' : ''}>
                                ${this.escapeHtml(opt)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Group filter -->
                <div class="form-control">
                    <label class="label py-0.5">
                        <span class="label-text text-xs">📦 Группа</span>
                    </label>
                    <select id="preview-filter-group"
                            class="select select-bordered select-sm min-h-[3rem]"
                            onchange="window.${varName}.handleFilterChange('group', this.value)">
                        <option value="">Все группы</option>
                        ${groupOptions.map(opt => `
                            <option value="${this.escapeHtml(opt)}" ${this.previewFilters.group === opt ? 'selected' : ''}>
                                ${this.escapeHtml(opt)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Product filter (substring search) -->
                <div class="form-control">
                    <label class="label py-0.5">
                        <span class="label-text text-xs">🛒 Товар</span>
                    </label>
                    <input type="text"
                           id="preview-filter-product"
                           class="input input-bordered input-sm min-h-[3rem]"
                           placeholder="Поиск по названию..."
                           value="${this.escapeHtml(this.previewFilters.product)}"
                           oninput="window.${varName}.handleFilterChange('product', this.value)">
                </div>

                <!-- Rows per page selector -->
                <div class="form-control">
                    <label class="label py-0.5">
                        <span class="label-text text-xs">📋 Строк на странице</span>
                    </label>
                    <select id="preview-rows-per-page"
                            class="select select-bordered select-sm min-h-[3rem]"
                            onchange="window.${varName}.handleRowsPerPageChange(this.value)">
                        ${rowsPerPageOptions}
                    </select>
                </div>
            </div>

            <!-- Filter status and clear button -->
            ${hasActiveFilters || totalFiltered !== result.total_rows ? `
            <div class="flex items-center justify-between mb-2 text-sm">
                <span class="text-base-content/70">
                    Показано ${totalFiltered} из ${result.total_rows} строк
                    ${hasActiveFilters ? ' (фильтр применён)' : ''}
                </span>
                ${hasActiveFilters ? `
                <button class="btn btn-xs btn-ghost" onclick="window.${varName}.clearFilters()">
                    ✕ Сбросить фильтры
                </button>
                ` : ''}
            </div>
            ` : ''}

            <!-- Table -->
            <div class="overflow-x-auto">
                <table class="table table-sm table-zebra">
                    <thead>
                        <tr>
                            <th class="text-center sticky left-0 bg-base-200 z-10">№</th>
                            <th class="text-center">Статус</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows.length > 0 ? tableRows : `
                            <tr>
                                <td colspan="${mappedFields.length + 2}" class="text-center py-4 text-base-content/50">
                                    ${hasActiveFilters ? 'Нет записей, соответствующих фильтру' : 'Нет данных для отображения'}
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Pagination info and controls -->
            ${totalFiltered > 0 ? `
            <div class="flex flex-col sm:flex-row items-center justify-between mt-3 gap-2">
                <span class="text-sm text-base-content/70">
                    Показано ${startIndex + 1}–${endIndex} из ${totalFiltered}
                </span>
                ${paginationHTML}
            </div>
            ` : ''}
        `;
    }
    /**
     * Check if there are any reference errors in validation result.
     * Reference errors occur when store/product_group not found in DB.
     *
     * IMPORTANT: Returns true if createMissingReferences is already enabled,
     * to keep checkbox visible (otherwise user can't disable it).
     *
     * @param {Object} result - Preview API result
     * @returns {boolean} True if there are reference errors OR option is enabled
     */
    hasReferenceErrors(result) {
        // Keep checkbox visible if user already enabled the option
        if (this.importOptions.createMissingReferences) {
            return true;
        }
        // Show checkbox if there are reference errors in current result
        if (!result.errors || result.errors.length === 0) {
            return false;
        }
        return result.errors.some((e) => e.error_type === 'reference');
    }
    /**
     * Check if there are any duplicate warnings in validation result.
     *
     * IMPORTANT: Returns true if aggregateDuplicates is already enabled,
     * to keep checkbox visible (otherwise user can't disable it).
     *
     * NOTE: Skip and Aggregate are mutually exclusive - when Skip is enabled,
     * Aggregate must be hidden to prevent user confusion.
     *
     * @param {Object} result - Preview API result
     * @returns {boolean} True if there are duplicate warnings OR aggregation is enabled
     */
    hasDuplicateWarnings(result) {
        // Hide aggregate checkbox if skip duplicates is enabled (mutually exclusive)
        if (this.importOptions.skipDuplicates) {
            return false;
        }
        // Keep checkbox visible if user already enabled the option
        if (this.importOptions.aggregateDuplicates) {
            return true;
        }
        // Show checkbox if there are duplicate warnings
        return result.warnings && result.warnings.length > 0;
    }
    /**
     * Render preview results with validation
     */
    renderPreviewResults() {
        const result = this.validationResult;
        const step1OnClick = this.getStep1OnClick();
        const varName = this.globalVarName;
        // Store all preview rows for client-side filtering/pagination
        this.allPreviewRows = result.preview_rows;
        // Reset pagination and filters on new validation
        this.previewPagination.currentPage = 1;
        this.previewFilters = { store: '', group: '', product: '' };
        // Determine overall status
        const statusClass = result.is_valid ? 'alert-success' : 'alert-warning';
        const statusIcon = result.is_valid
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
        const statusText = result.is_valid
            ? 'Все данные валидны и готовы к импорту'
            : `Обнаружены проблемы: ${result.invalid_rows} строк с ошибками`;
        // Build errors list (if any)
        const errorsSection = result.errors.length > 0 ? `
            <div class="collapse collapse-arrow bg-error/10 mb-4">
                <input type="checkbox" id="import-errors-toggle" class="peer" checked />
                <label for="import-errors-toggle" class="collapse-title font-medium text-error cursor-pointer">
                    ❌ Ошибки (${result.errors.length})
                </label>
                <div class="collapse-content">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${result.errors.slice(0, 10).map((e) => `
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
                <input type="checkbox" id="import-warnings-toggle" class="peer" />
                <label for="import-warnings-toggle" class="collapse-title font-medium text-warning cursor-pointer">
                    ⚠️ Предупреждения (${result.warnings.length})
                </label>
                <div class="collapse-content">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${result.warnings.slice(0, 10).map((w) => `
                            <li>Строка ${w.row_index + 1}: <strong>${this.escapeHtml(w.field)}</strong> - ${this.escapeHtml(w.message)}</li>
                        `).join('')}
                        ${result.warnings.length > 10 ? `<li class="text-base-content/70">... и еще ${result.warnings.length - 10} предупреждений</li>` : ''}
                    </ul>
                </div>
            </div>
        ` : '';
        if (!this.container)
            return;
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

                <!-- Aggregation Notice -->
                ${this.importOptions.aggregateDuplicates ? `
                <div class="alert alert-info mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                        <strong>Агрегация включена</strong>
                        <p class="text-sm">Дубликаты объединены: количество суммируется, комментарии объединяются через запятую.</p>
                    </div>
                </div>
                ` : ''}

                <!-- Errors and Warnings -->
                ${errorsSection}
                ${warningsSection}

                <!-- Preview Table with Filters and Pagination -->
                <div id="preview-table-container" class="mb-6">
                    ${this.renderPreviewTableHTML()}
                </div>

                <!-- Import Options -->
                ${result.invalid_rows > 0 ? `
                <div class="form-control mb-2">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="skip-invalid-checkbox" class="checkbox checkbox-primary"
                               ${this.importOptions.skipInvalid ? 'checked' : ''} />
                        <span class="label-text">Пропустить строки с ошибками (${result.invalid_rows})</span>
                    </label>
                </div>
                ` : ''}

                ${result.warnings.length > 0 ? `
                <div class="form-control mb-2">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="skip-duplicates-checkbox" class="checkbox checkbox-warning"
                               ${this.importOptions.skipDuplicates ? 'checked' : ''}
                               onchange="window.${varName}.handleSkipDuplicatesChange()" />
                        <span class="label-text">Пропустить дубликаты (${result.warnings.length})</span>
                    </label>
                </div>
                ` : ''}

                <!-- Aggregate duplicates - conditional display -->
                ${this.hasDuplicateWarnings(result) ? `
                <div class="form-control mb-2">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="aggregate-duplicates-checkbox" class="checkbox checkbox-info"
                               ${this.importOptions.aggregateDuplicates ? 'checked' : ''}
                               onchange="window.${varName}.revalidateWithOptions()" />
                        <span class="label-text">Агрегировать количество дубликатов</span>
                    </label>
                    <label class="label pt-0">
                        <span class="label-text-alt text-xs opacity-70">Суммировать количество, объединить комментарии через запятую</span>
                    </label>
                </div>
                ` : ''}

                <!-- Create missing references - conditional display -->
                ${this.hasReferenceErrors(result) ? `
                <div class="form-control mb-2">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" id="create-missing-checkbox" class="checkbox checkbox-success"
                               ${this.importOptions.createMissingReferences ? 'checked' : ''}
                               onchange="window.${varName}.revalidateWithOptions()" />
                        <span class="label-text">Загрузить с новой группой или магазином</span>
                    </label>
                    <label class="label pt-0">
                        <span class="label-text-alt text-xs opacity-70">Автоматически создавать отсутствующие магазины и группы товаров</span>
                    </label>
                </div>
                ` : ''}

                <div class="flex gap-2">
                    <button class="btn btn-outline" onclick="window.${varName}.renderStep3()">
                        ← Назад
                    </button>
                    <button id="import-button" class="btn btn-success" onclick="window.${varName}.executeImport()" ${result.valid_rows === 0 ? 'disabled' : ''}>
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
        if (!this.container)
            return;
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
            const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox');
            const skipInvalid = skipInvalidCheckbox?.checked || false;
            const skipDuplicates = skipDuplicatesCheckbox?.checked || false;
            const createMissing = createMissingCheckbox?.checked || false;
            const aggregateDuplicates = aggregateDuplicatesCheckbox?.checked || false;
            // Show loading
            showToast('Импорт данных...', 'info');
            // Encode file content to base64 (worker-based for large files)
            if (!this.fileContent) {
                throw new Error('File content is empty');
            }
            const fileContent = await this.encodeBase64(this.fileContent);
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
                aggregate_duplicates: aggregateDuplicates,
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
                showToast(`✅ Импорт завершён! Импортировано: ${result.imported_count}, Пропущено: ${result.skipped_count}, Ошибок: ${result.error_count}`, 'success', 5000);
                // Reload shopping list items FIRST (loads stale groups from Dexie)
                await this.listsManager.loadShoppingListItems(currentListId);
                // Overwrite with fresh data AFTER items load (fixes hierarchy tree)
                if (result.created_stores && result.created_stores.length > 0) {
                    debugLog('[CSVImporter] Reloading stores (after items load)...', result.created_stores);
                    await this.listsManager.loadStores();
                }
                if (result.created_product_groups && result.created_product_groups.length > 0) {
                    debugLog('[CSVImporter] Reloading product groups (after items load)...', result.created_product_groups);
                    await this.listsManager.loadProductGroups();
                }
                // Re-render items table (now with updated stores/productGroups cache)
                this.listsManager.renderItemsTable();
                // Refresh landing page counters AFTER render (total_items/completed_items/completion_percentage)
                if (typeof this.listsManager.loadShoppingLists === 'function') {
                    await this.listsManager.loadShoppingLists();
                }
                // Reinitialize Choices.js dropdowns for modal forms
                if (result.created_stores && result.created_stores.length > 0) {
                    this.listsManager.initStoreChoices();
                }
                if (result.created_product_groups && result.created_product_groups.length > 0) {
                    this.listsManager.initProductGroupChoices();
                }
                // Show created references in success toast
                const createdRefs = [];
                if (result.created_stores?.length > 0) {
                    createdRefs.push(`Магазины: ${result.created_stores.map((s) => s.name).join(', ')}`);
                }
                if (result.created_product_groups?.length > 0) {
                    createdRefs.push(`Группы: ${result.created_product_groups.map((g) => g.name).join(', ')}`);
                }
                if (createdRefs.length > 0) {
                    showToast(`📦 Создано:\n${createdRefs.join('\n')}`, 'info', 5000);
                }
                // Close import accordion
                const importWizardContainer = document.getElementById('import-wizard-container');
                if (importWizardContainer && typeof toggleImportWizard !== 'undefined' && !importWizardContainer.classList.contains('hidden')) {
                    toggleImportWizard(); // Use the new toggle function
                }
                // Reset wizard
                if (this.container)
                    this.container.innerHTML = '';
            }
            else {
                // Show errors
                const errorMessages = result.errors.slice(0, 5).map((e) => `Строка ${e.row_index + 1}: ${e.message}`).join('\n');
                showToast(`❌ Импорт завершён с ошибками (${result.error_count}):\n${errorMessages}`, 'error', 10000);
            }
        }
        catch (error) {
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
// Web Worker for CSV processing (Phase 3: Performance Optimization)
CSVImporter._workerWrapper = null;
// Make available globally
window.CSVImporter = CSVImporter;
debugLog('[CSVImporter] Module loaded');
export {};
//# sourceMappingURL=csvImporter.js.map