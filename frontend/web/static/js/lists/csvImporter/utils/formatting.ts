/**
 * CSV Importer - Formatting Utilities
 *
 * String escaping and text formatting helpers.
 *
 * Phase 3: ES Modules Migration (Step 7)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts
 */

// ============================================================================
// HTML Escaping
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS.
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Pluralize Russian word based on count.
 * Handles Russian plural rules (1 = singular, 2-4 = few, 5+ = many).
 *
 * @param count - Number to pluralize for
 * @param one - Singular form (e.g., "строка")
 * @param few - Few form (e.g., "строки")
 * @param many - Many form (e.g., "строк")
 * @returns Correct plural form
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}
