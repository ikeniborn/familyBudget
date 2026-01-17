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
 * @version 2.1.0 (Shared logic refactor)
 */

/// <reference lib="webworker" />

import type {
  CSVWorkerRequest,
  CSVWorkerResponse,
  EncodeBase64Result,
  ParseCSVResult,
  ValidateRowsResult,
  DetectDelimiterResult,
  WorkerProgressMessage,
  WorkerWarningMessage,
  WorkerInitializedMessage,
} from './csvWorker.types';

import {
  encodeBase64,
  parseCSV,
  validateRows,
  detectDelimiter,
  DEFAULT_CHUNK_SIZE,
} from './csvWorker.logic';

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
// Message Handler
// ============================================================================

self.addEventListener('message', (event: MessageEvent<CSVWorkerRequest>) => {
  const request = event.data;
  const { id, action } = request;
  const startTime = performance.now();

  try {
    let result: unknown;

    switch (action) {
      case 'encodeBase64': {
        const chunkSize = request.options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
        result = encodeBase64(
          request.data.content,
          chunkSize,
          postProgress,
          postWarning
        ) as EncodeBase64Result;
        break;
      }

      case 'parseCSV': {
        result = parseCSV(
          request.data.content,
          request.options || {},
          postProgress
        ) as ParseCSVResult;
        break;
      }

      case 'validateRows': {
        result = validateRows(
          request.data.rows,
          request.data.schema || {},
          postProgress
        ) as ValidateRowsResult;
        break;
      }

      case 'detectDelimiter': {
        result = detectDelimiter(request.data.headerLine) as DetectDelimiterResult;
        break;
      }

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
  version: '2.1.0',
  timestamp: Date.now(),
};

self.postMessage(initMessage);
