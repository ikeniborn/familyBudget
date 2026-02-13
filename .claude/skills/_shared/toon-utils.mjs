/**
 * TOON Utilities for Family Budget Skills
 *
 * Simplified TOON conversion and token calculation utilities
 * for skill configuration optimization.
 *
 * TOON Format: Tab-Oriented Object Notation
 * - Arrays: items separated by tabs
 * - Objects: key-value pairs with tab separators
 * - Nested structures: handled recursively
 */

/**
 * Convert array to TOON format
 * @param {string} name - Array name
 * @param {Array} array - Array of objects
 * @param {Array<string>} fields - Field names in order
 * @returns {string} TOON formatted string
 */
export function arrayToToon(name, array, fields) {
  if (!array || array.length === 0) {
    return `${name}[0]{}:\n`;
  }

  // Header: array_name[count]{field1,field2,...}:
  const header = `${name}[${array.length}]{${fields.join(',')}}:`;

  // Rows: each row is tab-separated values
  const rows = array.map(item => {
    return fields.map(field => {
      const value = item[field];

      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      } else if (Array.isArray(value)) {
        // For arrays, join with | separator
        // Escape newlines and tabs in array elements
        return value.map(v => String(v).replace(/\n/g, '\\n').replace(/\t/g, '\\t')).join('|');
      } else if (typeof value === 'object') {
        // For objects, use JSON string (already escapes newlines)
        return JSON.stringify(value);
      } else {
        // For strings, escape newlines and tabs
        return String(value).replace(/\n/g, '\\n').replace(/\t/g, '\\t');
      }
    }).join('\t');
  }).join('\n');

  return `${header}\n${rows}`;
}

/**
 * Convert TOON string back to JSON array
 * @param {string} toonString - TOON formatted string
 * @returns {Object} Object with array key
 */
export function toonToJson(toonString) {
  const lines = toonString.trim().split('\n');
  if (lines.length === 0) return {};

  // Parse header: array_name[count]{field1,field2,...}:
  const headerMatch = lines[0].match(/^(\w+)\[(\d+)\]\{([^}]+)\}:$/);
  if (!headerMatch) {
    throw new Error('Invalid TOON header format');
  }

  const [, arrayName, count, fieldsStr] = headerMatch;
  const fields = fieldsStr.split(',');
  const expectedCount = parseInt(count, 10);

  // Parse rows
  const array = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length !== fields.length) {
      throw new Error(`Row ${i} has ${values.length} values, expected ${fields.length}`);
    }

    const obj = {};
    fields.forEach((field, idx) => {
      const value = values[idx];

      // Try to parse as JSON object/array
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          obj[field] = JSON.parse(value);
        } catch {
          obj[field] = value;
        }
      } else if (value.includes('|')) {
        // Array with | separator
        // Unescape newlines and tabs in array elements
        obj[field] = value.split('|').map(v => v.replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
      } else if (value === '') {
        obj[field] = null;
      } else if (!isNaN(value) && value !== '') {
        // Try to parse as number
        obj[field] = parseFloat(value);
      } else {
        // Unescape newlines and tabs in strings
        obj[field] = value.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      }
    });

    array.push(obj);
  }

  if (array.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} rows, got ${array.length}`);
  }

  return { [arrayName]: array };
}

/**
 * Calculate token savings for JSON vs TOON
 * @param {Object} data - Data object with arrays
 * @returns {Object} Stats with token counts and savings
 */
export function calculateTokenSavings(data) {
  // Simplified token estimation (4 chars ≈ 1 token)
  const jsonString = JSON.stringify(data, null, 2);
  const jsonSize = Buffer.byteLength(jsonString, 'utf8');
  const jsonTokens = Math.ceil(jsonSize / 4);

  // Generate TOON for all arrays in data
  let toonSize = 0;
  let toonString = '';

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0) {
      const fields = Object.keys(value[0]);
      const toon = arrayToToon(key, value, fields);
      toonString += toon + '\n';
      toonSize += Buffer.byteLength(toon, 'utf8');
    }
  }

  const toonTokens = Math.ceil(toonSize / 4);
  const savedTokens = jsonTokens - toonTokens;
  const savedPercent = jsonTokens > 0
    ? ((savedTokens / jsonTokens) * 100).toFixed(1) + '%'
    : '0%';

  return {
    jsonSize,
    jsonTokens,
    toonSize,
    toonTokens,
    savedTokens,
    savedPercent
  };
}

/**
 * Validate TOON string format
 * @param {string} toonString - TOON formatted string
 * @returns {Object} Validation result
 */
export function validateToon(toonString) {
  try {
    toonToJson(toonString);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
