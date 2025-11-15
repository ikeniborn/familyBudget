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
         * BudgetShared.DateFormatter.formatForAPI('27.10.2025') // => '2025-10-27'
         */
        static formatForAPI(displayDate) {
            if (!displayDate) return '';

            const parts = displayDate.split('.');
            if (parts.length !== 3) return '';

            const [day, month, year] = parts;
            return `${year}-${month}-${day}`;
        }

        /**
         * Convert API date (YYYY-MM-DD) to user-friendly format (DD.MM.YYYY).
         *
         * @param {string} isoDate - Date in YYYY-MM-DD format
         * @returns {string} Date in DD.MM.YYYY format
         *
         * @example
         * BudgetShared.DateFormatter.formatForDisplay('2025-10-27') // => '27.10.2025'
         */
        static formatForDisplay(isoDate) {
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
         * BudgetShared.DateFormatter.today() // => '27.10.2025'
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
         * BudgetShared.DateFormatter.todayISO() // => '2025-10-27'
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
         * BudgetShared.DateFormatter.isValidDisplayFormat('27.10.2025') // => true
         * BudgetShared.DateFormatter.isValidDisplayFormat('2025-10-27') // => false
         */
        static isValidDisplayFormat(dateStr) {
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
         * BudgetShared.DateFormatter.isValidISOFormat('2025-10-27') // => true
         * BudgetShared.DateFormatter.isValidISOFormat('27-10-2025') // => false
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
         * BudgetShared.DateFormatter.formatDateTime(new Date('2025-10-27T15:30:00'))
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
         * @param {string} dateStr - Date string (DD.MM.YYYY or YYYY-MM-DD)
         * @returns {Date|null} Parsed Date object or null if invalid
         *
         * @example
         * BudgetShared.DateFormatter.parse('27.10.2025') // => Date object
         * BudgetShared.DateFormatter.parse('2025-10-27') // => Date object
         */
        static parse(dateStr) {
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
         * BudgetShared.DateFormatter.formatForDisplayWithMonthName('2025-10-27') // => '27 октября 2025'
         */
        static formatForDisplayWithMonthName(isoDate) {
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
         * BudgetShared.DateFormatter.formatForAPIFromMonthName('27 октября 2025') // => '2025-10-27'
         */
        static formatForAPIFromMonthName(displayDate) {
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
         * BudgetShared.DateFormatter.isValidMonthNameFormat('27 октября 2025') // => true
         * BudgetShared.DateFormatter.isValidMonthNameFormat('27-10-2025') // => false
         */
        static isValidMonthNameFormat(dateStr) {
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
         * BudgetShared.DateFormatter.todayWithMonthName() // => '27 октября 2025'
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
         * BudgetShared.DateFormatter.setNativeDateInput(input, '02.11.2025')
         * // Sets input.value = '2025-11-02'
         */
        static setNativeDateInput(inputElement, displayDate) {
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
         * BudgetShared.DateFormatter.getNativeDateInput(input)
         * // input.value = '2025-11-02' → returns '02.11.2025'
         */
        static getNativeDateInput(inputElement) {
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
         * BudgetShared.DateFormatter.initNativeDateInput(input)
         * // Sets input.value = '2025-11-02' (today)
         */
        static initNativeDateInput(inputElement) {
            if (!inputElement) return;

            inputElement.value = this.todayISO();
        }
    }

    //=============================================================================
    // MODULE 2: CalendarWidget
    // DaisyUI Native Date Picker Component (depends on DateFormatter)
    //=============================================================================

    class CalendarWidget {
        // Russian month names (nominative case for headers)
        static MONTH_NAMES = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        // Russian day names (short)
        static DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

        /**
         * @param {Object} options - Configuration options
         * @param {HTMLElement} [options.inputElement] - Input element for single date picker
         * @param {HTMLElement} [options.startInputElement] - Start date input for range picker
         * @param {HTMLElement} [options.endInputElement] - End date input for range picker
         * @param {string} [options.mode='single'] - Picker mode: 'single' or 'range'
         * @param {Function} [options.onSelect] - Callback when date is selected
         * @param {Date} [options.defaultDate] - Default selected date
         * @param {Date} [options.minDate] - Minimum selectable date
         * @param {Date} [options.maxDate] - Maximum selectable date
         */
        constructor(options) {
            this.mode = options.mode || 'single';
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
            this.triggerButton = null;

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

            // Parse existing date from input (uses DateFormatter)
            if (this.mode === 'single' && this.inputElement.value) {
                const parsed = DateFormatter.parse(this.inputElement.value);
                if (parsed) {
                    this.selectedDate = parsed;
                    this.currentMonth = parsed.getMonth();
                    this.currentYear = parsed.getFullYear();
                }
            }

            if (this.mode === 'range') {
                if (this.startInputElement.value) {
                    const parsed = DateFormatter.parse(this.startInputElement.value);
                    if (parsed) this.startDate = parsed;
                }
                if (this.endInputElement.value) {
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
                // Range mode: create buttons for BOTH startInputElement and endInputElement
                this._createSingleButton(this.startInputElement, false);  // isEndInput = false
                this._createSingleButton(this.endInputElement, true);     // isEndInput = true (v5.1.3 bugfix)
            }
        }

        /**
         * Create a single calendar button for an input element
         * @private
         * @param {HTMLElement} targetInput - Input element to attach button to
         * @param {boolean} isEndInput - True if this is the end date input (range mode only)
         */
        _createSingleButton(targetInput, isEndInput = false) {
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

            // Wrap input in relative container if not already wrapped
            const parent = targetInput.parentElement;
            if (!parent.classList.contains('relative')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative';
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
                // v5.1.3 bugfix: If clicking end input button in range mode, force selecting end date
                if (isEndInput && this.mode === 'range') {
                    this.open(true);  // forceSelectingEnd = true
                } else {
                    this.open();
                }
            });
        }

        /**
         * Create calendar dropdown element
         * @private
         */
        _createCalendarElement() {
            this.calendarElement = document.createElement('div');
            this.calendarElement.className = 'calendar-widget absolute z-50 mt-2 shadow-lg rounded-lg bg-base-100 border border-base-300 hidden';
            this.calendarElement.style.width = '320px';

            // Position below input
            const targetInput = this.mode === 'single'
                ? this.inputElement
                : this.startInputElement;

            targetInput.parentElement.style.position = 'relative';
            targetInput.parentElement.appendChild(this.calendarElement);

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
                    <select class="select select-bordered h-10" data-action="select-month" aria-label="Выбрать месяц">
                      ${CalendarWidget.MONTH_NAMES.map((name, i) =>
                        `<option value="${i}" ${i === this.currentMonth ? 'selected' : ''}>${name}</option>`
                      ).join('')}
                    </select>

                    <select class="select select-bordered h-10" data-action="select-year" aria-label="Выбрать год">
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

            this.calendarElement.innerHTML = html;
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

                let btnClass = 'btn btn-sm btn-ghost w-full aspect-square p-0';
                if (isToday) btnClass += ' border border-primary';
                if (isSelected) btnClass += ' btn-primary';
                if (isInRange && !isSelected) btnClass += ' bg-primary/20';
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
        _isDateDisabled(date) {
            if (this.minDate && date < this.minDate) return true;
            if (this.maxDate && date > this.maxDate) return true;
            return false;
        }

        /**
         * Check if date is selected
         * @private
         */
        _isDateSelected(date) {
            if (this.mode === 'single') {
                return this.selectedDate && date.getTime() === this.selectedDate.getTime();
            }
            if (this.mode === 'range') {
                const startMatch = this.startDate && date.getTime() === this.startDate.getTime();
                const endMatch = this.endDate && date.getTime() === this.endDate.getTime();
                return startMatch || endMatch;
            }
            return false;
        }

        /**
         * Check if date is in selected range
         * @private
         */
        _isDateInRange(date) {
            if (this.mode !== 'range' || !this.startDate || !this.endDate) return false;
            return date > this.startDate && date < this.endDate;
        }

        /**
         * Format date to ISO string (YYYY-MM-DD)
         * @private
         */
        _formatDateISO(date) {
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
            // Calendar actions (event delegation)
            this.calendarElement.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                // Stop propagation to prevent "click outside" handler from closing calendar (v5.1.3 bugfix)
                e.stopPropagation();

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
                        this.close();
                        break;
                }
            });

            // Month/Year dropdowns
            this.calendarElement.addEventListener('change', (e) => {
                const target = e.target;

                // Stop propagation to prevent "click outside" handler (v5.1.3 bugfix)
                e.stopPropagation();

                if (target.dataset.action === 'select-month') {
                    this.currentMonth = parseInt(target.value);
                    this._render();
                }

                if (target.dataset.action === 'select-year') {
                    this.currentYear = parseInt(target.value);
                    this._render();
                }
            });

            // Date selection
            this.calendarElement.addEventListener('click', (e) => {
                const dateButton = e.target.closest('[data-date]');
                if (!dateButton || dateButton.disabled) return;

                const dateStr = dateButton.dataset.date;
                const date = new Date(dateStr + 'T00:00:00'); // Parse as local time

                this._handleDateSelection(date);
            });

            // Click outside to close (v5.1.3 bugfix: don't close on internal actions)
            document.addEventListener('click', (e) => {
                if (!this.isOpen) return;

                // Don't close if clicking inside calendar (including navigation arrows/selects)
                if (this.calendarElement.contains(e.target)) return;

                // Don't close if clicking on trigger button
                if (this.triggerButton && this.triggerButton.contains(e.target)) return;

                // Check if there are additional trigger buttons (range mode)
                const allButtons = document.querySelectorAll('button[aria-label="Открыть календарь"]');
                for (const btn of allButtons) {
                    if (btn.contains(e.target)) return;
                }

                // Close if clicking outside
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

            // Allow manual input (uses DateFormatter)
            if (this.mode === 'single') {
                this.inputElement.addEventListener('blur', () => {
                    const value = this.inputElement.value;
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
         * Handle date selection (uses DateFormatter)
         * @private
         */
        _handleDateSelection(date) {
            if (this.mode === 'single') {
                this.selectedDate = date;
                const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
                this.inputElement.value = displayDate;
                this.onSelect(displayDate);
                this.close();
            }

            if (this.mode === 'range') {
                // v5.1.3 bugfix: Preserve existing dates when changing one of them
                if (this.selectingEnd) {
                    // Selecting END date - preserve START date
                    this.endDate = date;

                    // Swap if end < start
                    if (this.startDate && date < this.startDate) {
                        const temp = this.startDate;
                        this.startDate = date;
                        this.endDate = temp;
                    }

                    // Update inputs
                    if (this.startDate) {
                        const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
                        this.startInputElement.value = startDisplay;
                    }
                    const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
                    this.endInputElement.value = endDisplay;

                    // If both dates selected, trigger callback and close
                    if (this.startDate && this.endDate) {
                        const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
                        const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
                        this.onSelect(startDisplay, endDisplay);
                        this.close();
                    } else {
                        // Only end date selected, keep calendar open to select start
                        this.selectingEnd = false;
                        this._render();
                    }
                } else {
                    // Selecting START date - preserve END date
                    this.startDate = date;

                    // Swap if end < start
                    if (this.endDate && this.endDate < date) {
                        const temp = this.endDate;
                        this.endDate = date;
                        this.startDate = temp;
                    }

                    // Update inputs
                    const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
                    this.startInputElement.value = startDisplay;
                    if (this.endDate) {
                        const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
                        this.endInputElement.value = endDisplay;
                    }

                    // If both dates selected, trigger callback and close
                    if (this.startDate && this.endDate) {
                        const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
                        const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
                        this.onSelect(startDisplay, endDisplay);
                        this.close();
                    } else {
                        // Only start date selected, switch to selecting end
                        this.selectingEnd = true;
                        this._render();
                    }
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
            this.startInputElement.value = '';
            this.endInputElement.value = '';
            this.selectingEnd = false;
            this._render();
        }

        /**
         * Open calendar
         * @param {boolean} forceSelectingEnd - Force selecting end date in range mode (v5.1.3 bugfix)
         */
        open(forceSelectingEnd = false) {
            this.isOpen = true;
            this.calendarElement.classList.remove('hidden');

            // v5.1.3 bugfix: Set selection mode based on which input was clicked
            if (this.mode === 'range') {
                this.selectingEnd = forceSelectingEnd;
            }

            this._render(); // Re-render to show current selection
        }

        /**
         * Close calendar
         */
        close() {
            this.isOpen = false;
            this.calendarElement.classList.add('hidden');
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
         * Destroy calendar widget
         */
        destroy() {
            if (this.calendarElement) {
                this.calendarElement.remove();
            }
            if (this.triggerButton) {
                this.triggerButton.remove();
            }
        }
    }

    //=============================================================================
    // MODULE 3: ChoicesCategoryTree
    // Choices.js-based category selector with hierarchy support
    //=============================================================================

    class ChoicesCategoryTree {
        // Static cache to avoid duplicate API calls across instances
        static _cache = new Map();  // key: "type:showInactive" -> { data: [], timestamp: Date }
        static _pendingRequests = new Map();  // key: "type:showInactive" -> Promise

        /**
         * Initialize category tree selector.
         *
         * @param {string} selector - CSS selector for select element
         * @param {Object} options - Configuration options
         * @param {string} options.type - Category type ('income' or 'expense')
         * @param {Object} [options.auth] - OPTIONAL: Auth instance with getToken() method (for WebApp Bearer token)
         * @param {Function} options.onChange - Callback when category changes (receives category object or array for multiple)
         * @param {Function} [options.onCategoryChange] - DEPRECATED: Use onChange instead
         * @param {string} options.apiBaseUrl - Base URL for API (default: '/api/v1')
         * @param {boolean} options.showLeafOnly - Show only leaf categories (default: true)
         * @param {boolean} options.showInactive - Include archived categories (default: false)
         * @param {boolean} options.multiple - Enable multiple selection (default: false) (v5.1.3)
         * @param {boolean} options.showPath - Show breadcrumb path under selector (default: true) (v5.1.3)
         */
        constructor(selector, options = {}) {
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
                // Support both new onChange and legacy onCategoryChange (v5.1.3)
                onChange: options.onChange || options.onCategoryChange || null,
                apiBaseUrl: options.apiBaseUrl || '/api/v1',
                showLeafOnly: options.showLeafOnly !== false,  // Default true
                showInactive: options.showInactive || false,  // Default false - hide archived categories
                multiple: options.multiple || false,  // Default false (v5.1.3)
                showPath: options.showPath !== false,  // Default true (v5.1.3)
            };

            this.choices = null;
            this.categories = [];
            this.categoryMap = new Map();  // id -> category
            this.childrenMap = new Map();  // parent_id -> [child_ids]

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

                // Setup path display (only if showPath is enabled) (v5.1.3)
                if (this.options.showPath) {
                    this.setupPathDisplay();

                    // Restore selected value if exists
                    const selectedId = this.element.value;
                    if (selectedId) {
                        await this.updatePathDisplay(parseInt(selectedId));
                    }
                }
            } catch (error) {
                console.error('[ChoicesCategoryTree] Initialization error:', error);
                this.showError('Ошибка загрузки категорий');
            }
        }

        /**
         * Load categories from API.
         * Uses Bearer token (WebApp) or cookie-based auth (web interface).
         */
        async loadCategories() {
            // Generate cache key based on type and showInactive
            const cacheKey = `${this.options.type}:${this.options.showInactive}`;

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

            // Create new request
            const url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000&include_inactive=${this.options.showInactive}`;

            // Build headers conditionally
            const headers = {};

            // If auth instance provided, use Bearer token (Telegram WebApp)
            if (this.auth && typeof this.auth.getToken === 'function') {
                const token = this.auth.getToken();
                if (!token) {
                    throw new Error('No authentication token available');
                }
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Create and store promise
            const requestPromise = fetch(url, {
                headers: headers,
                credentials: 'same-origin',  // Include cookies
            }).then(async response => {
                if (!response.ok) {
                    // Graceful degradation for 401 Unauthorized (user not authenticated)
                    if (response.status === 401) {
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
         */
        buildHierarchyMaps() {
            // Build categoryMap (id -> category)
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
        }

        /**
         * Get leaf categories (categories without children).
         */
        getLeafCategories() {
            return this.categories.filter(cat => !this.childrenMap.has(cat.id));
        }

        /**
         * Initialize Choices.js with categories.
         *
         * @param {Array} categories - Categories to display
         */
        initChoices(categories) {
            // Prepare choices data
            const choices = categories.map(cat => ({
                value: cat.id,
                label: cat.name,
                customProperties: {
                    usage_count: cat.usage_count || 0,
                    parent_id: cat.parent_id,
                }
            }));

            // Initialize Choices.js
            this.choices = new Choices(this.element, {
                searchEnabled: true,
                searchPlaceholderValue: 'Поиск категории...',
                noResultsText: 'Не найдено',
                noChoicesText: 'Нет доступных категорий',
                itemSelectText: '',
                shouldSort: false,  // Keep our API sorting (by usage_count)
                removeItemButton: this.options.multiple,  // Show X button for multiple mode (v5.1.3)

                // Fuzzy search configuration (built-in Fuse.js)
                fuseOptions: {
                    threshold: 0.3,        // Match threshold (0.0 = perfect, 1.0 = anything)
                    distance: 100,         // Character distance for matches
                    ignoreLocation: true,  // Don't care where in string match occurs
                    keys: ['label'],       // Search in label field
                },

                // Styling
                classNames: {
                    containerOuter: ['choices', 'choices-telegram'],
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

            // Add choices
            this.choices.setChoices(choices, 'value', 'label', true);

            // Listen for change events
            this.element.addEventListener('change', (event) => {
                this.handleCategoryChange(event);
            });
        }

        /**
         * Setup path display element.
         */
        setupPathDisplay() {
            // Find or create path display element
            let pathDisplay = document.querySelector(`#${this.element.id}-path`);

            if (!pathDisplay) {
                // Create path display element
                pathDisplay = document.createElement('div');
                pathDisplay.id = `${this.element.id}-path`;
                pathDisplay.className = 'category-path';
                pathDisplay.style.cssText = 'margin-top: 8px; font-size: 12px; color: var(--tg-theme-hint-color, #999);';

                // Insert after Choices container
                const choicesContainer = this.element.closest('.choices');
                if (choicesContainer && choicesContainer.parentNode) {
                    choicesContainer.parentNode.insertBefore(pathDisplay, choicesContainer.nextSibling);
                }
            }

            this.pathDisplay = pathDisplay;
        }

        /**
         * Handle category change event.
         *
         * @param {Event} event - Change event
         */
        async handleCategoryChange(event) {
            // v5.1.3: Support multiple selection
            if (this.options.multiple) {
                // Check if choices instance exists (v5.1.3 bugfix)
                if (!this.choices) {
                    console.warn('[ChoicesCategoryTree] handleCategoryChange called but choices is null');
                    return;
                }

                // Multiple mode: getValue() returns array of selected values
                const selectedValues = this.choices.getValue(true);  // true = value only
                const selectedCategories = selectedValues.map(id => this.categoryMap.get(parseInt(id))).filter(Boolean);

                // Call user callback with array
                if (this.options.onChange) {
                    this.options.onChange(selectedCategories);
                }
            } else {
                // Single mode: traditional behavior
                const categoryId = parseInt(event.target.value);

                if (!categoryId) {
                    if (this.pathDisplay) {
                        this.pathDisplay.textContent = '';
                    }
                    return;
                }

                // Update path display (only in single mode with showPath)
                if (this.options.showPath) {
                    await this.updatePathDisplay(categoryId);
                }

                // Call user callback with single category
                if (this.options.onChange) {
                    const category = this.categoryMap.get(categoryId);
                    this.options.onChange(category);
                }
            }
        }

        /**
         * Update path display for selected category.
         *
         * @param {number} categoryId - Selected category ID
         */
        async updatePathDisplay(categoryId) {
            try {
                const path = await this.getCategoryPath(categoryId);
                const pathText = path.map(cat => cat.name).join(' › ');
                this.pathDisplay.textContent = pathText;
            } catch (error) {
                console.error('[ChoicesCategoryTree] Error updating path display:', error);
                this.pathDisplay.textContent = '';
            }
        }

        /**
         * Get full category path (ancestors).
         * Uses Bearer token (WebApp) or cookie-based auth (web interface).
         *
         * @param {number} categoryId - Category ID
         * @returns {Promise<Array>} Path array (root to category)
         */
        async getCategoryPath(categoryId) {
            const url = `${this.options.apiBaseUrl}/articles/${categoryId}/ancestors?include_self=true`;

            // Build headers conditionally
            const headers = {};

            // If auth instance provided, use Bearer token (Telegram WebApp)
            if (this.auth && typeof this.auth.getToken === 'function') {
                const token = this.auth.getToken();
                if (!token) {
                    throw new Error('No authentication token available');
                }
                headers['Authorization'] = `Bearer ${token}`;
            }
            // Otherwise, rely on cookie-based auth (web interface)

            const response = await fetch(url, {
                headers: headers,
                credentials: 'same-origin',  // Include cookies
            });

            if (!response.ok) {
                // Graceful degradation for 401 Unauthorized (user not authenticated)
                if (response.status === 401) {
                    return [];  // Empty path array
                }

                // For other errors, throw with detailed status
                throw new Error(`Failed to load ancestors: HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.articles || [];
        }

        /**
         * Show error message.
         *
         * @param {string} message - Error message
         */
        showError(message) {
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert(message);
            } else {
                alert(message);
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
                this.element.value = '';
                this.element.classList.remove('choices__input', 'choices__input--cloned');
                this.element.removeAttribute('data-choice');
            }

            if (this.pathDisplay) {
                this.pathDisplay.textContent = '';
                if (this.pathDisplay.parentNode) {
                    this.pathDisplay.parentNode.removeChild(this.pathDisplay);
                }
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
        async updateType(newType) {
            // Update type in options
            this.options.type = newType;

            // Reset selection
            if (this.element) {
                this.element.value = '';
            }

            // Clear path display
            if (this.pathDisplay) {
                this.pathDisplay.textContent = '';
            }

            // Load new categories from API
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

                // Prepare new choices data
                const choices = displayCategories.map(cat => ({
                    value: cat.id,
                    label: cat.name,
                    customProperties: {
                        usage_count: cat.usage_count || 0,
                        parent_id: cat.parent_id,
                    }
                }));

                // Set new choices
                this.choices.setChoices(choices, 'value', 'label', true);
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
         * Get selected category.
         *
         * @returns {Object|null} Selected category or null
         */
        getSelectedCategory() {
            const categoryId = parseInt(this.element.value);
            return categoryId ? this.categoryMap.get(categoryId) : null;
        }

        /**
         * Set selected category.
         *
         * @param {number} categoryId - Category ID to select
         */
        async setSelectedCategory(categoryId) {
            if (this.choices) {
                // Get all available choices from _store (not _currentState)
                const availableChoices = this.choices._store?.choices || [];

                // Find the choice we're trying to set
                const targetChoice = availableChoices.find(c => c.value == categoryId || c.value === categoryId.toString());

                if (targetChoice) {
                    // CRITICAL: Use the same type as stored in choices
                    // If value is a number, pass number; if string, pass string
                    const valueToSet = targetChoice.value;

                    this.choices.setChoiceByValue(valueToSet);

                    await this.updatePathDisplay(categoryId);
                } else {
                    console.error('[ChoicesCategoryTree] Category not found in choices:', categoryId);
                }
            } else {
                console.error('[ChoicesCategoryTree] setSelectedCategory failed - no choices instance');
            }
        }
    }

    //=============================================================================
    // UNIFIED EXPORT
    // Export all modules under single namespace
    //=============================================================================

    window.BudgetShared = {
        DateFormatter: DateFormatter,
        CalendarWidget: CalendarWidget,
        ChoicesCategoryTree: ChoicesCategoryTree,
        version: '1.0.0'
    };

})(window);
