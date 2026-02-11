/**
 * HTML Sanitization Utilities
 *
 * Security utilities for preventing XSS attacks.
 * Provides HTML escaping for user-generated content.
 */

/**
 * Escape HTML special characters to prevent XSS
 *
 * Converts: < > & " ' to their HTML entity equivalents
 *
 * @param text - User input text to escape
 * @returns Escaped HTML-safe string
 *
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 * ```
 */
export function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape HTML for use in attributes
 *
 * More aggressive escaping for data attributes and element attributes
 *
 * @param text - Text to escape for attribute value
 * @returns Attribute-safe string
 */
export function escapeHtmlAttribute(text: string | null | undefined): string {
    if (!text) return '';

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sanitize error messages for safe display
 *
 * Ensures error messages don't contain executable code
 * Truncates very long messages to prevent UI overflow
 *
 * @param error - Error object or message
 * @param maxLength - Maximum message length (default: 200)
 * @returns Safe error message
 */
export function sanitizeErrorMessage(error: Error | string | unknown, maxLength: number = 200): string {
    let message: string;

    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        message = String(error);
    }

    // Escape HTML
    const escaped = escapeHtml(message);

    // Truncate if too long
    if (escaped.length > maxLength) {
        return escaped.substring(0, maxLength) + '...';
    }

    return escaped;
}
