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
 * Typed API error with FastAPI detail payload
 */
export class APIError extends Error {
  constructor(public status: number, public detail: string, message?: string) {
    super(message || `HTTP ${status}: ${detail}`);
    this.name = 'APIError';
  }
}

/**
 * Parse FastAPI error detail from Response body
 * Handles: string detail, array of {loc, msg} (422), or raw text fallback
 */
async function parseAPIErrorDetail(response: Response): Promise<string> {
  try {
    const errJson = await response.clone().json();
    const detail = errJson.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((e: any) => {
          const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .join('; ');
    }
    if (detail !== undefined) return JSON.stringify(detail);
    return JSON.stringify(errJson);
  } catch {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
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
    const detail = await parseAPIErrorDetail(response);
    throw new APIError(response.status, detail);
  }

  // Check if response is JSON before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const textContent = await response.text();
    const preview = textContent.substring(0, 200);
    throw new Error(`Expected JSON response, got ${contentType || 'unknown'}. Preview: ${preview}`);
  }

  const result = await response.json();
  debugLog(`[${context}] Response:`, result);

  return result;
}
