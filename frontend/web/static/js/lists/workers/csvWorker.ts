/**
 * CSV Worker - CSV processing and Base64 encoding in background thread
 *
 * Actions:
 * - encodeBase64: Chunked Base64 encoding (prevents stack overflow for large files)
 * - parseCSV: CSV parsing with delimiter detection
 * - validateRows: Row-level validation
 * - detectDelimiter: Delimiter auto-detection
 *
 * Performance target: 10MB file: 2-5s -> 100-500ms (80-90% faster)
 *
 * @version 2.0.0 (TypeScript migration)
 */

/// <reference lib="webworker" />

import type {
  CSVWorkerRequest,
  CSVWorkerResponse,
  EncodeBase64Result,
  ParseCSVResult,
  ValidateRowsResult,
  DetectDelimiterResult,
  ValidationSchema,
  InvalidRow,
  WorkerProgressMessage,
  WorkerWarningMessage,
  WorkerInitializedMessage,
} from './csvWorker.types';

// ============================================================================
// Worker Global Scope Type
// ============================================================================

declare const self: DedicatedWorkerGlobalScope;

// ============================================================================
// Helper: Post typed messages
// ============================================================================

function postProgress(message: string): void {
  const msg: WorkerProgressMessage = { type: 'progress', message };
  self.postMessage(msg);
}

function postWarning(message: string): void {
  const msg: WorkerWarningMessage = { type: 'warning', message };
  self.postMessage(msg);
}

function postSuccessResponse<T>(id: string, result: T, duration: number): void {
  const response: CSVWorkerResponse<T> = {
    id,
    success: true,
    result,
    error: null,
    duration,
    timestamp: Date.now(),
  };
  self.postMessage(response);
}

function postErrorResponse(
  id: string,
  error: { message: string; code: string; stack?: string },
  duration: number
): void {
  const response: CSVWorkerResponse<never> = {
    id,
    success: false,
    result: null,
    error,
    duration,
    timestamp: Date.now(),
  };
  self.postMessage(response);
}

// ============================================================================
// Action: encodeBase64
// ============================================================================

function encodeBase64(content: string, chunkSize = 524288): EncodeBase64Result {
  const startTime = performance.now();

  // Encode UTF-8 to bytes (same as btoa(unescape(encodeURIComponent())))
  const utf8Content = unescape(encodeURIComponent(content));

  // Warn for very large files
  if (utf8Content.length > 100_000_000) {
    postWarning(
      `File size >100MB (${Math.round(utf8Content.length / 1024 / 1024)}MB) may cause memory issues`
    );
  }

  // For small files (<512KB), use direct encoding
  if (utf8Content.length <= chunkSize) {
    const result = btoa(utf8Content);
    const duration = Math.round(performance.now() - startTime);

    if (duration > 100) {
      postProgress(
        `Base64 encoding: ${duration}ms (${Math.round(utf8Content.length / 1024)}KB)`
      );
    }

    return result;
  }

  // Chunked encoding for large files
  const chunks: string[] = [];
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
      postProgress(
        `Base64 encoding: ${progress}% (${Math.round(offset / 1024 / 1024)}MB / ${Math.round(utf8Content.length / 1024 / 1024)}MB)`
      );
      lastProgressTime = now;
    }
  }

  const result = chunks.join('');
  const duration = Math.round(performance.now() - startTime);

  postProgress(
    `Base64 encoding complete: ${duration}ms (${Math.round(utf8Content.length / 1024 / 1024)}MB)`
  );

  return result;
}

// ============================================================================
// Action: detectDelimiter
// ============================================================================

function detectDelimiter(headerLine: string): DetectDelimiterResult {
  const delimiters = [',', ';', '\t', '|'] as const;

  const counts = delimiters.map((delim) => ({
    delimiter: delim,
    count: headerLine.split(delim).length,
  }));

  // Sort by count (descending) and return most common
  counts.sort((a, b) => b.count - a.count);

  // If no delimiter found (count = 1), default to comma
  return counts[0].count > 1 ? counts[0].delimiter : ',';
}

// ============================================================================
// Action: parseCSV
// ============================================================================

interface ParseCSVOptions {
  delimiter?: string;
  hasHeader?: boolean;
  maxRows?: number;
}

function parseCSV(content: string, options: ParseCSVOptions = {}): ParseCSVResult {
  const startTime = performance.now();

  // Split into lines (handle \r\n and \n)
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length === 0) {
    throw new Error('Empty CSV file');
  }

  // Detect delimiter
  const delimiter = options.delimiter || detectDelimiter(lines[0]);

  // Parse header
  const hasHeader = options.hasHeader !== false;
  const header = hasHeader
    ? lines[0].split(delimiter).map((col) => col.trim())
    : lines[0].split(delimiter).map((_, i) => `Column${i + 1}`);

  // Parse rows
  const maxRows = options.maxRows || lines.length;
  const startRow = hasHeader ? 1 : 0;
  const endRow = Math.min(startRow + maxRows, lines.length);

  const rows: Record<string, string>[] = [];

  for (let i = startRow; i < endRow; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};

    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    rows.push(row);

    // Progress reporting for large files (every 1000 rows)
    if (i > 0 && i % 1000 === 0) {
      postProgress(`Parsed ${i} rows...`);
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
    duration,
  };
}

// ============================================================================
// Action: validateRows
// ============================================================================

function validateRows(
  rows: Record<string, string>[],
  schema: ValidationSchema = {}
): ValidateRowsResult {
  const startTime = performance.now();

  const validRows: Record<string, string>[] = [];
  const invalidRows: InvalidRow[] = [];
  const allErrors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: string[] = [];

    // Validate each column per schema
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
      allErrors.push(...rowErrors);
    } else {
      validRows.push(row);
    }

    // Progress reporting (every 1000 rows)
    if (i > 0 && i % 1000 === 0) {
      postProgress(`Validated ${i} / ${rows.length} rows...`);
    }
  }

  const duration = Math.round(performance.now() - startTime);

  return {
    validRows,
    invalidRows,
    errors: allErrors,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    duration,
  };
}

// ============================================================================
// Message Handler
// ============================================================================

self.addEventListener('message', (event: MessageEvent<CSVWorkerRequest>) => {
  const request = event.data;
  const { id, action } = request;
  const startTime = performance.now();

  try {
    let result: unknown;

    switch (action) {
      case 'encodeBase64':
        result = encodeBase64(request.data.content, request.options?.chunkSize);
        break;

      case 'parseCSV':
        result = parseCSV(request.data.content, request.options || {});
        break;

      case 'validateRows':
        result = validateRows(request.data.rows, request.data.schema || {});
        break;

      case 'detectDelimiter':
        result = detectDelimiter(request.data.headerLine);
        break;

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = action;
        throw new Error(`Unknown action: ${_exhaustive}`);
      }
    }

    postSuccessResponse(id, result, Math.round(performance.now() - startTime));
  } catch (error) {
    const err = error as Error;
    postErrorResponse(
      id,
      {
        message: err.message,
        code: 'WORKER_ERROR',
        stack: err.stack,
      },
      Math.round(performance.now() - startTime)
    );
  }
});

// ============================================================================
// Worker Initialization
// ============================================================================

const initMessage: WorkerInitializedMessage = {
  type: 'initialized',
  workerType: 'csv',
  version: '2.0.0',
  timestamp: Date.now(),
};

self.postMessage(initMessage);
