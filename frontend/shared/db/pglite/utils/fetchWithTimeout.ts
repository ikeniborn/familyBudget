/**
 * Fetch with timeout using AbortController
 *
 * Wraps standard fetch with automatic timeout and cancellation support.
 * Prevents indefinite hanging of network requests by enforcing a time limit.
 *
 * @param url - Request URL
 * @param options - Fetch options (RequestInit)
 * @param timeout - Timeout in milliseconds (default: 10000ms = 10s)
 * @returns Response object
 * @throws Error if request times out or fails
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout('/api/data', { credentials: 'include' }, 10000);
 * if (!response.ok) {
 *   throw new Error(`HTTP ${response.status}`);
 * }
 * const data = await response.json();
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
}
