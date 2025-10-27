/**
 * Date formatter utility for Family Budget WebApp.
 *
 * Handles conversion between user-friendly format (DD-MM-YYYY)
 * and API-required format (YYYY-MM-DD).
 */

class DateFormatter {
  /**
   * Convert user-friendly date (DD-MM-YYYY) to API format (YYYY-MM-DD).
   *
   * @param {string} displayDate - Date in DD-MM-YYYY format
   * @returns {string} Date in YYYY-MM-DD format
   *
   * @example
   * DateFormatter.formatForAPI('27-10-2025') // => '2025-10-27'
   */
  static formatForAPI(displayDate) {
    if (!displayDate) return '';

    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';

    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert API date (YYYY-MM-DD) to user-friendly format (DD-MM-YYYY).
   *
   * @param {string} isoDate - Date in YYYY-MM-DD format
   * @returns {string} Date in DD-MM-YYYY format
   *
   * @example
   * DateFormatter.formatForDisplay('2025-10-27') // => '27-10-2025'
   */
  static formatForDisplay(isoDate) {
    if (!isoDate) return '';

    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';

    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }

  /**
   * Get current date in DD-MM-YYYY format.
   *
   * @returns {string} Current date in DD-MM-YYYY format
   *
   * @example
   * DateFormatter.today() // => '27-10-2025'
   */
  static today() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Get current date in YYYY-MM-DD format (for API).
   *
   * @returns {string} Current date in YYYY-MM-DD format
   *
   * @example
   * DateFormatter.todayISO() // => '2025-10-27'
   */
  static todayISO() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Validate date format (DD-MM-YYYY).
   *
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid DD-MM-YYYY format
   *
   * @example
   * DateFormatter.isValidDisplayFormat('27-10-2025') // => true
   * DateFormatter.isValidDisplayFormat('2025-10-27') // => false
   */
  static isValidDisplayFormat(dateStr) {
    if (!dateStr) return false;

    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;

    const [day, month, year] = parts.map(Number);

    // Basic validation
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check if date is valid
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  }

  /**
   * Validate ISO date format (YYYY-MM-DD).
   *
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid YYYY-MM-DD format
   *
   * @example
   * DateFormatter.isValidISOFormat('2025-10-27') // => true
   * DateFormatter.isValidISOFormat('27-10-2025') // => false
   */
  static isValidISOFormat(dateStr) {
    if (!dateStr) return false;

    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;

    const [year, month, day] = parts.map(Number);

    // Basic validation
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check if date is valid
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  }

  /**
   * Format date for display with time.
   *
   * @param {Date|string} date - Date object or ISO string
   * @returns {string} Formatted date and time (DD.MM.YYYY HH:MM)
   *
   * @example
   * DateFormatter.formatDateTime(new Date('2025-10-27T15:30:00'))
   * // => '27.10.2025 15:30'
   */
  static formatDateTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  /**
   * Parse date from various formats to Date object.
   *
   * @param {string} dateStr - Date string (DD-MM-YYYY or YYYY-MM-DD)
   * @returns {Date|null} Parsed Date object or null if invalid
   *
   * @example
   * DateFormatter.parse('27-10-2025') // => Date object
   * DateFormatter.parse('2025-10-27') // => Date object
   */
  static parse(dateStr) {
    if (!dateStr) return null;

    let year, month, day;

    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;

      // Detect format by year position
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        [year, month, day] = parts.map(Number);
      } else {
        // DD-MM-YYYY
        [day, month, year] = parts.map(Number);
      }
    } else {
      return null;
    }

    const date = new Date(year, month - 1, day);

    // Validate
    if (date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day) {
      return null;
    }

    return date;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DateFormatter = DateFormatter;
}
