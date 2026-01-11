/**
 * CSV Importer - Status Helper Utilities
 *
 * Validation status rendering helpers.
 *
 * Phase 3: ES Modules Migration (Step 7)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 1516-1569
 */

// ============================================================================
// Validation Status Helpers
// ============================================================================

/**
 * Get CSS class for row based on validation status.
 *
 * @param status - Validation status (error, warning, valid)
 * @returns Tailwind CSS class
 */
export function getRowValidationClass(status: string): string {
  switch (status) {
    case 'error': return 'bg-error/10';
    case 'warning': return 'bg-warning/10';
    default: return '';
  }
}

/**
 * Get badge HTML for validation status.
 *
 * @param status - Validation status (error, warning, valid)
 * @returns HTML badge string
 */
export function getStatusBadge(status: string): string {
  switch (status) {
    case 'error': return '<span class="badge badge-error badge-sm">❌</span>';
    case 'warning': return '<span class="badge badge-warning badge-sm">⚠️</span>';
    default: return '<span class="badge badge-success badge-sm">✓</span>';
  }
}

/**
 * Get human-readable field label with emoji.
 *
 * @param field - Field name (store, product_group, product_name, etc.)
 * @returns Localized label with emoji
 */
export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    'store': '🏪 Магазин',
    'product_group': '📦 Группа',
    'product_name': '🛒 Товар',
    'quantity': '📊 Кол-во',
    'unit': '📏 Ед.',
    'comment': '💬 Комментарий'
  };
  return labels[field] || field;
}
