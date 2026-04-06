// TypeScript Migration - budgetShared.ts
export {};

// Declare globals
declare const Choices: any;

/**
 * BudgetShared - Unified bundle for Family Budget shared modules
 *
 * Includes:
 * - DateFormatter: Date formatting utilities (DD.MM.YYYY ↔ YYYY-MM-DD)
 * - CalendarWidget: DaisyUI calendar picker (single/range mode)
 * - ChoicesCategoryTree: Category selector with hierarchy support
 *
 * Usage:
 * ```javascript
 * // Date formatting
 * const displayDate = BudgetShared.DateFormatter.formatForDisplay('2025-11-02');
 *
 * // Calendar widget
 * const calendar = new BudgetShared.CalendarWidget({
 *   inputElement: document.getElementById('date-input'),
 *   mode: 'single'
 * });
 *
 * // Category tree
 * const categoryTree = new BudgetShared.ChoicesCategoryTree('#article_id', {
 *   type: 'expense'
 * });
 * ```
 *
 * @version 1.0.0
 * @size ~56KB (unminified), ~25KB (minified), ~7KB (gzipped)
 */

(function(window) {
    'use strict';

    //=============================================================================
    // MODULE 1: DateFormatter
    // Date formatting utilities for converting between DD.MM.YYYY and YYYY-MM-DD
    //=============================================================================

class DateFormatter {
  // Russian month names (genitive case for dates)
  static RUSSIAN_MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  /**
   * Convert user-friendly date (DD.MM.YYYY) to API format (YYYY-MM-DD).
   *
   * @param {string} displayDate - Date in DD.MM.YYYY format
   * @returns {string} Date in YYYY-MM-DD format
   *
   * @example
   * DateFormatter.formatForAPI('27.10.2025') // => '2025-10-27'
   * DateFormatter.formatForAPI('7.2.2025') // => '2025-02-07'
   */
  static formatForAPI(displayDate: string): string {
    if (!displayDate) return '';

    const parts = displayDate.split('.');
    if (parts.length !== 3) return '';

    const [day, month, year] = parts;
    // Ensure leading zeros for day and month
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  }

  /**
   * Convert API date (YYYY-MM-DD) to user-friendly format (DD.MM.YYYY).
   *
   * @param {string} isoDate - Date in YYYY-MM-DD format
   * @returns {string} Date in DD.MM.YYYY format
   *
   * @example
   * DateFormatter.formatForDisplay('2025-10-27') // => '27.10.2025'
   */
  static formatForDisplay(isoDate: string) {
    if (!isoDate) return '';

    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';

    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }

  /**
   * Get current date in DD.MM.YYYY format.
   *
   * @returns {string} Current date in DD.MM.YYYY format
   *
   * @example
   * DateFormatter.today() // => '27.10.2025'
   */
  static today() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Get current date in YYYY-MM-DD format (for API).
   * Uses LOCAL timezone, not UTC.
   *
   * @returns {string} Current date in YYYY-MM-DD format
   *
   * @example
   * DateFormatter.todayISO() // => '2025-10-27'
   */
  static todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Validate date format (DD.MM.YYYY).
   *
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid DD.MM.YYYY format
   *
   * @example
   * DateFormatter.isValidDisplayFormat('27.10.2025') // => true
   * DateFormatter.isValidDisplayFormat('2025-10-27') // => false
   */
  static isValidDisplayFormat(dateStr: string): boolean {
    if (!dateStr) return false;

    const parts = dateStr.split('.');
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
  static isValidISOFormat(dateStr: string): boolean {
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
  static formatDateTime(date: Date | string): string {
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
   * @param {string} dateStr - Date string (DD.MM.YYYY or YYYY-MM-DD)
   * @returns {Date|null} Parsed Date object or null if invalid
   *
   * @example
   * DateFormatter.parse('27.10.2025') // => Date object
   * DateFormatter.parse('2025-10-27') // => Date object
   */
  static parse(dateStr: string) {
    if (!dateStr) return null;

    let year, month, day;

    if (dateStr.includes('.')) {
      // DD.MM.YYYY format
      const parts = dateStr.split('.');
      if (parts.length !== 3) return null;
      [day, month, year] = parts.map(Number);
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD format (API format)
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      [year, month, day] = parts.map(Number);
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

  /**
   * Convert API date (YYYY-MM-DD) to user-friendly format with Russian month name (ДД месяца ГГГГ).
   *
   * @param {string} isoDate - Date in YYYY-MM-DD format
   * @returns {string} Date in "ДД месяца ГГГГ" format
   *
   * @example
   * DateFormatter.formatForDisplayWithMonthName('2025-10-27') // => '27 октября 2025'
   */
  static formatForDisplayWithMonthName(isoDate: string): string {
    if (!isoDate) return '';

    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';

    const [year, month, day] = parts;
    const monthIndex = parseInt(month, 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) return '';

    // Remove leading zero from day
    const dayNum = parseInt(day, 10);

    return `${dayNum} ${this.RUSSIAN_MONTHS[monthIndex]} ${year}`;
  }

  /**
   * Convert user-friendly date with month name (ДД месяца ГГГГ) to API format (YYYY-MM-DD).
   *
   * @param {string} displayDate - Date in "ДД месяца ГГГГ" format
   * @returns {string} Date in YYYY-MM-DD format
   *
   * @example
   * DateFormatter.formatForAPIFromMonthName('27 октября 2025') // => '2025-10-27'
   */
  static formatForAPIFromMonthName(displayDate: string): string {
    if (!displayDate) return '';

    // Parse "27 октября 2025" format
    const parts = displayDate.trim().split(/\s+/);
    if (parts.length !== 3) return '';

    const [dayStr, monthName, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);

    // Find month index
    const monthIndex = this.RUSSIAN_MONTHS.findIndex(
      m => m.toLowerCase() === monthName.toLowerCase()
    );

    if (monthIndex === -1) return '';

    const month = monthIndex + 1;

    // Format to YYYY-MM-DD
    const monthPadded = String(month).padStart(2, '0');
    const dayPadded = String(day).padStart(2, '0');

    return `${year}-${monthPadded}-${dayPadded}`;
  }

  /**
   * Validate date format with Russian month name (ДД месяца ГГГГ).
   *
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid "ДД месяца ГГГГ" format
   *
   * @example
   * DateFormatter.isValidMonthNameFormat('27 октября 2025') // => true
   * DateFormatter.isValidMonthNameFormat('27-10-2025') // => false
   */
  static isValidMonthNameFormat(dateStr: string): boolean {
    if (!dateStr) return false;

    const parts = dateStr.trim().split(/\s+/);
    if (parts.length !== 3) return false;

    const [dayStr, monthName, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);

    // Validate year
    if (isNaN(year) || year < 1900 || year > 2100) return false;

    // Validate day
    if (isNaN(day) || day < 1 || day > 31) return false;

    // Validate month name
    const monthIndex = this.RUSSIAN_MONTHS.findIndex(
      m => m.toLowerCase() === monthName.toLowerCase()
    );
    if (monthIndex === -1) return false;

    const month = monthIndex + 1;

    // Check if date is valid
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  }

  /**
   * Get current date in "ДД месяца ГГГГ" format.
   *
   * @returns {string} Current date with Russian month name
   *
   * @example
   * DateFormatter.todayWithMonthName() // => '27 октября 2025'
   */
  static todayWithMonthName() {
    const now = new Date();
    const day = now.getDate();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();

    return `${day} ${this.RUSSIAN_MONTHS[monthIndex]} ${year}`;
  }

  /**
   * Set value for native date input (<input type="date">).
   * Native date input accepts YYYY-MM-DD format.
   *
   * @param {HTMLInputElement} inputElement - Date input element
   * @param {string} displayDate - Date in DD.MM.YYYY format
   *
   * @example
   * DateFormatter.setNativeDateInput(input, '02.11.2025')
   * // Sets input.value = '2025-11-02'
   */
  static setNativeDateInput(inputElement: HTMLInputElement | null, displayDate: string): void {
    if (!inputElement) return;

    if (displayDate && this.isValidDisplayFormat(displayDate)) {
      inputElement.value = this.formatForAPI(displayDate);
    } else {
      inputElement.value = '';
    }
  }

  /**
   * Get value from native date input as DD.MM.YYYY.
   * Native date input returns YYYY-MM-DD format.
   *
   * @param {HTMLInputElement} inputElement - Date input element
   * @returns {string} Date in DD.MM.YYYY format or empty string
   *
   * @example
   * DateFormatter.getNativeDateInput(input)
   * // input.value = '2025-11-02' → returns '02.11.2025'
   */
  static getNativeDateInput(inputElement: HTMLInputElement | null): string {
    if (!inputElement || !inputElement.value) return '';

    return this.formatForDisplay(inputElement.value);
  }

  /**
   * Initialize native date input with today's date.
   * Sets value in YYYY-MM-DD format (native format).
   *
   * @param {HTMLInputElement} inputElement - Date input element
   *
   * @example
   * DateFormatter.initNativeDateInput(input)
   * // Sets input.value = '2025-11-02' (today)
   */
  static initNativeDateInput(inputElement: HTMLInputElement | null): void {
    if (!inputElement) return;

    inputElement.value = this.todayISO();
  }

  // ============================================================================
  // Timezone-aware methods
  // ============================================================================

  /**
   * Convert UTC ISO datetime string to user's timezone for display.
   *
   * Uses the browser's Intl.DateTimeFormat for timezone conversion.
   * If no userTimezone specified, uses browser's local timezone.
   *
   * @param {string} utcIsoString - ISO datetime string in UTC (e.g., "2025-12-06T09:30:00Z")
   * @param {string|null} userTimezone - IANA timezone (e.g., "Europe/Moscow") or null for browser local
   * @returns {string} Formatted local datetime (DD.MM.YYYY HH:MM)
   *
   * @example
   * DateFormatter.toUserTimezone('2025-12-06T09:30:00Z', 'Europe/Moscow')
   * // => '06.12.2025 12:30' (UTC+3)
   *
   * DateFormatter.toUserTimezone('2025-12-06T09:30:00Z', null)
   * // => Uses browser's local timezone
   */
  static toUserTimezone(utcIsoString: string, userTimezone: string | null = null): string {
    if (!utcIsoString) return '';

    try {
      const date = new Date(utcIsoString);
      if (isNaN(date.getTime())) return '';

      const options: Intl.DateTimeFormatOptions = {
        timeZone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };

      // Format and convert to DD.MM.YYYY HH:MM
      const formatter = new Intl.DateTimeFormat('ru-RU', options);
      const parts = formatter.formatToParts(date);

      let day = '', month = '', year = '', hour = '', minute = '';
      for (const part of parts) {
        if (part.type === 'day') day = part.value;
        else if (part.type === 'month') month = part.value;
        else if (part.type === 'year') year = part.value;
        else if (part.type === 'hour') hour = part.value;
        else if (part.type === 'minute') minute = part.value;
      }

      return `${day}.${month}.${year} ${hour}:${minute}`;
    } catch (e) {
      console.error('DateFormatter.toUserTimezone error:', e);
      return '';
    }
  }

  /**
   * Convert UTC ISO date string to user's timezone for display (date only).
   *
   * @param {string} utcIsoString - ISO datetime string in UTC
   * @param {string|null} userTimezone - IANA timezone or null for browser local
   * @returns {string} Formatted local date (DD.MM.YYYY)
   *
   * @example
   * DateFormatter.dateToUserTimezone('2025-12-06T23:30:00Z', 'Europe/Moscow')
   * // => '07.12.2025' (next day in Moscow due to +3)
   */
  static dateToUserTimezone(utcIsoString: string, userTimezone: string | null = null): string {
    if (!utcIsoString) return '';

    try {
      const date = new Date(utcIsoString);
      if (isNaN(date.getTime())) return '';

      const options: Intl.DateTimeFormatOptions = {
        timeZone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      };

      const formatter = new Intl.DateTimeFormat('ru-RU', options);
      const parts = formatter.formatToParts(date);

      let day = '', month = '', year = '';
      for (const part of parts) {
        if (part.type === 'day') day = part.value;
        else if (part.type === 'month') month = part.value;
        else if (part.type === 'year') year = part.value;
      }

      return `${day}.${month}.${year}`;
    } catch (e) {
      console.error('DateFormatter.dateToUserTimezone error:', e);
      return '';
    }
  }

  /**
   * Get current date in user's timezone (DD.MM.YYYY).
   *
   * Unlike today() which uses browser's local timezone,
   * this method allows specifying a custom timezone.
   *
   * @param {string|null} userTimezone - IANA timezone or null for browser local
   * @returns {string} Current date in user's timezone (DD.MM.YYYY)
   *
   * @example
   * DateFormatter.todayInTimezone('Europe/Moscow')
   * // => '06.12.2025' (current date in Moscow)
   */
  static todayInTimezone(userTimezone = null) {
    return this.dateToUserTimezone(new Date().toISOString(), userTimezone);
  }

  /**
   * Get current date in user's timezone (YYYY-MM-DD for API).
   *
   * @param {string|null} userTimezone - IANA timezone or null for browser local
   * @returns {string} Current date in API format (YYYY-MM-DD)
   *
   * @example
   * DateFormatter.todayISOInTimezone('Europe/Moscow')
   * // => '2025-12-06'
   */
  static todayISOInTimezone(userTimezone = null) {
    const displayDate = this.todayInTimezone(userTimezone);
    return this.formatForAPI(displayDate);
  }

  /**
   * Convert local datetime input to UTC ISO string for API.
   *
   * Parses a local datetime string (DD.MM.YYYY HH:MM) in the specified
   * timezone and converts it to UTC ISO string.
   *
   * Note: This is a simplified implementation. For production use with
   * complex DST handling, consider using libraries like Luxon or date-fns-tz.
   *
   * @param {string} localDatetime - Local datetime in "DD.MM.YYYY HH:MM" format
   * @param {string|null} userTimezone - IANA timezone the input is in
   * @returns {string|null} UTC ISO string or null if invalid
   *
   * @example
   * DateFormatter.toUtcForApi('06.12.2025 12:30', 'Europe/Moscow')
   * // => '2025-12-06T09:30:00.000Z' (Moscow UTC+3)
   */
  static toUtcForApi(localDatetime: string, userTimezone: string | null = null): string | null {
    if (!localDatetime) return null;

    try {
      // Parse DD.MM.YYYY HH:MM
      const match = localDatetime.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
      if (!match) return null;

      const [, day, month, year, hour, minute] = match;

      // Create date string in a format that browsers can parse with timezone
      // Using the ISO-like format: YYYY-MM-DDTHH:MM:SS
      const dateStr = `${year}-${month}-${day}T${hour}:${minute}:00`;

      // For timezone conversion, we need to know the offset
      // This is a simplified approach - create a date and calculate offset
      const localDate = new Date(dateStr);

      if (userTimezone) {
        // Get the offset for the specified timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          timeZoneName: 'longOffset'
        });

        // Create a reference date at the same instant in UTC
        // and find the offset difference
        const parts = formatter.formatToParts(localDate);
        const tzPart = parts.find(p => p.type === 'timeZoneName');

        if (tzPart) {
          // Parse offset like "GMT+03:00" or "GMT-05:00"
          const offsetMatch = tzPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);
          if (offsetMatch) {
            const [, sign, hours, minutes] = offsetMatch;
            const offsetMinutes = (parseInt(hours) * 60 + parseInt(minutes)) * (sign === '+' ? 1 : -1);

            // Subtract offset to get UTC
            const utcDate = new Date(localDate.getTime() - offsetMinutes * 60 * 1000);
            return utcDate.toISOString();
          }
        }
      }

      // Fallback: use browser's interpretation
      return localDate.toISOString();
    } catch (e) {
      console.error('DateFormatter.toUtcForApi error:', e);
      return null;
    }
  }

  /**
   * Format datetime with timezone for display (includes timezone indicator).
   *
   * @param {Date|string} date - Date object or ISO string
   * @param {string|null} userTimezone - IANA timezone or null for browser local
   * @returns {string} Formatted date and time with timezone (DD.MM.YYYY HH:MM (TZ))
   *
   * @example
   * DateFormatter.formatDateTimeWithTz('2025-12-06T09:30:00Z', 'Europe/Moscow')
   * // => '06.12.2025 12:30 (MSK)'
   */
  static formatDateTimeWithTz(date: Date | string, userTimezone: string | null = null): string {
    if (!date) return '';

    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';

      const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const options: Intl.DateTimeFormatOptions = {
        timeZone: tz,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      };

      const formatter = new Intl.DateTimeFormat('ru-RU', options);
      const parts = formatter.formatToParts(d);

      let day = '', month = '', year = '', hour = '', minute = '', tzName = '';
      for (const part of parts) {
        if (part.type === 'day') day = part.value;
        else if (part.type === 'month') month = part.value;
        else if (part.type === 'year') year = part.value;
        else if (part.type === 'hour') hour = part.value;
        else if (part.type === 'minute') minute = part.value;
        else if (part.type === 'timeZoneName') tzName = part.value;
      }

      return `${day}.${month}.${year} ${hour}:${minute} (${tzName})`;
    } catch (e) {
      console.error('DateFormatter.formatDateTimeWithTz error:', e);
      return '';
    }
  }

  /**
   * Get browser's current timezone name (IANA format).
   *
   * @returns {string} Browser's timezone (e.g., "Europe/Moscow")
   *
   * @example
   * DateFormatter.getBrowserTimezone()
   * // => 'Europe/Moscow'
   */
  static getBrowserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}


    //=============================================================================
    // MODULE 2: CalendarWidget
    // DaisyUI calendar picker with single/range mode support
    //=============================================================================

class CalendarWidget {
  // Russian month names (nominative case for headers)
  static MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Russian day names (short)
  static DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Instance properties
  mode: 'single' | 'range';
  triggerContainer: string | null;
  onSelect: Function;
  minDate: Date | null;
  maxDate: Date | null;
  inputElement!: HTMLInputElement | null;
  selectedDate!: Date | null;
  startInputElement!: HTMLInputElement | null;
  endInputElement!: HTMLInputElement | null;
  startDate!: Date | null;
  endDate!: Date | null;
  selectingEnd!: boolean;
  currentMonth: number;
  currentYear: number;
  isOpen: boolean;
  calendarElement: HTMLElement | null;
  triggerButton: HTMLElement | null;
  triggerButtons: HTMLElement[];
  _isInsideDialog?: boolean;
  _originalParent?: HTMLElement | null;

  /**
   * @param {Object} options - Configuration options
   * @param {HTMLElement} [options.inputElement] - Input element for single date picker
   * @param {HTMLElement} [options.startInputElement] - Start date input for range picker
   * @param {HTMLElement} [options.endInputElement] - End date input for range picker
   * @param {string} [options.mode='single'] - Picker mode: 'single' or 'range'
   * @param {string} [options.triggerContainer] - CSS selector for custom trigger button container (range mode only)
   * @param {Function} [options.onSelect] - Callback when date is selected
   * @param {Date} [options.defaultDate] - Default selected date
   * @param {Date} [options.minDate] - Minimum selectable date
   * @param {Date} [options.maxDate] - Maximum selectable date
   */
  constructor(options: any) {
    this.mode = options.mode || 'single';
    this.triggerContainer = options.triggerContainer || null;
    this.onSelect = options.onSelect || (() => {});
    this.minDate = options.minDate || null;
    this.maxDate = options.maxDate || null;

    // Single date picker
    if (this.mode === 'single') {
      this.inputElement = options.inputElement;
      if (!this.inputElement) {
        throw new Error('CalendarWidget: inputElement is required for single mode');
      }
      this.selectedDate = options.defaultDate || null;
    }

    // Range picker
    if (this.mode === 'range') {
      this.startInputElement = options.startInputElement;
      this.endInputElement = options.endInputElement;
      if (!this.startInputElement || !this.endInputElement) {
        throw new Error('CalendarWidget: startInputElement and endInputElement are required for range mode');
      }
      this.startDate = null;
      this.endDate = null;
      this.selectingEnd = false; // Track if selecting end date
    }

    // Calendar state
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.isOpen = false;

    // DOM elements
    this.calendarElement = null;
    this.triggerButton = null; // First button (backward compatibility)
    this.triggerButtons = []; // All buttons (for click outside detection)

    this._init();
  }

  /**
   * Initialize calendar widget
   * @private
   */
  _init() {
    this._createTriggerButton();
    this._createCalendarElement();
    this._attachEventListeners();

    // Parse existing date from input
    if (this.mode === 'single' && this.inputElement?.value) {
      const parsed = DateFormatter.parse(this.inputElement.value);
      if (parsed) {
        this.selectedDate = parsed;
        this.currentMonth = parsed.getMonth();
        this.currentYear = parsed.getFullYear();
      }
    }

    if (this.mode === 'range') {
      if (this.startInputElement?.value) {
        const parsed = DateFormatter.parse(this.startInputElement.value);
        if (parsed) this.startDate = parsed;
      }
      if (this.endInputElement?.value) {
        const parsed = DateFormatter.parse(this.endInputElement.value);
        if (parsed) this.endDate = parsed;
      }
    }
  }

  /**
   * Create calendar icon button next to input
   * @private
   */
  _createTriggerButton() {
    if (this.mode === 'single') {
      // Single mode: create one button for inputElement
      this._createSingleButton(this.inputElement);
    } else {
      // Range mode: check if custom trigger container is specified
      if (this.triggerContainer) {
        // Custom trigger container - create ONE button in specified container
        this._createCustomTriggerButton();
      } else {
        // Default behavior: create buttons for BOTH startInputElement and endInputElement
        this._createSingleButton(this.startInputElement);
        this._createSingleButton(this.endInputElement);
      }
    }
  }

  /**
   * Create custom trigger button in specified container (range mode only)
   * @private
   */
  _createCustomTriggerButton() {
    if (!this.triggerContainer) return;
    const container = document.querySelector(this.triggerContainer);
    if (!container) {
      console.warn(`CalendarWidget: triggerContainer "${this.triggerContainer}" not found, falling back to default buttons`);
      this._createSingleButton(this.startInputElement);
      this._createSingleButton(this.endInputElement);
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost';
    button.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `;
    button.setAttribute('aria-label', 'Открыть календарь');

    // Store reference
    this.triggerButton = button;
    this.triggerButtons.push(button);

    // Append to container
    container.appendChild(button);

    // Add click event to open calendar
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.open();
    });
  }

  /**
   * Create a single calendar button for an input element
   * @private
   */
  _createSingleButton(targetInput: HTMLInputElement | null) {
    // Create button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-sm absolute right-2 top-1/2 -translate-y-1/2';
    button.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `;
    button.setAttribute('aria-label', 'Открыть календарь');

    // Store reference to first button (for backward compatibility)
    if (!this.triggerButton) {
      this.triggerButton = button;
    }

    // Store all buttons for click outside detection
    this.triggerButtons.push(button);

    // Wrap input in relative container if not already wrapped
    if (!targetInput) return;
    const parent = targetInput.parentElement;
    if (!parent) return;
    if (!parent.classList.contains('relative')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative flex-1';
      // Transfer flex-1 from input to wrapper if present
      if (targetInput.classList.contains('flex-1')) {
        targetInput.classList.remove('flex-1');
        targetInput.classList.add('w-full');
      }
      parent.insertBefore(wrapper, targetInput);
      wrapper.appendChild(targetInput);
      wrapper.appendChild(button);
    } else {
      parent.appendChild(button);
    }

    // Add click event to open calendar
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.open();
    });
  }

  /**
   * Create calendar dropdown element
   * @private
   */
  _createCalendarElement() {
    this.calendarElement = document.createElement('div');
    this.calendarElement.className = 'calendar-widget fixed shadow-lg rounded-lg bg-base-100 border border-base-300';
    this.calendarElement.style.width = '320px';
    // Very high z-index to ensure calendar appears above all other elements
    // NOTE: HTML5 <dialog> uses top layer which is above any z-index
    // When inside dialog, calendar is moved into .modal-box with absolute positioning
    this.calendarElement.style.position = 'fixed'; // Explicit fixed positioning (Tailwind 'fixed' class may not load in time)
    this.calendarElement.style.zIndex = '9999';
    this.calendarElement.style.visibility = 'hidden'; // Hidden but occupies space (for getBoundingClientRect)
    this.calendarElement.style.opacity = '0'; // Invisible
    this.calendarElement.style.transition = 'opacity 0.15s ease-out'; // Smooth appearance

    // Append to body for fixed positioning
    // Will be moved into dialog's .modal-box if input is inside <dialog> (see _moveToDialog)
    document.body.appendChild(this.calendarElement);

    this._render();
  }

  /**
   * Render calendar UI
   * @private
   */
  _render() {
    const html = `
      <div class="p-4">
        <!-- Header: Month/Year navigation -->
        <div class="flex items-center justify-between mb-4">
          <button type="button" class="btn btn-ghost btn-sm btn-circle" data-action="prev-month" aria-label="Предыдущий месяц">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div class="flex items-center gap-2">
            <select class="select select-bordered" data-action="select-month" aria-label="Выбрать месяц">
              ${CalendarWidget.MONTH_NAMES.map((name, i) =>
                `<option value="${i}" ${i === this.currentMonth ? 'selected' : ''}>${name}</option>`
              ).join('')}
            </select>

            <select class="select select-bordered" data-action="select-year" aria-label="Выбрать год">
              ${this._generateYearOptions()}
            </select>
          </div>

          <button type="button" class="btn btn-ghost btn-sm btn-circle" data-action="next-month" aria-label="Следующий месяц">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Day names header -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          ${CalendarWidget.DAY_NAMES.map(day =>
            `<div class="text-center text-xs font-medium text-base-content/60 py-1">${day}</div>`
          ).join('')}
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-1" data-calendar-grid>
          ${this._generateCalendarDays()}
        </div>

        <!-- Footer: Quick actions -->
        <div class="flex gap-2 mt-4 pt-4 border-t border-base-300">
          <button type="button" class="btn btn-sm btn-ghost flex-1" data-action="today">
            Сегодня
          </button>
          ${this.mode === 'range' ? `
            <button type="button" class="btn btn-sm btn-ghost flex-1" data-action="clear-range">
              Очистить
            </button>
          ` : ''}
          <button type="button" class="btn btn-sm btn-primary flex-1" data-action="close">
            Закрыть
          </button>
        </div>
      </div>
    `;

    if (this.calendarElement) {
      this.calendarElement.innerHTML = html;
    }
  }

  /**
   * Generate year options for dropdown
   * @private
   */
  _generateYearOptions() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear + 10;

    let options = '';
    for (let year = startYear; year <= endYear; year++) {
      options += `<option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>`;
    }
    return options;
  }

  /**
   * Generate calendar day cells
   * @private
   */
  _generateCalendarDays() {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);

    // Get first day of week (Monday = 0, Sunday = 6)
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Convert to Mon=0, Sun=6

    const daysInMonth = lastDay.getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';

    // Empty cells before month start
    for (let i = 0; i < firstDayOfWeek; i++) {
      html += '<div class="aspect-square"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      date.setHours(0, 0, 0, 0);

      const isToday = date.getTime() === today.getTime();
      const isDisabled = this._isDateDisabled(date);
      const isSelected = this._isDateSelected(date);
      const isInRange = this._isDateInRange(date);
      const isRangeBoundary = this._isRangeBoundary(date);

      let btnClass = 'btn btn-sm btn-ghost w-full aspect-square p-0';
      if (isToday) btnClass += ' border border-primary';
      if (isSelected) btnClass += ' btn-primary';
      if (isRangeBoundary) btnClass += ' border-2 border-error'; // Red border for range boundaries
      if (isInRange && !isSelected) btnClass += ' bg-range-highlight';
      if (isDisabled) btnClass += ' btn-disabled opacity-30';

      html += `
        <button
          type="button"
          class="${btnClass}"
          data-date="${this._formatDateISO(date)}"
          ${isDisabled ? 'disabled' : ''}
          aria-label="${day} ${CalendarWidget.MONTH_NAMES[this.currentMonth]} ${this.currentYear}"
        >
          ${day}
        </button>
      `;
    }

    return html;
  }

  /**
   * Check if date is disabled
   * @private
   */
  _isDateDisabled(date: Date): boolean {
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;
    return false;
  }

  /**
   * Check if date is selected
   * @private
   */
  _isDateSelected(date: Date): boolean {
    if (this.mode === 'single') {
      return !!(this.selectedDate && date.getTime() === this.selectedDate.getTime());
    }
    if (this.mode === 'range') {
      const startMatch = !!(this.startDate && date.getTime() === this.startDate.getTime());
      const endMatch = !!(this.endDate && date.getTime() === this.endDate.getTime());
      return startMatch || endMatch;
    }
    return false;
  }

  /**
   * Check if date is in selected range
   * @private
   */
  _isDateInRange(date: Date): boolean {
    if (this.mode !== 'range' || !this.startDate || !this.endDate) return false;
    return date > this.startDate && date < this.endDate;
  }

  /**
   * Check if date is a range boundary (start or end date)
   * @private
   */
  _isRangeBoundary(date: Date): boolean {
    if (this.mode !== 'range') return false;
    const startMatch = !!(this.startDate && date.getTime() === this.startDate.getTime());
    const endMatch = !!(this.endDate && date.getTime() === this.endDate.getTime());
    return startMatch || endMatch;
  }

  /**
   * Format date to ISO string (YYYY-MM-DD)
   * @private
   */
  _formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    // Note: Trigger button click listeners are now added in _createSingleButton()
    // to support multiple buttons in range mode

    // Calendar actions (event delegation)
    this.calendarElement?.addEventListener('click', (e) => {
      // CRITICAL: Stop propagation to prevent DaisyUI modal backdrop from closing
      e.stopPropagation();

      const target = (e.target as HTMLElement)?.closest('[data-action]') as HTMLElement | null;
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'prev-month':
          this.previousMonth();
          break;
        case 'next-month':
          this.nextMonth();
          break;
        case 'today':
          this.selectToday();
          break;
        case 'clear-range':
          this.clearRange();
          break;
        case 'close':
          this.applyAndClose();
          break;
      }
    });

    // Month/Year dropdowns
    this.calendarElement?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;

      if (target?.dataset.action === 'select-month') {
        this.currentMonth = parseInt(target.value);
        this._render();
      }

      if (target?.dataset.action === 'select-year') {
        this.currentYear = parseInt(target.value);
        this._render();
      }
    });

    // Date selection
    this.calendarElement?.addEventListener('click', (e) => {
      // CRITICAL: Stop propagation to prevent DaisyUI modal backdrop from closing
      e.stopPropagation();

      const dateButton = (e.target as HTMLElement)?.closest('[data-date]') as HTMLButtonElement | null;
      if (!dateButton || dateButton.disabled) return;

      const dateStr = dateButton.dataset.date;
      const date = new Date(dateStr + 'T00:00:00'); // Parse as local time

      this._handleDateSelection(date);
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      // Check if click is inside calendar
      if (this.calendarElement?.contains(e.target as Node)) return;

      // Check if click is on any trigger button
      const clickedButton = this.triggerButtons.some(btn => btn.contains(e.target as Node));
      if (clickedButton) return;

      // Range mode: don't close on outside click (user must click "Закрыть" button)
      if (this.mode === 'range') return;

      // Single mode: close calendar on outside click
      this.close();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        this.close();
        e.preventDefault();
      }
    });

    // Allow manual input
    if (this.mode === 'single' && this.inputElement) {
      this.inputElement.addEventListener('blur', () => {
        const value = this.inputElement?.value || '';
        if (DateFormatter.isValidDisplayFormat(value)) {
          const date = DateFormatter.parse(value);
          if (date) {
            this.selectedDate = date;
            this.currentMonth = date.getMonth();
            this.currentYear = date.getFullYear();
          }
        }
      });
    }
  }

  /**
   * Handle date selection
   * @private
   */
  _handleDateSelection(date: Date): void {
    if (this.mode === 'single') {
      this.selectedDate = date;
      const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
      if (this.inputElement) {
        this.inputElement.value = displayDate;
      }
      this.onSelect(displayDate);
      this.close();
    }

    if (this.mode === 'range') {
      if (!this.startDate || (this.startDate && this.endDate)) {
        // Start new range
        this.startDate = date;
        this.endDate = null;
        this.selectingEnd = true;
        const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
        if (this.startInputElement) {
          this.startInputElement.value = displayDate;
        }
        if (this.endInputElement) {
          this.endInputElement.value = '';
        }
        this._render();
      } else {
        // Select end date
        if (date < this.startDate) {
          // Swap if end < start
          this.endDate = this.startDate;
          this.startDate = date;
        } else {
          this.endDate = date;
        }

        const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
        const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
        if (this.startInputElement) {
          this.startInputElement.value = startDisplay;
        }
        if (this.endInputElement) {
          this.endInputElement.value = endDisplay;
        }
        this.selectingEnd = false;
        this._render(); // Re-render to show selected range, but don't close calendar
        // onSelect will be called when user clicks "Закрыть" button
      }
    }
  }

  /**
   * Navigate to previous month
   */
  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this._render();
  }

  /**
   * Navigate to next month
   */
  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this._render();
  }

  /**
   * Select today's date
   */
  selectToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this._handleDateSelection(today);
  }

  /**
   * Clear range selection
   */
  clearRange() {
    if (this.mode !== 'range') return;

    this.startDate = null;
    this.endDate = null;
    if (this.startInputElement) {
      this.startInputElement.value = '';
    }
    if (this.endInputElement) {
      this.endInputElement.value = '';
    }
    this.selectingEnd = false;
    this._render();
  }

  /**
   * Move calendar into dialog if input is inside an open dialog element
   * This is necessary because HTML5 <dialog> creates a top layer above any z-index
   * @private
   */
  _moveToDialog() {
    const targetInput = this.mode === 'single'
      ? this.inputElement
      : this.startInputElement;

    if (!targetInput) return;

    // Check if input is inside an open dialog
    const dialogElement = targetInput?.closest('dialog[open]');

    if (dialogElement) {
      // Input is inside an open dialog - move calendar into .modal-box for proper layering
      const modalBox = dialogElement.querySelector('.modal-box');
      if (modalBox && this.calendarElement && this.calendarElement.parentElement !== modalBox) {
        // Store original parent for restoration
        this._originalParent = this.calendarElement.parentElement;
        // Move calendar into dialog's modal-box
        if (this.calendarElement) {
          modalBox.appendChild(this.calendarElement);
        }
        // Switch to absolute positioning within dialog
        this.calendarElement?.classList.remove('fixed');
        this.calendarElement?.classList.add('absolute');
        if (this.calendarElement) {
          this.calendarElement.style.position = 'absolute';
        }
        this._isInsideDialog = true;
      }
    }
  }

  /**
   * Restore calendar back to document.body if it was moved to a dialog
   * @private
   */
  _restoreToBody() {
    if (this._isInsideDialog && this._originalParent && this.calendarElement) {
      // Move calendar back to original parent (document.body)
      this._originalParent.appendChild(this.calendarElement);
      // Restore fixed positioning
      this.calendarElement.classList.remove('absolute');
      this.calendarElement.classList.add('fixed');
      this.calendarElement.style.position = 'fixed';
      this._isInsideDialog = false;
      this._originalParent = null;
    }
  }

  /**
   * Open calendar
   */
  open() {
    this.isOpen = true;

    // Check if we need to move calendar into a dialog (for proper layering above dialog backdrop)
    this._moveToDialog();

    // Make visible but transparent for positioning calculation
    if (this.calendarElement) {
      this.calendarElement.style.visibility = 'visible';
      this.calendarElement.style.opacity = '0';
    }

    // Calculate and set position
    this._positionCalendar();

    // Use double requestAnimationFrame to ensure layout is complete before showing
    // This prevents visual "jumps" on mobile devices
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.calendarElement) {
          this.calendarElement.style.opacity = '1';
        }
        this._render(); // Re-render to show current selection
      });
    });
  }

  /**
   * Position calendar relative to input element
   * Uses fixed positioning for non-dialog, absolute positioning for dialog
   * @private
   */
  _positionCalendar() {
    const targetInput = this.mode === 'single'
      ? this.inputElement
      : this.startInputElement;

    if (!targetInput) return;

    const inputRect = targetInput.getBoundingClientRect();
    const calendarWidth = 320; // Match width in _createCalendarElement

    // Use REAL calendar height instead of approximate 400px to prevent visual jumps
    const calendarRect = this.calendarElement?.getBoundingClientRect();
    const calendarHeight = calendarRect?.height || 400; // Fallback to 400 if height is 0

    // For position: fixed, use document.documentElement.clientWidth (excludes scrollbar)
    // window.innerWidth can include scrollbar on some devices causing misalignment
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isDesktop = viewportWidth >= 768;
    const spacing = isDesktop ? 4 : 8; // Gap between input and calendar (smaller on desktop)

    // If inside dialog, calculate position relative to dialog instead of viewport
    let scrollTop = 0;
    let scrollLeft = 0;
    let modalBox: Element | null = null;
    if (this._isInsideDialog) {
      modalBox = this.calendarElement?.parentElement || null;
      if (modalBox) {
        scrollTop = (modalBox as HTMLElement).scrollTop;
        scrollLeft = (modalBox as HTMLElement).scrollLeft;
      }
    }

    // Calculate initial position (below input)
    let top, left;

    if (this._isInsideDialog && modalBox) {
      // For modal-box: calculate position relative to modal-box container
      const modalRect = modalBox.getBoundingClientRect();
      const inputOffsetTop = inputRect.top - modalRect.top + scrollTop;
      const inputOffsetLeft = inputRect.left - modalRect.left + scrollLeft;

      top = inputOffsetTop + inputRect.height + spacing;
      left = inputOffsetLeft;
    } else {
      // For regular page: use viewport-relative positioning
      top = inputRect.bottom + spacing;
      left = inputRect.left;
    }

    // Desktop: align calendar to RIGHT edge of input (for filter panels on the right)
    if (isDesktop && !this._isInsideDialog) {
      left = inputRect.right - calendarWidth;
    } else if (isDesktop && this._isInsideDialog && modalBox) {
      // Desktop in modal: align to right edge of input, relative to modal-box
      const modalRect = modalBox.getBoundingClientRect();
      left = (inputRect.right - modalRect.left + scrollLeft) - calendarWidth;
    }

    // Adjust horizontal position if calendar goes off-screen (right edge)
    // Only for mobile - desktop calendar is already right-aligned
    if (!isDesktop && left + calendarWidth > viewportWidth) {
      left = viewportWidth - calendarWidth - spacing;
    }

    // Adjust horizontal position if calendar goes off-screen (left edge)
    if (left < spacing) {
      left = spacing;
    }

    // Check if calendar fits below input
    let spaceBelow, spaceAbove;

    if (this._isInsideDialog && modalBox) {
      // For modal-box: check space within modal-box
      const modalHeight = (modalBox as HTMLElement).clientHeight;
      const inputOffsetTop = inputRect.top - modalBox.getBoundingClientRect().top + scrollTop;

      spaceBelow = modalHeight - (inputOffsetTop + inputRect.height);
      spaceAbove = inputOffsetTop;

      // If not enough space below but enough space above, show above input
      if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
        top = inputOffsetTop - calendarHeight - spacing;
      }
    } else {
      // For regular page: check viewport space
      spaceBelow = viewportHeight - inputRect.bottom;
      spaceAbove = inputRect.top;

      // If not enough space below but enough space above, show above input
      if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
        top = inputRect.top - calendarHeight - spacing;
      }
    }

    // Mobile: Center calendar horizontally, vertical positioning depends on context
    if (viewportWidth < 768) {
      // Check if calendar is inside modal-box (direct check, more reliable)
      const parent = this.calendarElement?.parentElement;
      const isInsideModalBox = parent && parent.classList && parent.classList.contains('modal-box');

      if (isInsideModalBox) {
        // Calendar inside modal-box: center horizontally within modal-box
        const modalWidth = (parent as HTMLElement).clientWidth;

        // Simple centering formula: left = (containerWidth - calendarWidth) / 2
        left = (modalWidth - calendarWidth) / 2;

        // Ensure minimum spacing from modal edges
        if (left < spacing) left = spacing;

        // Keep vertical position relative to input (already calculated with scrollTop compensation)
        // DO NOT apply viewport vertical centering inside modal-box
      } else {
        // Not in modal: center relative to viewport (both horizontally and vertically)
        // Tested on iPhone 7-17 viewport widths (portrait):
        // - iPhone 7/8: 375px → (375-320)/2 = 27.5px left offset
        // - iPhone 12/13/14: 390px → (390-320)/2 = 35px left offset
        // - iPhone 12/13/14 Pro/15/15 Pro: 393px → (393-320)/2 = 36.5px left offset
        // - iPhone 7/8 Plus/XR/11: 414px → (414-320)/2 = 47px left offset
        // - iPhone 12/13/14 Plus/Pro Max: 428px → (428-320)/2 = 54px left offset
        // - iPhone 15 Plus/Pro Max: 430px → (430-320)/2 = 55px left offset
        left = Math.round((viewportWidth - calendarWidth) / 2);

        // Ensure minimum spacing from edges (prevent touching screen edges)
        const minOffset = spacing;
        const maxOffset = viewportWidth - calendarWidth - spacing;
        left = Math.max(minOffset, Math.min(left, maxOffset));

        // Vertical centering for better UX on mobile outside modals
        top = (viewportHeight - calendarHeight) / 2;

        // Ensure minimum spacing from top
        if (top < spacing) top = spacing;
      }
    }

    // Desktop in dialog: Center horizontally within modal-box
    if (isDesktop) {
      const parent = this.calendarElement?.parentElement;
      const isInsideModalBox = parent && parent.classList && parent.classList.contains('modal-box');

      if (isInsideModalBox) {
        // Calendar inside modal-box: center within modal-box
        const modalWidth = (parent as HTMLElement).clientWidth;

        // Simple centering formula: left = (containerWidth - calendarWidth) / 2
        left = (modalWidth - calendarWidth) / 2;
      }
    }

    // Apply position
    if (this.calendarElement) {
      this.calendarElement.style.top = `${top}px`;
      this.calendarElement.style.left = `${left}px`;
    }
  }

  /**
   * Apply selection and close calendar (called by "Закрыть" button)
   */
  applyAndClose() {
    // For range mode: call onSelect callback if both dates are selected
    if (this.mode === 'range' && this.startDate && this.endDate) {
      const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
      const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
      this.onSelect(startDisplay, endDisplay);
    }

    // Close calendar
    this.close();
  }

  /**
   * Close calendar
   */
  close() {
    this.isOpen = false;
    if (this.calendarElement) {
      this.calendarElement.style.visibility = 'hidden';
      this.calendarElement.style.opacity = '0';
    }

    // Restore calendar back to document.body if it was moved to a dialog
    this._restoreToBody();
  }

  /**
   * Toggle calendar open/close
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Destroy calendar widget and remove from DOM
   * Prevents memory leaks when recreating calendars in modals
   */
  destroy() {
    // Close if open
    if (this.isOpen) {
      this.close();
    }

    // Remove calendar element from DOM
    if (this.calendarElement) {
      this.calendarElement.remove();
    }

    // Remove ALL trigger buttons
    this.triggerButtons.forEach(btn => {
      if (btn && btn.parentNode) {
        btn.remove();
      }
    });

    // Clear references
    this.triggerButtons = [];
    this.triggerButton = null;
    this.calendarElement = null;
  }
}


    //=============================================================================
    // MODULE 3: ChoicesCategoryTree
    // Category selector with hierarchical tree support (using Choices.js)
    //=============================================================================

class ChoicesCategoryTree {
    // Static cache to avoid duplicate API calls across instances
    // key: "type:showInactive:fcPart" -> { data: [], timestamp: Date }
    // fcPart is financial_center_id or "all" for unfiltered
    static _cache = new Map();
    static _pendingRequests = new Map();  // key: "type:showInactive:fcPart" -> Promise

    // Web Worker for hierarchy processing (Phase 2: Performance Optimization)
    static _workerWrapper: any = null;

    // Instance properties
    selector: string;
    element: HTMLElement | null;
    auth: any | null;
    options!: {
        type: string;
        onCategoryChange: Function | null;
        apiBaseUrl: string;
        showLeafOnly: boolean;
        showInactive: boolean;
        financialCenterId: number | null;
        multiple: boolean;
        showPath: boolean;
        showClearButton: boolean;
        mode: string;
    };
    choices: any | null;
    categories!: any[];
    categoryMap!: Map<any, any>;
    childrenMap!: Map<any, any>;
    _initPromise!: (() => void) | null;
    _clearAllBtn?: HTMLButtonElement;

    /**
     * Initialize Web Worker for category hierarchy processing.
     * Called automatically on first use, or can be preloaded.
     */
    static initializeWorker() {
        if (!this._workerWrapper && typeof (window as any).WorkerWrapper !== 'undefined') {
            try {
                this._workerWrapper = new (window as any).WorkerWrapper('/static/js/workers/hierarchyWorker.min.js', {
                    idleTimeout: 30000,  // 30s for category tree (less aggressive than default)
                    debugMode: window.DEBUG_MODE || false
                });
            } catch (error: any) {
                console.warn('[ChoicesCategoryTree] Failed to initialize worker:', error);
                this._workerWrapper = null;
            }
        }
    }

    /**
     * Preload categories for offline use.
     * Call this on page load to cache both expense and income categories.
     * Categories will be available in offline mode after preloading.
     *
     * @param {Object} options - Preload options
     * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
     * @param {boolean} options.showInactive - Include archived categories (default: false)
     * @returns {Promise<void>}
     */
    static async preloadCategories(options: any = {}): Promise<void> {
        const apiBaseUrl = options.apiBaseUrl || '/api/v1';
        const showInactive = options.showInactive || false;

        // Preload all 4 types: expense/income for transactions, debit/credit for transfers
        const types = ['expense', 'income', 'debit', 'credit'];

        // Preload both types in parallel
        const preloadPromises = types.map(async (type) => {
            // IMPORTANT: Use "all" as FC part to match loadCategories() cache key
            // loadCategories uses: `${type}:${showInactive}:${fcPart}` where fcPart defaults to "all"
            const cacheKey = `${type}:${showInactive}:all`;

            // Skip if already cached
            if (ChoicesCategoryTree._cache.has(cacheKey)) {
                if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] ${type} categories already cached, skipping preload`);
                return;
            }

            // Skip if request already in flight
            if (ChoicesCategoryTree._pendingRequests.has(cacheKey)) {
                if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] ${type} categories request already in progress, waiting`);
                return ChoicesCategoryTree._pendingRequests.get(cacheKey);
            }

            const url = `${apiBaseUrl}/articles?type=${type}&sort_by=usage_count&limit=1000&include_inactive=${showInactive}`;

            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    console.warn(`[ChoicesCategoryTree] Failed to preload ${type} categories: HTTP ${response.status}`);
                    return;
                }

                const data = await response.json();
                const categories = data.articles || [];

                // Cache the result
                ChoicesCategoryTree._cache.set(cacheKey, {
                    data: categories,
                    timestamp: Date.now()
                });

                if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Preloaded ${categories.length} ${type} categories`);
            } catch (error: any) {
                console.warn(`[ChoicesCategoryTree] Network error preloading ${type} categories:`, error.message);
            }
        });

        await Promise.all(preloadPromises);
    }

    /**
     * Initialize category tree selector.
     *
     * @param {string} selector - CSS selector for select element
     * @param {Object} options - Configuration options
     * @param {string} options.type - Category type ('income' or 'expense')
     * @param {Object} [options.auth] - OPTIONAL: Auth instance with getToken() method (for WebApp Bearer token)
     * @param {Function} options.onCategoryChange - Callback when category changes
     * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
     * @param {boolean} options.showLeafOnly - Show only leaf categories (default: true)
     * @param {boolean} options.showInactive - Include archived categories (default: false)
     * @param {number|null} options.financialCenterId - OPTIONAL: Filter categories by financial center ID
     */
    constructor(selector: string, options: any = {}) {
        this.selector = selector;
        this.element = document.querySelector(selector);

        if (!this.element) {
            console.error(`[ChoicesCategoryTree] Element not found: ${selector}`);
            return;
        }

        // Auth parameter is OPTIONAL:
        // - If provided: use Bearer token (Telegram WebApp)
        // - If not provided: use cookie-based auth (web interface)
        this.auth = options.auth || null;  // Store auth instance (nullable)
        this.options = {
            type: options.type || 'expense',
            // Support both callback names for compatibility (onChange for analytics page)
            onCategoryChange: options.onCategoryChange || options.onChange || null,
            apiBaseUrl: options.apiBaseUrl || '/api/v1',
            showLeafOnly: options.showLeafOnly !== false,  // Default true
            showInactive: options.showInactive || false,  // Default false - hide archived categories
            financialCenterId: options.financialCenterId || null,  // Filter by FC (null = all)
            // Multi-select support (for analytics page category filter)
            multiple: options.multiple || false,
            showPath: options.showPath !== false,  // Default true - show breadcrumb path
            showClearButton: options.showClearButton !== false,  // Default true - show clear-all button for multiple mode
            mode: options.mode || 'edit',  // NEW: 'create' | 'edit' - controls selection preservation in updateFinancialCenter()
        };

        this.choices = null;
        this.categories = [];
        this.categoryMap = new Map();  // id -> category
        this.childrenMap = new Map();  // parent_id -> [child_ids]
        this._initPromise = null;  // Promise resolver for waitForReady()

        this.init();
    }

    /**
     * Initialize component.
     */
    async init() {
        try {
            // Load categories from API
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Initialize Choices.js
            this.initChoices(displayCategories);
        } catch (error: any) {
            console.error('[ChoicesCategoryTree] Initialization error:', error);
            this.showError('Ошибка загрузки категорий');
        }
    }

    /**
     * Load categories from API.
     * Uses Bearer token (WebApp) or cookie-based auth (web interface).
     */
    async loadCategories() {
        // Generate cache key based on type, showInactive, and financialCenterId
        const fcPart = this.options.financialCenterId || 'all';
        const cacheKey = `${this.options.type}:${this.options.showInactive}:${fcPart}`;

        // Check cache first (30 second TTL)
        const cached = ChoicesCategoryTree._cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < 30000) {
            this.categories = cached.data;
            return;
        }

        // Check if request is already in flight
        const pendingRequest = ChoicesCategoryTree._pendingRequests.get(cacheKey);
        if (pendingRequest) {
            this.categories = await pendingRequest;
            return;
        }

        // Check if we're offline - skip API call and use cache or empty
        if (!navigator.onLine) {
            if (typeof (window as any).debugLog === "function") (window as any).debugLog('[ChoicesCategoryTree] Offline mode - skipping API call, using cache');
            // Try to find any cached data for this type (without FC filter)
            const fallbackKey = `${this.options.type}:${this.options.showInactive}:all`;
            const fallback = ChoicesCategoryTree._cache.get(fallbackKey);
            if (fallback) {
                this.categories = fallback.data;
                return;
            }
            this.categories = [];
            return;
        }

        // Create new request with optional financial_center_id filter
        let url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000&include_inactive=${this.options.showInactive}`;
        if (this.options.financialCenterId) {
            url += `&financial_center_id=${this.options.financialCenterId}`;
        }

        // Build headers conditionally
        const headers: Record<string, string> = {};

        // If auth instance provided, use Bearer token (Telegram WebApp)
        if (this.auth && typeof this.auth.getToken === 'function') {
            const token = this.auth.getToken();
            if (!token) {
                throw new Error('No authentication token available');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Otherwise, rely on cookie-based auth (web interface)

        // Create and store promise
        const requestPromise = fetch(url, {
            headers: headers,
            credentials: 'same-origin',  // Include cookies
        }).then(async response => {
            if (!response.ok) {
                // Graceful degradation for 401 Unauthorized (user not authenticated)
                if (response.status === 401) {
                    if (typeof (window as any).debugLog === "function") (window as any).debugLog('[ChoicesCategoryTree] User not authenticated - categories not loaded (this is expected for unauthenticated users)');
                    return [];  // Empty categories array
                }

                // For other errors, throw with detailed status
                throw new Error(`Failed to load categories: HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const categories = data.articles || [];

            // Cache the result
            ChoicesCategoryTree._cache.set(cacheKey, {
                data: categories,
                timestamp: Date.now()
            });

            return categories;
        }).catch(error => {
            // Handle network errors (offline mode)
            console.warn('[ChoicesCategoryTree] Network error loading categories (offline?):', error.message);

            // Try to use stale cache if available (ignore TTL in offline mode)
            const staleCache = ChoicesCategoryTree._cache.get(cacheKey);
            if (staleCache && staleCache.data && staleCache.data.length > 0) {
                if (typeof (window as any).debugLog === "function") (window as any).debugLog('[ChoicesCategoryTree] Using stale cache for offline mode');
                return staleCache.data;
            }

            // Fallback 1: If specific FC cache not found, try "all" categories cache
            // This allows offline mode to work even if user changes FC filter
            if (this.options.financialCenterId) {
                const allCacheKey = `${this.options.type}:${this.options.showInactive}:all`;
                const allCache = ChoicesCategoryTree._cache.get(allCacheKey);
                if (allCache && allCache.data && allCache.data.length > 0) {
                    if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Offline: No cache for FC ${this.options.financialCenterId}, using all categories`);
                    // Note: This returns all categories, not filtered by FC
                    // User can still select categories, filtering will apply when back online
                    return allCache.data;
                }
            }

            // No cache available - return empty array to avoid breaking UI
            console.warn('[ChoicesCategoryTree] No cached categories available for offline mode');
            return [];
        }).finally(() => {
            // Remove from pending requests
            ChoicesCategoryTree._pendingRequests.delete(cacheKey);
        });

        // Store pending request
        ChoicesCategoryTree._pendingRequests.set(cacheKey, requestPromise);

        this.categories = await requestPromise;
    }

    /**
     * Build hierarchy maps for efficient lookups.
     * Uses Web Worker for performance (with automatic fallback to sync processing).
     */
    async buildHierarchyMaps() {
        // Try worker-based processing first
        if (ChoicesCategoryTree._workerWrapper && this.categories.length > 0) {
            try {
                ChoicesCategoryTree.initializeWorker();

                // Execute worker task
                const result = await ChoicesCategoryTree._workerWrapper.execute({
                    action: 'buildMaps',
                    data: { categories: this.categories }
                });

                // Convert plain objects back to Maps
                this.categoryMap = new Map(Object.entries(result.categoryMap));
                this.childrenMap = new Map(
                    Object.entries(result.childrenMap).map(([key, val]) => [parseInt(key), val])
                );

                // Resolve initialization promise
                if (this._initPromise) {
                    this._initPromise();
                    this._initPromise = null;
                }
                return;
            } catch (error: any) {
                // Worker failed, fall back to synchronous
                console.warn('[ChoicesCategoryTree] Worker buildMaps failed, using synchronous:', error);
            }
        }

        // Synchronous fallback (original implementation)
        this.categoryMap.clear();
        this.childrenMap.clear();

        for (const category of this.categories) {
            this.categoryMap.set(category.id, category);

            // Build childrenMap
            if (category.parent_id) {
                if (!this.childrenMap.has(category.parent_id)) {
                    this.childrenMap.set(category.parent_id, []);
                }
                this.childrenMap.get(category.parent_id).push(category.id);
            }
        }

        // Resolve initialization promise (for waitForReady() method)
        if (this._initPromise) {
            this._initPromise();
            this._initPromise = null;
        }
    }

    /**
     * Wait for the category tree to be fully initialized.
     * This method allows callers to wait for initialization to complete
     * without polling with setInterval. It returns a Promise that resolves
     * when categoryMap is populated and Choices.js is ready.
     *
     * Usage:
     *   const tree = new ChoicesCategoryTree('#selector', options);
     *   await tree.waitForReady();
     *   await tree.setSelectedCategory(categoryId);
     *
     * @returns {Promise<void>} Resolves when initialization is complete
     */
    async waitForReady(): Promise<void> {
        // If already initialized, return immediately
        if (this.categoryMap && this.categoryMap.size > 0 &&
            this.choices && this.choices._store?.choices.length > 0) {
            return Promise.resolve();
        }

        // Otherwise, create and return a Promise that will be resolved
        // when buildHierarchyMaps() completes
        return new Promise<void>((resolve) => {
            this._initPromise = resolve as () => void;
        });
    }

    /**
     * Get leaf categories (categories without children).
     * Uses API-provided is_leaf flag if available, otherwise calculates locally.
     *
     * IMPORTANT: When filtering by financial_center_id, the API returns only
     * categories available for that FC. The childrenMap built from filtered
     * list may incorrectly mark parent categories as leaves (because their
     * children were filtered out). The API-provided is_leaf flag is calculated
     * from the FULL database, so it's always correct.
     */
    getLeafCategories() {
        return this.categories.filter(cat => {
            // Prefer API-provided is_leaf (calculated from full DB)
            if (typeof cat.is_leaf === 'boolean') {
                return cat.is_leaf;
            }
            // Fallback to local childrenMap calculation (for backwards compatibility)
            return !this.childrenMap.has(cat.id);
        });
    }

    /**
     * Get parent chain for a category (from root to parent, excluding self).
     * Uses Web Worker for large datasets (>100 categories), synchronous for small.
     *
     * @param {number} categoryId - Category ID
     * @returns {Promise<Array>|Array} Array of parent categories (root to parent)
     */
    getParentChain(categoryId: number): any[] | Promise<any> {
        const category = this.categoryMap.get(categoryId);

        if (!category || !category.parent_id) {
            return [];  // No parents
        }

        // For large datasets (>100 categories), use worker
        if (this.categories.length > 100 && ChoicesCategoryTree._workerWrapper) {
            return this._getParentChainWorker(categoryId);
        }

        // Synchronous for small datasets
        return this._getParentChainSync(categoryId);
    }

    /**
     * Synchronous parent chain (original implementation).
     * @private
     */
    _getParentChainSync(categoryId: number): any[] {
        const chain: any[] = [];
        const category = this.categoryMap.get(categoryId);

        if (!category || !category.parent_id) {
            return chain;
        }

        let currentParentId = category.parent_id;

        while (currentParentId) {
            const parent = this.categoryMap.get(currentParentId);
            if (!parent) break;

            chain.unshift(parent);  // Add to beginning (root first)
            currentParentId = parent.parent_id;
        }

        return chain;
    }

    /**
     * Worker-based parent chain for large datasets.
     * @private
     */
    async _getParentChainWorker(categoryId: number): Promise<any> {
        try {
            ChoicesCategoryTree.initializeWorker();

            // Convert Maps to plain objects for worker
            const categoryMap = Object.fromEntries(this.categoryMap);

            const result = await ChoicesCategoryTree._workerWrapper?.execute({
                action: 'getParentChain',
                data: { categoryId, categoryMap }
            });

            return result;
        } catch (error: any) {
            console.warn('[ChoicesCategoryTree] Worker getParentChain failed, using synchronous:', error);
            return this._getParentChainSync(categoryId);
        }
    }

    /**
     * Initialize Choices.js with categories.
     *
     * @param {Array} categories - Categories to display
     */
    initChoices(categories: any[]): void {
        // Clear placeholder option from select element before Choices.js initialization
        // This prevents placeholder from appearing in dropdown list
        if (this.element) {
            this.element.innerHTML = '';
        }

        // Prepare choices data with parent chain
        const choices = categories.map((cat: any) => {
            const parentChain = this.getParentChain(cat.id);
            const parentText = (Array.isArray(parentChain) && parentChain.length > 0)
                ? parentChain.map((p: any) => p.name).join(' › ')
                : '';

            return {
                value: cat.id,
                label: cat.name,
                customProperties: {
                    usage_count: cat.usage_count || 0,
                    parent_id: cat.parent_id,
                    parent_text: parentText,  // Store formatted parent chain
                }
            };
        });

        // Initialize Choices.js with custom templates
        this.choices = new Choices(this.element, {
            searchEnabled: true,
            searchPlaceholderValue: 'Поиск категории...',
            placeholder: true,
            // Always open dropdown downward (for modal usage with mobileModalPositioning)
            // Choices.js 'auto' fires showDropdown AFTER computing direction, making
            // mobileModalPositioning.ts modal-shift too late to affect dropdown direction.
            position: 'bottom',
            // Different placeholder for single/multiple modes
            placeholderValue: this.options.multiple
                ? ''  // Пустой placeholder для multi-select
                : '— Выберите категорию —',
            noResultsText: 'Не найдено',
            noChoicesText: 'Нет доступных категорий',
            itemSelectText: '',
            shouldSort: false,  // Keep our API sorting (by usage_count)

            // Enable/disable individual remove buttons based on showClearButton option
            // If showClearButton=true: use clear-all button, disable individual remove
            // If showClearButton=false: enable individual remove buttons
            removeItemButton: this.options.multiple && !this.options.showClearButton,

            // Fuzzy search configuration (built-in Fuse.js)
            fuseOptions: {
                threshold: 0.3,        // Match threshold (0.0 = perfect, 1.0 = anything)
                distance: 100,         // Character distance for matches
                ignoreLocation: true,  // Don't care where in string match occurs
                keys: ['label'],       // Search in label field
            },

            // Custom templates for dropdown items (show parent chain)
            callbackOnCreateTemplates: (template: any) => {
                return this.options.multiple
                    ? this._createMultipleTemplates(template)
                    : this._createSingleTemplates(template);
            },

            // Styling
            classNames: {
                containerOuter: ['choices', 'choices-tailwind', this.options.multiple ? 'is-multiple' : ''].filter(Boolean),
                containerInner: ['choices__inner'],
                input: ['choices__input'],
                inputCloned: ['choices__input--cloned'],
                list: ['choices__list'],
                listItems: ['choices__list--multiple'],
                listSingle: ['choices__list--single'],
                listDropdown: ['choices__list--dropdown'],
                item: ['choices__item'],
                itemSelectable: ['choices__item--selectable'],
                itemDisabled: ['choices__item--disabled'],
                itemChoice: ['choices__item--choice'],
                placeholder: ['choices__placeholder'],
                group: ['choices__group'],
                groupHeading: ['choices__heading'],
                button: ['choices__button'],
            },
        });

        // Add choices WITHOUT auto-selecting first item
        // 4th parameter FALSE prevents Choices.js from auto-selecting
        if (this.choices) {
            this.choices.setChoices(choices, 'value', 'label', false);
        }

        // Listen for change events
        if (this.element) {
            this.element.addEventListener('change', (event) => {
                this.handleCategoryChange(event);
            });
        }

        // Add clear-all button for multiple mode (if enabled)
        if (this.options.multiple && this.options.showClearButton) {
            this._addClearAllButton();
        }
    }

    /**
     * Create templates for single-select mode (existing behavior).
     * @private
     */
    _createSingleTemplates(template: any): any {
        return {
            // Dropdown item template (shown in dropdown list)
            choice: (classNames: any, data: any) => {
                const parentText = data.customProperties?.parent_text || '';
                const label = data.label;

                return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.groupId > 0 ? 'role="treeitem"' : 'role="option"'}
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ''}
                    </div>
                `);
            },

            // Selected item template (shown after selection)
            item: (classNames: any, data: any) => {
                // For selected item, show only label (no parent chain)
                return template(`
                    <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}"
                         data-item
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.active ? 'aria-selected="true"' : ''}
                         ${data.disabled ? 'aria-disabled="true"' : ''}>
                        ${data.label}
                    </div>
                `);
            },
        };
    }

    /**
     * Create templates for multi-select mode.
     * When showClearButton=false: badges with individual remove buttons
     * When showClearButton=true: comma-separated text (use clear-all button)
     * @private
     */
    _createMultipleTemplates(template: any): any {
        const showRemoveButtons = !this.options.showClearButton;

        return {
            // Dropdown item template (same as single - shows parent chain)
            choice: (classNames: any, data: any) => {
                const parentText = data.customProperties?.parent_text || '';
                const label = data.label;

                return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         role="option"
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ''}
                    </div>
                `);
            },

            // Selected item template
            item: (classNames: any, data: any) => {
                if (showRemoveButtons) {
                    // Badge style with individual remove button
                    return template(`
                        <div class="${classNames.item} choices__item--badge"
                             data-item
                             data-id="${data.id}"
                             data-value="${data.value}"
                             ${data.active ? 'aria-selected="true"' : ''}
                             ${data.disabled ? 'aria-disabled="true"' : ''}>
                            <span class="choices__item--badge-text">${data.label}</span>
                            <button type="button"
                                    class="${classNames.button}"
                                    data-button=""
                                    aria-label="Удалить ${data.label}">
                                ×
                            </button>
                        </div>
                    `);
                } else {
                    // Comma-separated text (use clear-all button)
                    return template(`
                        <span class="${classNames.item} choices__item--comma"
                              data-item
                              data-id="${data.id}"
                              data-value="${data.value}"
                              ${data.active ? 'aria-selected="true"' : ''}
                              ${data.disabled ? 'aria-disabled="true"' : ''}>
                            ${data.label}
                        </span>
                    `);
                }
            },
        };
    }

    /**
     * Add "Clear All" button under the form (for multiple mode).
     * @private
     */
    _addClearAllButton() {
        const choicesContainer = this.element?.closest('.choices');
        if (!choicesContainer) return;

        // Create wrapper for clear button (positioned under form)
        const wrapper = document.createElement('div');
        wrapper.className = 'choices__clear-wrapper';

        // Create clear-all button (только иконка X)
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'choices__clear-all';
        clearBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        `;
        clearBtn.title = 'Очистить все';
        clearBtn.style.display = 'none';  // Hidden by default

        wrapper.appendChild(clearBtn);

        // Insert AFTER choices container (под формой)
        if (choicesContainer.parentElement) {
            choicesContainer.parentElement.insertBefore(wrapper, choicesContainer.nextSibling);
        }

        // Handle click
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.clearSelection();
        });

        // Store reference
        this._clearAllBtn = clearBtn;
    }

    /**
     * Update clear-all button visibility based on selection.
     * @private
     */
    _updateClearAllVisibility() {
        if (!this._clearAllBtn) return;

        const hasItems = this.choices?.getValue()?.length > 0;
        this._clearAllBtn.style.display = hasItems ? 'flex' : 'none';
    }

    /**
     * Handle category change event.
     * Supports both single and multiple selection modes.
     *
     * @param {Event} event - Change event
     */
    async handleCategoryChange(event: Event) {
        if (!this.options.onCategoryChange) return;

        if (this.options.multiple) {
            // Multi-select mode: get all selected items using Choices.js API
            const selectedItems = this.choices?.getValue() || [];
            const selectedCategories = selectedItems.map((item: any) => {
                const categoryId = parseInt(item.value);
                return this.categoryMap.get(categoryId);
            }).filter(Boolean);  // Remove nulls

            this.options.onCategoryChange(selectedCategories);
            this._updateClearAllVisibility();
        } else {
            // Single-select mode (existing behavior)
            const categoryId = parseInt((event.target as HTMLSelectElement).value);
            if (!categoryId) return;

            const category = this.categoryMap.get(categoryId);
            this.options.onCategoryChange(category);
        }
    }

    /**
     * Show error message.
     *
     * @param {string} message - Error message
     */
    showError(message: string) {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    /**
     * Disable the category selector.
     * Delegates to Choices.js .disable() which adds is-disabled CSS class and
     * sets pointer-events:none — the native select disabled attribute alone
     * does not update the custom Choices.js UI.
     * Falls back to native setAttribute if Choices.js is not yet initialized.
     */
    disable() {
        if (this.choices) {
            this.choices.disable();
        } else if (this.element) {
            this.element.setAttribute('disabled', 'disabled');
        }
    }

    /**
     * Enable the category selector.
     * Delegates to Choices.js .enable() which removes is-disabled CSS class.
     * Falls back to native removeAttribute if Choices.js is not yet initialized.
     */
    enable() {
        if (this.choices) {
            this.choices.enable();
        } else if (this.element) {
            this.element.removeAttribute('disabled');
        }
    }

    /**
     * Destroy component and cleanup.
     */
    destroy() {
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        // Complete DOM cleanup to prevent reinitialization errors
        if (this.element) {
            (this.element as HTMLSelectElement).value = '';
            this.element.classList.remove('choices__input', 'choices__input--cloned');
            this.element.removeAttribute('data-choice');
        }

        this.categories = [];
        this.categoryMap.clear();
        this.childrenMap.clear();
    }

    /**
     * Update category type without full reinitialization.
     * More efficient than destroy() + new instance.
     *
     * @param {string} newType - New category type ('income' or 'expense')
     */
    async updateType(newType: string) {
        // Update type in options
        this.options.type = newType;

        // Clear selection for multiple mode (must use Choices.js API)
        if (this.options.multiple && this.choices) {
            this.choices.removeActiveItems();
            this._updateClearAllVisibility();
        }

        // Reset selection (single mode fallback)
        if (this.element) {
            (this.element as HTMLSelectElement).value = '';
        }

        try {
            // Load new categories from API (with offline fallback)
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Update Choices.js without full recreation
            if (this.choices) {
                // Clear existing choices
                this.choices.clearStore();

                // Prepare new choices data with parent chain
                const choices = displayCategories.map((cat: any) => {
                    const parentChain = this.getParentChain(cat.id);
                    const parentText = (Array.isArray(parentChain) && parentChain.length > 0)
                        ? parentChain.map((p: any) => p.name).join(' › ')
                        : '';

                    return {
                        value: cat.id,
                        label: cat.name,
                        customProperties: {
                            usage_count: cat.usage_count || 0,
                            parent_id: cat.parent_id,
                            parent_text: parentText,
                        }
                    };
                });

                // Set new choices WITHOUT auto-selecting first item
                // 4th parameter FALSE prevents Choices.js from auto-selecting
                this.choices.setChoices(choices, 'value', 'label', false);

                // Clear any existing selection (shouldn't be any, but to be safe)
                this.choices.removeActiveItems();
                if (this.element) {
                    (this.element as HTMLSelectElement).value = '';
                }

                // Log warning if no categories available (likely offline without cache)
                if (choices.length === 0) {
                    console.warn(`[ChoicesCategoryTree] No ${newType} categories available - user may be offline without cached data`);
                }
            }
        } catch (error: any) {
            console.error('[ChoicesCategoryTree] Error updating type:', error);
            // Don't show alert - just log the error
            // The dropdown will remain with old choices or empty
        }
    }

    /**
     * Refresh categories (reload from API).
     */
    async refresh() {

        // Destroy old instance
        if (this.choices) {
            this.choices.destroy();
            this.choices = null;
        }

        // Reinitialize
        await this.init();
    }

    /**
     * Update financial center ID for category filtering.
     * Invalidates specific FC cache and reloads categories.
     * In offline mode, falls back to "all" categories cache.
     *
     * @param {number|null} financialCenterId - Financial center ID (null = show all)
     */
    async updateFinancialCenter(financialCenterId: number | null) {
        // Update option
        this.options.financialCenterId = financialCenterId;

        // Only invalidate the specific FC cache, NOT the "all" cache
        // This preserves the "all" cache for offline fallback
        if (financialCenterId) {
            const specificCacheKey = `${this.options.type}:${this.options.showInactive}:${financialCenterId}`;
            ChoicesCategoryTree._cache.delete(specificCacheKey);
        }

        // Save current selection to restore it if still available
        // CRITICAL FIX: Read directly from element.value instead of choices.getValue()
        // choices.getValue() may return undefined even when element has a value
        // This happens when category is set via element.value = '123' before Choices.js syncs
        const elementValue = this.element ? (this.element as HTMLSelectElement).value : null;
        const previousSelectionId = elementValue ? parseInt(elementValue) : null;

        try {
            // Load new categories from API (with offline fallback)
            await this.loadCategories();

            // Build hierarchy maps
            this.buildHierarchyMaps();

            // Filter to leaf categories if needed
            const displayCategories = this.options.showLeafOnly
                ? this.getLeafCategories()
                : this.categories;

            // Update Choices.js without full recreation
            if (this.choices) {
                // Clear existing choices
                this.choices.clearStore();

                // Prepare new choices data with parent chain
                const choices = displayCategories.map((cat: any) => {
                    const parentChain = this.getParentChain(cat.id);
                    const parentText = (Array.isArray(parentChain) && parentChain.length > 0)
                        ? parentChain.map((p: any) => p.name).join(' › ')
                        : '';

                    return {
                        value: cat.id,
                        label: cat.name,
                        customProperties: {
                            usage_count: cat.usage_count || 0,
                            parent_id: cat.parent_id,
                            parent_text: parentText,
                        }
                    };
                });

                // Set new choices WITHOUT auto-selecting first item
                // 4th parameter FALSE prevents Choices.js from auto-selecting
                this.choices.setChoices(choices, 'value', 'label', false);

                // Check if we should preserve selection
                // Only preserve if:
                // 1. This is NOT initial filtering (FC is changing from one value to another, not from null to value)
                // 2. Previous selection exists
                // 3. Category is available in new filtered list
                const categoryStillAvailable = previousSelectionId &&
                    this.categoryMap.has(previousSelectionId);

                // Preserve ONLY in edit mode when category still available
                const shouldPreserve = this.options.mode === 'edit' && categoryStillAvailable;

                if (shouldPreserve) {
                    await this.setSelectedCategory(previousSelectionId);
                    if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Preserved selection: ${previousSelectionId}`);
                } else {
                    // Clear selection
                    this.choices.removeActiveItems();
                    if (this.element) {
                        (this.element as HTMLSelectElement).value = '';
                    }

                    if (this.options.mode === 'create') {
                        if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Cleared selection (create mode)`);
                    } else if (!categoryStillAvailable && previousSelectionId) {
                        if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Cleared selection (category not available)`);
                    } else {
                        if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] No previous selection - keeping empty`);
                    }
                }

                // Log info about filtering
                if (financialCenterId) {
                    if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Filtered to FC ${financialCenterId}: ${choices.length} categories`);
                } else {
                    if (typeof (window as any).debugLog === "function") (window as any).debugLog(`[ChoicesCategoryTree] Showing all categories: ${choices.length}`);
                }

                // Warn if using fallback data (all categories) due to offline
                if (choices.length === 0 && !navigator.onLine) {
                    console.warn(`[ChoicesCategoryTree] Offline: No categories available for FC ${financialCenterId}`);
                }
            }
        } catch (error: any) {
            console.error('[ChoicesCategoryTree] ❌ ERROR in updateFinancialCenter:', error);
        }
    }

    /**
     * Get selected category.
     *
     * @returns {Object|null} Selected category or null
     */
    getSelectedCategory(): any | null {
        const categoryId = this.element ? parseInt((this.element as HTMLSelectElement).value) : NaN;
        return categoryId ? this.categoryMap.get(categoryId) : null;
    }

    /**
     * Clear category selection.
     * Used in create modals to reset selection state.
     */
    clearSelection() {
        // Clear Choices.js active selection
        if (this.choices) {
            this.choices.removeActiveItems();
        }

        // Clear DOM element value
        if (this.element) {
            (this.element as HTMLSelectElement).value = '';
        }
    }

    /**
     * Get all selected categories (for multiple mode).
     *
     * @returns {Array} Array of selected category objects
     */
    getSelectedCategories(): any[] {
        if (!this.choices || !this.options.multiple) {
            // Single mode - return array with one item or empty
            const cat = this.getSelectedCategory();
            return cat ? [cat] : [];
        }

        const selectedItems = this.choices.getValue() || [];
        return selectedItems.map((item: any) => {
            const categoryId = parseInt(item.value);
            return this.categoryMap.get(categoryId);
        }).filter(Boolean);
    }

    /**
     * Clear all selected categories (for multiple mode).
     * Triggers onCategoryChange callback with empty array.
     * @deprecated - use clearSelection() instead
     */
    _clearSelection_DEPRECATED() {
        if (!this.choices) return;

        // Remove all selected items using Choices.js API
        this.choices.removeActiveItems();

        // Update clear-all button visibility
        this._updateClearAllVisibility();

        // Trigger callback with empty array
        if (this.options.onCategoryChange) {
            this.options.onCategoryChange([]);
        }
    }

    /**
     * Set selected category with retry logic for async category loading.
     *
     * @param {number} categoryId - Category ID to select
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @param {number} retryDelay - Delay between retries in ms (default: 100)
     */
    async setSelectedCategory(categoryId: number, maxRetries: number = 3, retryDelay: number = 100) {
        if (!this.choices) {
            console.error('[ChoicesCategoryTree] setSelectedCategory failed - no choices instance');
            return;
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Get all available choices from _store (not _currentState)
            const availableChoices = this.choices._store?.choices || [];

            // Find the choice we're trying to set
            const targetChoice = availableChoices.find((c: any) => c.value == categoryId || c.value === categoryId.toString());

            if (targetChoice) {
                // CRITICAL: Use the same type as stored in choices
                // If value is a number, pass number; if string, pass string
                const valueToSet = targetChoice.value;

                this.choices.setChoiceByValue(valueToSet);
                return; // Success - exit
            }

            // Category not found yet - wait and retry (unless last attempt)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // All retries failed
        // This is not necessarily an error - category may be:
        // 1. Deleted from database
        // 2. Wrong type (expense/income mismatch)
        // 3. Not a leaf node (if showLeafOnly is enabled)
        // 4. Filtered out by financial center
    }
}


//=============================================================================
// Export BudgetShared namespace to window
//=============================================================================

(window as any).BudgetShared = {
    DateFormatter,
    CalendarWidget,
    ChoicesCategoryTree
};

// Legacy global exports for backward compatibility
(window as any).DateFormatter = DateFormatter;
(window as any).CalendarWidget = CalendarWidget;
(window as any).ChoicesCategoryTree = ChoicesCategoryTree;

})(window);
