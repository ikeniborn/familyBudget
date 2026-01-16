/**
 * CSV Worker Client - Type-safe wrapper for csvWorker communication
 *
 * Provides ergonomic async API for CSV processing via Web Worker.
 * Integrates with existing WorkerWrapper class (workerWrapper.js).
 *
 * @version 1.1.0 (Shared logic refactor + validateRowsSync)
 */

import type {
  ParseCSVResult,
  ValidateRowsResult,
  ValidationSchema,
} from './csvWorker.types';

import {
  encodeBase64 as encodeBase64Logic,
  parseCSV as parseCSVLogic,
  validateRows as validateRowsLogic,
  detectDelimiter as detectDelimiterLogic,
} from './csvWorker.logic';
import type { ParseCSVOptions } from './csvWorker.logic';

// Re-export types for consumers
export type { ParseCSVResult, ValidateRowsResult, ValidationSchema, ParseCSVOptions };

// ============================================================================
// WorkerWrapper Interface (from workerWrapper.js)
// ============================================================================

interface WorkerWrapperStatus {
  workerPath: string;
  enabled: boolean;
  isInitialized: boolean;
  isTerminated: boolean;
  pendingTasks: number;
  errorCount: number;
  version: string;
}

interface IWorkerWrapper {
  execute<T>(
    message: {
      action: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    },
    timeout?: number
  ): Promise<T>;
  terminate(): void;
  getStatus(): WorkerWrapperStatus;
}

interface IWorkerWrapperConstructor {
  new (
    scriptPath: string,
    options?: {
      idleTimeout?: number;
      debugMode?: boolean;
      enabled?: boolean;
    }
  ): IWorkerWrapper;
}

// ============================================================================
// Global Declarations
// ============================================================================

declare const WorkerWrapper: IWorkerWrapperConstructor | undefined;

declare function debugLog(...args: unknown[]): void;

declare function showToast(
  message: string,
  type?: 'success' | 'error' | 'info' | 'warning',
  duration?: number
): void;

// ============================================================================
// CSV Worker Client Class
// ============================================================================

export class CSVWorkerClient {
  private worker: IWorkerWrapper | null = null;
  private readonly workerPath: string;
  private readonly options: {
    idleTimeout: number;
    debugMode: boolean;
  };

  constructor(options?: {
    workerPath?: string;
    idleTimeout?: number;
    debugMode?: boolean;
  }) {
    this.workerPath =
      options?.workerPath || '/static/js/workers/csvWorker.min.js';
    this.options = {
      idleTimeout: options?.idleTimeout ?? 60000, // 60s for large CSV files
      debugMode:
        options?.debugMode ??
        (typeof window !== 'undefined' &&
          (window as unknown as { DEBUG_MODE?: boolean }).DEBUG_MODE === true),
    };
  }

  /**
   * Initialize worker lazily
   */
  private ensureWorker(): IWorkerWrapper {
    if (this.worker) {
      return this.worker;
    }

    if (typeof WorkerWrapper === 'undefined') {
      throw new Error('WorkerWrapper not available');
    }

    try {
      this.worker = new WorkerWrapper(this.workerPath, {
        idleTimeout: this.options.idleTimeout,
        debugMode: this.options.debugMode,
      });

      this.log('Worker initialized');
      return this.worker;
    } catch (error) {
      this.log('Failed to initialize worker:', error);
      throw error;
    }
  }

  /**
   * Debug logging
   */
  private log(...args: unknown[]): void {
    if (this.options.debugMode && typeof debugLog !== 'undefined') {
      debugLog('[CSVWorkerClient]', ...args);
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Encode content to Base64
   * Uses chunked processing for large files (>512KB)
   *
   * @param content - UTF-8 string content
   * @param chunkSize - Chunk size in bytes (default: 512KB)
   * @returns Base64 encoded string
   */
  async encodeBase64(content: string, chunkSize?: number): Promise<string> {
    const worker = this.ensureWorker();

    return worker.execute<string>({
      action: 'encodeBase64',
      data: { content },
      options: chunkSize ? { chunkSize } : undefined,
    });
  }

  /**
   * Parse CSV content
   * Automatically detects delimiter if not provided
   *
   * @param content - CSV file content
   * @param options - Parse options
   * @returns Parsed CSV data
   */
  async parseCSV(
    content: string,
    options?: {
      delimiter?: string;
      hasHeader?: boolean;
      maxRows?: number;
    }
  ): Promise<ParseCSVResult> {
    const worker = this.ensureWorker();

    return worker.execute<ParseCSVResult>({
      action: 'parseCSV',
      data: { content },
      options,
    });
  }

  /**
   * Validate rows against schema
   *
   * @param rows - Parsed CSV rows
   * @param schema - Validation schema
   * @returns Validation result with valid/invalid rows
   */
  async validateRows(
    rows: Record<string, string>[],
    schema?: ValidationSchema
  ): Promise<ValidateRowsResult> {
    const worker = this.ensureWorker();

    return worker.execute<ValidateRowsResult>({
      action: 'validateRows',
      data: { rows, schema },
    });
  }

  /**
   * Detect CSV delimiter from header line
   *
   * @param headerLine - First line of CSV
   * @returns Detected delimiter character
   */
  async detectDelimiter(headerLine: string): Promise<string> {
    const worker = this.ensureWorker();

    return worker.execute<string>({
      action: 'detectDelimiter',
      data: { headerLine },
    });
  }

  /**
   * Terminate worker and release resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.log('Worker terminated');
    }
  }

  /**
   * Check if worker is available and initialized
   */
  isAvailable(): boolean {
    if (typeof WorkerWrapper === 'undefined') {
      return false;
    }

    if (!this.worker) {
      return true; // Can be initialized
    }

    const status = this.worker.getStatus();
    return status.enabled && !status.isTerminated;
  }

  /**
   * Get worker status for debugging
   */
  getStatus(): WorkerWrapperStatus | null {
    return this.worker?.getStatus() ?? null;
  }
}

// ============================================================================
// Singleton Instance Export
// ============================================================================

let defaultInstance: CSVWorkerClient | null = null;

/**
 * Get default CSV Worker client instance (singleton)
 */
export function getCSVWorkerClient(): CSVWorkerClient {
  if (!defaultInstance) {
    defaultInstance = new CSVWorkerClient();
  }
  return defaultInstance;
}

/**
 * Create new CSV Worker client instance
 */
export function createCSVWorkerClient(
  options?: ConstructorParameters<typeof CSVWorkerClient>[0]
): CSVWorkerClient {
  return new CSVWorkerClient(options);
}

// ============================================================================
// Synchronous Fallback Functions (using shared logic)
// ============================================================================

/**
 * Synchronous Base64 encoding (fallback when worker unavailable)
 *
 * Uses memory-optimized chunking for large files (>50MB).
 *
 * @param content - UTF-8 string content
 * @param chunkSize - Optional chunk size override
 * @returns Base64 encoded string
 */
export function encodeBase64Sync(content: string, chunkSize?: number): string {
  return encodeBase64Logic(content, chunkSize);
}

/**
 * Synchronous delimiter detection (fallback when worker unavailable)
 *
 * @param headerLine - First line of CSV
 * @returns Detected delimiter character
 */
export function detectDelimiterSync(headerLine: string): string {
  return detectDelimiterLogic(headerLine);
}

/**
 * Synchronous CSV parsing (fallback when worker unavailable)
 *
 * @param content - CSV file content
 * @param options - Parse options
 * @returns Parsed CSV data
 */
export function parseCSVSync(
  content: string,
  options?: ParseCSVOptions
): ParseCSVResult {
  return parseCSVLogic(content, options);
}

/**
 * Synchronous row validation (fallback when worker unavailable)
 *
 * @param rows - Parsed CSV rows
 * @param schema - Validation schema
 * @returns Validation result with valid/invalid rows
 */
export function validateRowsSync(
  rows: Record<string, string>[],
  schema?: ValidationSchema
): ValidateRowsResult {
  return validateRowsLogic(rows, schema);
}
