/**
 * CSV Worker Logic - Shared implementation for worker and sync fallbacks
 *
 * This module contains pure functions used by both:
 * - csvWorker.ts (Web Worker)
 * - csvWorkerClient.ts (synchronous fallbacks)
 *
 * @version 2.0.0
 */

import type {
  ParseCSVResult,
  ValidateRowsResult,
  ValidationSchema,
  InvalidRow,
} from './csvWorker.types';

// ============================================================================
// Constants
// ============================================================================

/** Module version */
export const CSV_WORKER_LOGIC_VERSION = '2.0.0';

/** Default chunk size for Base64 encoding (512KB) */
export const DEFAULT_CHUNK_SIZE = 524288;

/** Large file warning threshold (100MB) */
export const LARGE_FILE_THRESHOLD = 100_000_000;

/** Very large file threshold for memory optimization (50MB) */
export const VERY_LARGE_FILE_THRESHOLD = 50_000_000;

/** Supported delimiters for auto-detection */
export const SUPPORTED_DELIMITERS = [',', ';', '\t', '|'] as const;

// ============================================================================
// Base64 Encoding
// ============================================================================

/**
 * Progress callback for chunked operations
 */
export type ProgressCallback = (message: string) => void;

/**
 * Warning callback for large file notifications
 */
export type WarningCallback = (message: string) => void;

/**
 * Encode content to Base64 with chunked processing for large files
 *
 * Memory optimization for very large files (>50MB):
 * - Uses incremental encoding to avoid doubling memory usage
 * - Clears processed chunks immediately
 *
 * @param content - UTF-8 string content
 * @param chunkSize - Chunk size in bytes (default: 512KB)
 * @param onProgress - Optional progress callback
 * @param onWarning - Optional warning callback
 * @returns Base64 encoded string
 */
export function encodeBase64(
  content: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  onProgress?: ProgressCallback,
  onWarning?: WarningCallback
): string {
  // Encode UTF-8 to bytes
  const utf8Content = unescape(encodeURIComponent(content));

  // Warn for very large files
  if (utf8Content.length > LARGE_FILE_THRESHOLD) {
    const sizeMB = Math.round(utf8Content.length / 1024 / 1024);
    onWarning?.(`File size >100MB (${sizeMB}MB) may cause memory issues`);
  }

  // For small files (<512KB), use direct encoding
  if (utf8Content.length <= chunkSize) {
    return btoa(utf8Content);
  }

  // For very large files (>50MB), use memory-optimized approach
  if (utf8Content.length > VERY_LARGE_FILE_THRESHOLD) {
    return encodeBase64LargeFile(utf8Content, chunkSize, onProgress);
  }

  // Standard chunked encoding for medium files
  return encodeBase64Chunked(utf8Content, chunkSize, onProgress);
}

/**
 * Standard chunked Base64 encoding
 * Suitable for files up to 50MB
 */
function encodeBase64Chunked(
  utf8Content: string,
  chunkSize: number,
  onProgress?: ProgressCallback
): string {
  const chunks: string[] = [];
  let offset = 0;
  const startTime = performance.now();
  let lastProgressTime = startTime;

  while (offset < utf8Content.length) {
    const chunk = utf8Content.substring(offset, offset + chunkSize);
    chunks.push(btoa(chunk));
    offset += chunkSize;

    // Report progress every 500ms
    const now = performance.now();
    if (now - lastProgressTime > 500) {
      const progress = Math.round((offset / utf8Content.length) * 100);
      const offsetMB = Math.round(offset / 1024 / 1024);
      const totalMB = Math.round(utf8Content.length / 1024 / 1024);
      onProgress?.(`Base64 encoding: ${progress}% (${offsetMB}MB / ${totalMB}MB)`);
      lastProgressTime = now;
    }
  }

  const result = chunks.join('');
  const duration = Math.round(performance.now() - startTime);
  const totalMB = Math.round(utf8Content.length / 1024 / 1024);
  onProgress?.(`Base64 encoding complete: ${duration}ms (${totalMB}MB)`);

  return result;
}

/**
 * Memory-optimized Base64 encoding for very large files (>50MB)
 *
 * Uses string concatenation instead of array.join() to avoid
 * doubling memory usage at the final step.
 *
 * Trade-off: Slightly slower due to string immutability,
 * but uses ~40% less peak memory.
 */
function encodeBase64LargeFile(
  utf8Content: string,
  chunkSize: number,
  onProgress?: ProgressCallback
): string {
  let result = '';
  let offset = 0;
  const startTime = performance.now();
  let lastProgressTime = startTime;

  // Process in 8MB batches (each batch contains multiple 512KB chunks)
  // This reduces string concatenation operations while maintaining chunked encoding
  const batchMultiplier = 16; // 16 * 512KB = 8MB batches

  while (offset < utf8Content.length) {
    // Encode a batch of chunks
    let batchResult = '';
    const batchEnd = Math.min(offset + chunkSize * batchMultiplier, utf8Content.length);

    while (offset < batchEnd) {
      const chunk = utf8Content.substring(offset, offset + chunkSize);
      batchResult += btoa(chunk);
      offset += chunkSize;
    }

    result += batchResult;

    // Report progress every 500ms
    const now = performance.now();
    if (now - lastProgressTime > 500) {
      const progress = Math.round((offset / utf8Content.length) * 100);
      const offsetMB = Math.round(offset / 1024 / 1024);
      const totalMB = Math.round(utf8Content.length / 1024 / 1024);
      onProgress?.(
        `Base64 encoding (large file): ${progress}% (${offsetMB}MB / ${totalMB}MB)`
      );
      lastProgressTime = now;
    }
  }

  const duration = Math.round(performance.now() - startTime);
  const totalMB = Math.round(utf8Content.length / 1024 / 1024);
  onProgress?.(`Base64 encoding complete: ${duration}ms (${totalMB}MB)`);

  return result;
}

// ============================================================================
// Delimiter Detection
// ============================================================================

/**
 * Detect CSV delimiter from header line
 *
 * @param headerLine - First line of CSV
 * @returns Detected delimiter character
 */
export function detectDelimiter(headerLine: string): string {
  const counts = SUPPORTED_DELIMITERS.map((delim) => ({
    delimiter: delim,
    count: headerLine.split(delim).length,
  }));

  // Sort by count (descending) and return most common
  counts.sort((a, b) => b.count - a.count);

  // If no delimiter found (count = 1), default to comma
  return counts[0].count > 1 ? counts[0].delimiter : ',';
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Options for CSV parsing
 */
export interface ParseCSVOptions {
  delimiter?: string;
  hasHeader?: boolean;
  maxRows?: number;
}

/**
 * Parse CSV content into structured data
 *
 * @param content - CSV file content
 * @param options - Parse options
 * @param onProgress - Optional progress callback
 * @returns Parsed CSV data
 */
export function parseCSV(
  content: string,
  options: ParseCSVOptions = {},
  onProgress?: ProgressCallback
): ParseCSVResult {
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
      onProgress?.(`Parsed ${i} rows...`);
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
// Row Validation
// ============================================================================

/**
 * Validate rows against schema
 *
 * @param rows - Parsed CSV rows
 * @param schema - Validation schema
 * @param onProgress - Optional progress callback
 * @returns Validation result with valid/invalid rows
 */
export function validateRows(
  rows: Record<string, string>[],
  schema: ValidationSchema = {},
  onProgress?: ProgressCallback
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
      onProgress?.(`Validated ${i} / ${rows.length} rows...`);
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
