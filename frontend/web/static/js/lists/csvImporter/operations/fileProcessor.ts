/**
 * CSV Importer - File Processing Operations
 *
 * Handles file reading, encoding, and Web Worker management.
 *
 * Phase 3: ES Modules Migration (Step 2)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 70-330
 */

import { setFileData, getWorkerWrapper, setWorkerWrapper } from '../core/stateManager';

// ============================================================================
// Type Declarations
// ============================================================================

interface IWorkerWrapper {
  execute(payload: any): Promise<any>;
}

interface IWorkerWrapperConstructor {
  new (scriptPath: string, options: any): IWorkerWrapper;
}

declare const showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
declare const WorkerWrapper: IWorkerWrapperConstructor;
declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Web Worker Management
// ============================================================================

/**
 * Initialize Web Worker for CSV processing.
 * Worker is used for Base64 encoding of large files (>1MB).
 *
 * Called automatically on first use.
 */
export function initializeWorker(): void {
  // Check if worker already initialized
  let workerWrapper = getWorkerWrapper();
  if (workerWrapper) {
    return;
  }

  // Check if WorkerWrapper is available
  if (typeof WorkerWrapper === 'undefined') {
    debugLog('[CSVImporter] WorkerWrapper not available');
    return;
  }

  try {
    workerWrapper = new WorkerWrapper('/static/js/workers/csvWorker.min.js', {
      idleTimeout: 60000,  // 60s for CSV (files may be large)
      debugMode: (window as any).DEBUG_MODE || false
    });

    setWorkerWrapper(workerWrapper);
    debugLog('[CSVImporter] Worker initialized successfully');
  } catch (error: unknown) {
    debugLog('[CSVImporter] Failed to initialize worker:', error);
    setWorkerWrapper(null);
  }
}

/**
 * Get worker wrapper instance (lazy initialization)
 */
export function getWorker(): any {
  let workerWrapper = getWorkerWrapper();

  if (!workerWrapper) {
    initializeWorker();
    workerWrapper = getWorkerWrapper();
  }

  return workerWrapper;
}

// ============================================================================
// Base64 Encoding
// ============================================================================

/**
 * Encode content to Base64 using Web Worker.
 * Falls back to synchronous encoding on error or for small files.
 *
 * @param content - UTF-8 string content
 * @returns Base64 encoded string
 */
export async function encodeBase64(content: string): Promise<string> {
  const contentSizeKB = Math.round(content.length / 1024);
  const startTime = performance.now();

  // For large files (>1MB), use worker
  if (content.length > 1_000_000) {
    const workerWrapper = getWorker();

    if (workerWrapper) {
      try {
        // Show initial progress
        if (typeof showToast !== 'undefined') {
          showToast(`Кодирование файла (${contentSizeKB}KB)...`, 'info', 1000);
        }

        const result = await workerWrapper.execute({
          action: 'encodeBase64',
          data: { content }
        });

        const duration = Math.round(performance.now() - startTime);
        if ((window as any).DEBUG_MODE) {
          debugLog(`[CSVImporter] Worker Base64 encoding: ${duration}ms (${contentSizeKB}KB)`);
        }

        return result;
      } catch (error: unknown) {
        debugLog('[CSVImporter] Worker Base64 encoding failed, using synchronous:', error);
        // Fall through to synchronous
      }
    }
  }

  // Synchronous fallback (original implementation)
  const result = btoa(unescape(encodeURIComponent(content)));
  const duration = Math.round(performance.now() - startTime);

  if ((window as any).DEBUG_MODE && duration > 100) {
    debugLog(`[CSVImporter] Synchronous Base64 encoding: ${duration}ms (${contentSizeKB}KB)`);
  }

  return result;
}

// ============================================================================
// File Reading
// ============================================================================

/**
 * Read file content as text.
 *
 * @param file - File object to read
 * @returns Promise resolving to file content
 */
export function readFileContent(file: File): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result || null);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ============================================================================
// File Selection Handler
// ============================================================================

/**
 * Handle file selection event.
 * Validates file type, reads content, and triggers analysis.
 *
 * @param event - File input change event
 * @param onSuccess - Callback when file is successfully loaded (file, content, navigate to next step)
 * @returns Promise that resolves when file is processed
 */
export async function handleFileSelect(
  event: Event,
  onSuccess: (file: File, content: string) => Promise<void>
): Promise<void> {
  const target = event.target as HTMLInputElement;
  if (!target?.files) return;

  const file = target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.name.endsWith('.csv')) {
    showToast('Пожалуйста, выберите CSV файл', 'error');
    return;
  }

  try {
    debugLog('[CSVImporter] Reading file:', file.name, `(${Math.round(file.size / 1024)}KB)`);

    // Read file content
    const rawContent = await readFileContent(file);

    if (typeof rawContent !== 'string') {
      throw new Error('File content is not a string');
    }

    // Store file data in state
    setFileData(file, rawContent);

    debugLog('[CSVImporter] File loaded successfully');

    // Show loading toast
    if (typeof showToast !== 'undefined') {
      showToast('Анализ файла...', 'info');
    }

    // Call success callback (analyzeFile + navigate to step 2)
    await onSuccess(file, rawContent);

  } catch (error: unknown) {
    debugLog('[CSVImporter] Error reading file:', error);
    showToast('Ошибка чтения файла', 'error');
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size in human-readable format.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate CSV file extension.
 *
 * @param fileName - File name to validate
 * @returns True if file has .csv extension
 */
export function validateCSVFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}
