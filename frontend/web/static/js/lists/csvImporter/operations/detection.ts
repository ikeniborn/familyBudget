/**
 * CSV Importer - Detection Operations
 *
 * Handles delimiter detection and automatic column mapping.
 *
 * Phase 3: ES Modules Migration (Step 3)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 411-458
 */

// ============================================================================
// Type Declarations
// ============================================================================

declare const debugLog: (...args: any[]) => void;

// ============================================================================
// Column Mapping Synonyms
// ============================================================================

/**
 * Field synonyms for automatic column mapping.
 * Maps target field names to possible column name variants (multilingual).
 */
export const FIELD_SYNONYMS: Record<string, string[]> = {
  'store': ['магазин', 'store', 'shop', 'место'],
  'product_group': ['группа', 'category', 'категория', 'group', 'продуктовая группа'],
  'product_name': ['товар', 'product', 'название', 'name', 'продукт', 'наименование'],
  'quantity': ['количество', 'qty', 'кол-во', 'count'],
  'unit': ['единица', 'unit', 'ед', 'мера'],
  'comment': ['комментарий', 'comment', 'note', 'примечание']
};

/**
 * Supported CSV delimiters (in priority order).
 */
export const SUPPORTED_DELIMITERS = [';', ',', '\t', '|'];

// ============================================================================
// Delimiter Detection
// ============================================================================

/**
 * Detect CSV delimiter from first line.
 * Uses simple heuristic: delimiter with max column count.
 *
 * @param firstLine - First line of CSV file
 * @returns Detected delimiter character
 */
export function detectDelimiter(firstLine: string): string {
  let maxCount = 0;
  let bestDelimiter = ';'; // Default fallback

  for (const delimiter of SUPPORTED_DELIMITERS) {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  debugLog('[CSVImporter] Detected delimiter:', bestDelimiter, `(${maxCount} columns)`);
  return bestDelimiter;
}

/**
 * Parse CSV first line into columns.
 *
 * @param firstLine - First line of CSV file
 * @param delimiter - CSV delimiter character
 * @returns Array of column names
 */
export function parseColumns(firstLine: string, delimiter: string): string[] {
  return firstLine.split(delimiter).map(col => col.trim());
}

// ============================================================================
// Automatic Column Mapping
// ============================================================================

/**
 * Automatically map CSV columns to target fields.
 * Uses synonym matching (case-insensitive, supports multiple languages).
 *
 * @param columns - Array of CSV column names
 * @returns Mapping object { csvColumn: targetField }
 */
export function autoMapColumns(columns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const column of columns) {
    const normalizedCol = column.toLowerCase().trim();
    let matched = false;

    // Try to match with synonyms
    for (const [field, fieldSynonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (fieldSynonyms.some(syn => normalizedCol.includes(syn.toLowerCase()))) {
        mapping[column] = field;
        matched = true;
        debugLog(`[CSVImporter] Auto-mapped "${column}" → "${field}"`);
        break;
      }
    }

    if (!matched) {
      mapping[column] = ''; // Unmapped
      debugLog(`[CSVImporter] Column "${column}" not auto-mapped`);
    }
  }

  return mapping;
}

/**
 * Analyze CSV file content and detect format.
 * Combines delimiter detection and column extraction.
 *
 * @param content - Raw CSV file content
 * @returns Detection result { delimiter, columns, rowCount }
 */
export function analyzeFileContent(content: string): { delimiter: string; columns: string[]; rowCount: number } {
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Detect delimiter from first line
  const firstLine = lines[0];
  const delimiter = detectDelimiter(firstLine);

  // Parse columns
  const columns = parseColumns(firstLine, delimiter);

  // Count rows (excluding header)
  const rowCount = lines.length - 1;

  debugLog('[CSVImporter] File analysis:', { delimiter, columns, rowCount });

  return { delimiter, columns, rowCount };
}

/**
 * Get target field display name (for UI).
 *
 * @param field - Target field name
 * @returns Human-readable field name (Russian)
 */
export function getFieldDisplayName(field: string): string {
  const displayNames: Record<string, string> = {
    'store': 'Магазин',
    'product_group': 'Группа товаров',
    'product_name': 'Название товара',
    'quantity': 'Количество',
    'unit': 'Единица измерения',
    'comment': 'Комментарий'
  };

  return displayNames[field] || field;
}

/**
 * Get required fields for CSV import.
 *
 * @returns Array of required field names
 */
export function getRequiredFields(): string[] {
  return ['store', 'product_group', 'product_name'];
}

/**
 * Get optional fields for CSV import.
 *
 * @returns Array of optional field names
 */
export function getOptionalFields(): string[] {
  return ['quantity', 'unit', 'comment'];
}
