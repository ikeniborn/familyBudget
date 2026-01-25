/**
 * API Helpers
 * Reusable functions for API calls and data parsing
 *
 * @module shared/utils/apiHelpers
 */

declare const debugLog: (...args: any[]) => void;

/**
 * Safely parse integer from FormData value
 * @param value - FormData value
 * @returns Parsed integer or null
 */
export function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value as string);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Safely parse float from FormData value
 * @param value - FormData value
 * @returns Parsed float or null
 */
export function parseFloatOrNull(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const parsed = parseFloat(value as string);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Generic API POST call with error handling
 * @param url - API endpoint URL
 * @param data - Request payload
 * @param context - Context name for logging (e.g., 'SaveFactModal')
 * @returns Response JSON data
 */
export async function postAPI<T = any>(
  url: string,
  data: any,
  context: string
): Promise<T> {
  debugLog(`[${context}] POST ${url}:`, data);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog(`[${context}] Response:`, result);

  return result;
}
