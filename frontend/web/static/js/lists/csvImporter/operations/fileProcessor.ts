/**
 * CSV Importer - File Processing Operations
 *
 * Handles file reading, encoding, and Web Worker management.
 *
 * Phase 3: ES Modules Migration (Step 2)
 * v2.0.0: Migrated to CSVWorkerClient (TypeScript worker)
 */

import { setFileData } from '../core/stateManager';
import {
  getCSVWorkerClient,
  encodeBase64Sync,
  type CSVWorkerClient,
} from '../../workers/csvWorkerClient';

// ============================================================================
// Type Declarations
// ============================================================================

declare const showToast: (
  message: string,
  type?: 'success' | 'error' | 'info' | 'warning',
  duration?: number
) => void;

declare const debugLog: (...args: unknown[]) => void;

// ============================================================================
// Module State
// ============================================================================

let csvWorkerClient: CSVWorkerClient | null = null;

// ============================================================================
// Web Worker Management
// ============================================================================

/**
 * Initialize CSV Worker client.
 * Client is used for Base64 encoding of large files (>1MB).
 *
 * Called automatically on first use via getClient().
 */
export function initializeWorker(): void {
  if (csvWorkerClient) {
    return;
  }

  try {
    csvWorkerClient = getCSVWorkerClient();
    debugLog('[CSVImporter] CSVWorkerClient initialized successfully');
  } catch (error: unknown) {
    debugLog('[CSVImporter] Failed to initialize CSVWorkerClient:', error);
    csvWorkerClient = null;
  }
}

/**
 * Get CSV worker client instance (lazy initialization)
 */
export function getClient(): CSVWorkerClient | null {
  if (!csvWorkerClient) {
    initializeWorker();
  }
  return csvWorkerClient;
}

/**
 * @deprecated Use getClient() instead
 * Legacy alias for backward compatibility
 */
export function getWorker(): CSVWorkerClient | null {
  return getClient();
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
    const client = getClient();

    if (client && client.isAvailable()) {
      try {
        // Show initial progress
        if (typeof showToast !== 'undefined') {
          showToast(`Кодирование файла (${contentSizeKB}KB)...`, 'info', 1000);
        }

        const result = await client.encodeBase64(content);

        const duration = Math.round(performance.now() - startTime);
        if (
          (window as unknown as { DEBUG_MODE?: boolean }).DEBUG_MODE === true
        ) {
          debugLog(
            `[CSVImporter] Worker Base64 encoding: ${duration}ms (${contentSizeKB}KB)`
          );
        }

        return result;
      } catch (error: unknown) {
        debugLog(
          '[CSVImporter] Worker Base64 encoding failed, using synchronous:',
          error
        );
        // Fall through to synchronous
      }
    }
  }

  // Synchronous fallback
  const result = encodeBase64Sync(content);
  const duration = Math.round(performance.now() - startTime);

  if (
    (window as unknown as { DEBUG_MODE?: boolean }).DEBUG_MODE === true &&
    duration > 100
  ) {
    debugLog(
      `[CSVImporter] Synchronous Base64 encoding: ${duration}ms (${contentSizeKB}KB)`
    );
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
export function readFileContent(
  file: File
): Promise<string | ArrayBuffer | null> {
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
    debugLog(
      '[CSVImporter] Reading file:',
      file.name,
      `(${Math.round(file.size / 1024)}KB)`
    );

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
