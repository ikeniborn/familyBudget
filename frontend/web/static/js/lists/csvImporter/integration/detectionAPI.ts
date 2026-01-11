/**
 * CSV Importer - Detection API Integration
 *
 * Handles server-side CSV format detection with client-side fallback.
 *
 * Phase 3: ES Modules Migration (Step 5)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 336-406
 */

import { setDetectionResult, getFileData } from '../core/stateManager';
import { encodeBase64 } from '../operations/fileProcessor';
import { detectDelimiter, parseColumns } from '../operations/detection';
import type { DetectionResult } from '../core/ImportState';

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Server-side Detection API
// ============================================================================

/**
 * Call backend API for CSV format auto-detection.
 * Detects delimiter, encoding, headers, and provides auto-mapping suggestions.
 *
 * @param fileContent - Base64-encoded CSV file content
 * @returns Detection result from backend
 */
export async function callDetectionAPI(fileContent: string): Promise<DetectionResult> {
  const response = await fetch('/api/v1/shopping-lists/import/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file_content: fileContent
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to analyze CSV file');
  }

  const apiResult = await response.json();

  // Transform API response (snake_case) to DetectionResult (camelCase)
  const result: DetectionResult = {
    delimiter: apiResult.delimiter,
    encoding: apiResult.encoding || 'utf-8',
    hasHeader: apiResult.has_header !== false,
    headers: apiResult.detected_columns || [],
    sampleRows: apiResult.sample_rows || [],
    rowCount: apiResult.total_rows || 0
  };

  debugLog('[CSVImporter] Server detection result:', result);

  return result;
}

// ============================================================================
// Client-side Detection Fallback
// ============================================================================

/**
 * Client-side CSV format detection (fallback when API fails).
 * Parses first line for delimiter detection and column extraction.
 *
 * @param content - Raw CSV file content
 * @returns Detection result with client-side analysis
 */
export function detectFormatClientSide(content: string): DetectionResult {
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    throw new Error('Empty CSV file');
  }

  // Detect delimiter from first line
  const delimiter = detectDelimiter(lines[0]);

  // Parse header row
  const header = parseColumns(lines[0], delimiter);

  // Parse sample rows (first 10 data rows)
  const sampleRows = lines.slice(1, 11).map(line => {
    const values = line.split(delimiter).map(v => v.trim());
    return Object.fromEntries(header.map((h, i) => [h, values[i] || '']));
  });

  const result: DetectionResult = {
    delimiter,
    encoding: 'utf-8',
    hasHeader: true,
    headers: header,
    sampleRows: sampleRows.map(row => Object.values(row)),
    rowCount: lines.length - 1
  };

  debugLog('[CSVImporter] Client-side detection result:', result);

  return result;
}

// ============================================================================
// Combined Detection with Fallback
// ============================================================================

/**
 * Detect CSV format with automatic fallback.
 * Tries server-side detection first, falls back to client-side on error.
 *
 * @returns Detection result (stored in state)
 */
export async function detectFormat(): Promise<DetectionResult> {
  const { content } = getFileData();

  if (!content) {
    throw new Error('File content is empty');
  }

  try {
    // Try server-side detection first
    const encodedContent = await encodeBase64(content);
    const result = await callDetectionAPI(encodedContent);

    // Store in state
    setDetectionResult(result);

    return result;

  } catch (error: any) {
    console.error('[CSVImporter] Server detection failed, using client-side fallback:', error);

    // Fallback to client-side detection
    const result = detectFormatClientSide(content);

    // Store in state
    setDetectionResult(result);

    return result;
  }
}

/**
 * Analyze file and update state.
 * Convenience wrapper for detectFormat() that handles errors.
 *
 * @returns Detection result
 */
export async function analyzeFile(): Promise<DetectionResult> {
  try {
    return await detectFormat();
  } catch (error: any) {
    console.error('[CSVImporter] Error analyzing file:', error);
    throw error;
  }
}
