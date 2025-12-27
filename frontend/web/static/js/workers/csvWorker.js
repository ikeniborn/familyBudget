/**
 * CSV Worker - CSV processing and Base64 encoding in background thread
 *
 * Actions:
 * - encodeBase64: Chunked Base64 encoding (prevents stack overflow for large files)
 * - parseCSV: CSV parsing with delimiter detection
 * - validateRows: Row-level validation
 * - detectDelimiter: Delimiter auto-detection
 *
 * Performance target: 10MB file: 2-5s → 100-500ms (80-90% faster)
 *
 * @version 1.0.0
 */

/**
 * Encode string to Base64 with chunked processing.
 * Prevents stack overflow for large files (>10MB).
 *
 * @param {string} content - UTF-8 string content
 * @param {number} chunkSize - Chunk size in bytes (default: 512KB)
 * @returns {string} Base64 encoded string
 */
function encodeBase64(content, chunkSize = 524288) {
    const startTime = performance.now();

    // Encode UTF-8 to bytes (same as btoa(unescape(encodeURIComponent())))
    const utf8Content = unescape(encodeURIComponent(content));

    // Check file size for warning
    if (utf8Content.length > 100_000_000) {
        self.postMessage({
            type: 'warning',
            message: `File size >100MB (${Math.round(utf8Content.length / 1024 / 1024)}MB) may cause memory issues`
        });
    }

    // For small files (<512KB), use direct encoding
    if (utf8Content.length <= chunkSize) {
        const result = btoa(utf8Content);
        const duration = Math.round(performance.now() - startTime);

        if (duration > 100) {
            self.postMessage({
                type: 'progress',
                message: `Base64 encoding: ${duration}ms (${Math.round(utf8Content.length / 1024)}KB)`
            });
        }

        return result;
    }

    // Chunked encoding for large files
    const chunks = [];
    let offset = 0;
    let lastProgressTime = startTime;

    while (offset < utf8Content.length) {
        const chunk = utf8Content.substring(offset, offset + chunkSize);
        chunks.push(btoa(chunk));
        offset += chunkSize;

        // Report progress every 500ms
        const now = performance.now();
        if (now - lastProgressTime > 500) {
            const progress = Math.round((offset / utf8Content.length) * 100);
            self.postMessage({
                type: 'progress',
                message: `Base64 encoding: ${progress}% (${Math.round(offset / 1024 / 1024)}MB / ${Math.round(utf8Content.length / 1024 / 1024)}MB)`
            });
            lastProgressTime = now;
        }
    }

    const result = chunks.join('');
    const duration = Math.round(performance.now() - startTime);

    self.postMessage({
        type: 'progress',
        message: `Base64 encoding complete: ${duration}ms (${Math.round(utf8Content.length / 1024 / 1024)}MB)`
    });

    return result;
}

/**
 * Detect CSV delimiter from header line.
 * Tries common delimiters: comma, semicolon, tab, pipe.
 *
 * @param {string} headerLine - First line of CSV
 * @returns {string} Detected delimiter (default: ',')
 */
function detectDelimiter(headerLine) {
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delim => ({
        delimiter: delim,
        count: headerLine.split(delim).length
    }));

    // Sort by count (descending) and return most common
    counts.sort((a, b) => b.count - a.count);

    // If no delimiter found (count = 1), default to comma
    return counts[0].count > 1 ? counts[0].delimiter : ',';
}

/**
 * Parse CSV content with delimiter detection.
 * O(N) complexity where N = number of rows.
 *
 * @param {string} content - CSV file content
 * @param {Object} options - Parse options
 * @param {string} options.delimiter - Delimiter (auto-detected if not provided)
 * @param {boolean} options.hasHeader - First line is header (default: true)
 * @param {number} options.maxRows - Max rows to parse (default: all)
 * @returns {Object} { delimiter, header, rows, sampleRows }
 */
function parseCSV(content, options = {}) {
    const startTime = performance.now();

    // Split into lines (handle \r\n and \n)
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    if (lines.length === 0) {
        throw new Error('Empty CSV file');
    }

    // Detect delimiter
    const delimiter = options.delimiter || detectDelimiter(lines[0]);

    // Parse header
    const hasHeader = options.hasHeader !== false;
    const header = hasHeader
        ? lines[0].split(delimiter).map(col => col.trim())
        : lines[0].split(delimiter).map((_, i) => `Column${i + 1}`);

    // Parse rows
    const maxRows = options.maxRows || lines.length;
    const startRow = hasHeader ? 1 : 0;
    const endRow = Math.min(startRow + maxRows, lines.length);

    const rows = [];
    for (let i = startRow; i < endRow; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim());
        const row = Object.fromEntries(
            header.map((h, idx) => [h, values[idx] || ''])
        );
        rows.push(row);

        // Progress reporting for large files (every 1000 rows)
        if (i > 0 && i % 1000 === 0) {
            self.postMessage({
                type: 'progress',
                message: `Parsed ${i} rows...`
            });
        }
    }

    // Sample rows (first 10)
    const sampleRows = rows.slice(0, 10);

    const duration = Math.round(performance.now() - startTime);

    return {
        delimiter,
        header,
        rows,
        sampleRows,
        totalRows: lines.length - (hasHeader ? 1 : 0),
        parsedRows: rows.length,
        duration
    };
}

/**
 * Validate CSV rows against schema.
 * O(N*M) complexity where N = rows, M = columns.
 *
 * @param {Array} rows - Parsed CSV rows
 * @param {Object} schema - Validation schema { columnName: { required, type, pattern } }
 * @returns {Object} { validRows, invalidRows, errors }
 */
function validateRows(rows, schema = {}) {
    const startTime = performance.now();

    const validRows = [];
    const invalidRows = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowErrors = [];

        // Validate each column
        for (const [columnName, rules] of Object.entries(schema)) {
            const value = row[columnName];

            // Required check
            if (rules.required && (!value || value.trim() === '')) {
                rowErrors.push(`Column "${columnName}" is required`);
            }

            // Type check
            if (value && rules.type) {
                if (rules.type === 'number' && isNaN(Number(value))) {
                    rowErrors.push(`Column "${columnName}" must be a number`);
                }
                if (rules.type === 'date' && isNaN(Date.parse(value))) {
                    rowErrors.push(`Column "${columnName}" must be a valid date`);
                }
            }

            // Pattern check (regex)
            if (value && rules.pattern) {
                const regex = new RegExp(rules.pattern);
                if (!regex.test(value)) {
                    rowErrors.push(`Column "${columnName}" does not match pattern`);
                }
            }
        }

        if (rowErrors.length > 0) {
            invalidRows.push({ rowIndex: i, row, errors: rowErrors });
            errors.push(...rowErrors);
        } else {
            validRows.push(row);
        }

        // Progress reporting (every 1000 rows)
        if (i > 0 && i % 1000 === 0) {
            self.postMessage({
                type: 'progress',
                message: `Validated ${i} / ${rows.length} rows...`
            });
        }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
        validRows,
        invalidRows,
        errors,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        duration
    };
}

/**
 * Worker message handler
 */
self.addEventListener('message', (event) => {
    const { id, action, data, options, timestamp } = event.data;
    const startTime = performance.now();

    try {
        let result;

        switch (action) {
            case 'encodeBase64':
                result = encodeBase64(data.content, options?.chunkSize);
                break;

            case 'parseCSV':
                result = parseCSV(data.content, options || {});
                break;

            case 'validateRows':
                result = validateRows(data.rows, data.schema || {});
                break;

            case 'detectDelimiter':
                result = detectDelimiter(data.headerLine);
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Send success response
        self.postMessage({
            id,
            success: true,
            result,
            error: null,
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });

    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            success: false,
            result: null,
            error: {
                message: error.message,
                code: 'WORKER_ERROR',
                stack: error.stack
            },
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });
    }
});

// Worker initialization log (for debugging)
self.postMessage({
    type: 'initialized',
    workerType: 'csv',
    version: '1.0.0',
    timestamp: Date.now()
});
