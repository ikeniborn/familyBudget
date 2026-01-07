(function() {
  "use strict";
  (function(window2) {
    const _DateFormatter = class _DateFormatter {
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
      static formatForAPI(displayDate) {
        if (!displayDate) return "";
        const parts = displayDate.split(".");
        if (parts.length !== 3) return "";
        const [day, month, year] = parts;
        const paddedMonth = month.padStart(2, "0");
        const paddedDay = day.padStart(2, "0");
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
      static formatForDisplay(isoDate) {
        if (!isoDate) return "";
        const parts = isoDate.split("-");
        if (parts.length !== 3) return "";
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
        const now = /* @__PURE__ */ new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
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
        const now = /* @__PURE__ */ new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
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
      static isValidDisplayFormat(dateStr) {
        if (!dateStr) return false;
        const parts = dateStr.split(".");
        if (parts.length !== 3) return false;
        const [day, month, year] = parts.map(Number);
        if (year < 1900 || year > 2100) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
        const parts = dateStr.split("-");
        if (parts.length !== 3) return false;
        const [year, month, day] = parts.map(Number);
        if (year < 1900 || year > 2100) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
        const d = typeof date === "string" ? new Date(date) : date;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
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
      static parse(dateStr) {
        if (!dateStr) return null;
        let year, month, day;
        if (dateStr.includes(".")) {
          const parts = dateStr.split(".");
          if (parts.length !== 3) return null;
          [day, month, year] = parts.map(Number);
        } else if (dateStr.includes("-")) {
          const parts = dateStr.split("-");
          if (parts.length !== 3) return null;
          [year, month, day] = parts.map(Number);
        } else {
          return null;
        }
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
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
      static formatForDisplayWithMonthName(isoDate) {
        if (!isoDate) return "";
        const parts = isoDate.split("-");
        if (parts.length !== 3) return "";
        const [year, month, day] = parts;
        const monthIndex = parseInt(month, 10) - 1;
        if (monthIndex < 0 || monthIndex > 11) return "";
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
      static formatForAPIFromMonthName(displayDate) {
        if (!displayDate) return "";
        const parts = displayDate.trim().split(/\s+/);
        if (parts.length !== 3) return "";
        const [dayStr, monthName, yearStr] = parts;
        const day = parseInt(dayStr, 10);
        const year = parseInt(yearStr, 10);
        const monthIndex = this.RUSSIAN_MONTHS.findIndex(
          (m) => m.toLowerCase() === monthName.toLowerCase()
        );
        if (monthIndex === -1) return "";
        const month = monthIndex + 1;
        const monthPadded = String(month).padStart(2, "0");
        const dayPadded = String(day).padStart(2, "0");
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
      static isValidMonthNameFormat(dateStr) {
        if (!dateStr) return false;
        const parts = dateStr.trim().split(/\s+/);
        if (parts.length !== 3) return false;
        const [dayStr, monthName, yearStr] = parts;
        const day = parseInt(dayStr, 10);
        const year = parseInt(yearStr, 10);
        if (isNaN(year) || year < 1900 || year > 2100) return false;
        if (isNaN(day) || day < 1 || day > 31) return false;
        const monthIndex = this.RUSSIAN_MONTHS.findIndex(
          (m) => m.toLowerCase() === monthName.toLowerCase()
        );
        if (monthIndex === -1) return false;
        const month = monthIndex + 1;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
        const now = /* @__PURE__ */ new Date();
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
      static setNativeDateInput(inputElement, displayDate) {
        if (!inputElement) return;
        if (displayDate && this.isValidDisplayFormat(displayDate)) {
          inputElement.value = this.formatForAPI(displayDate);
        } else {
          inputElement.value = "";
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
      static getNativeDateInput(inputElement) {
        if (!inputElement || !inputElement.value) return "";
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
      static initNativeDateInput(inputElement) {
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
      static toUserTimezone(utcIsoString, userTimezone = null) {
        if (!utcIsoString) return "";
        try {
          const date = new Date(utcIsoString);
          if (isNaN(date.getTime())) return "";
          const options = {
            timeZone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          };
          const formatter = new Intl.DateTimeFormat("ru-RU", options);
          const parts = formatter.formatToParts(date);
          let day = "", month = "", year = "", hour = "", minute = "";
          for (const part of parts) {
            if (part.type === "day") day = part.value;
            else if (part.type === "month") month = part.value;
            else if (part.type === "year") year = part.value;
            else if (part.type === "hour") hour = part.value;
            else if (part.type === "minute") minute = part.value;
          }
          return `${day}.${month}.${year} ${hour}:${minute}`;
        } catch (e) {
          console.error("DateFormatter.toUserTimezone error:", e);
          return "";
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
      static dateToUserTimezone(utcIsoString, userTimezone = null) {
        if (!utcIsoString) return "";
        try {
          const date = new Date(utcIsoString);
          if (isNaN(date.getTime())) return "";
          const options = {
            timeZone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          };
          const formatter = new Intl.DateTimeFormat("ru-RU", options);
          const parts = formatter.formatToParts(date);
          let day = "", month = "", year = "";
          for (const part of parts) {
            if (part.type === "day") day = part.value;
            else if (part.type === "month") month = part.value;
            else if (part.type === "year") year = part.value;
          }
          return `${day}.${month}.${year}`;
        } catch (e) {
          console.error("DateFormatter.dateToUserTimezone error:", e);
          return "";
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
        return this.dateToUserTimezone((/* @__PURE__ */ new Date()).toISOString(), userTimezone);
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
      static toUtcForApi(localDatetime, userTimezone = null) {
        if (!localDatetime) return null;
        try {
          const match = localDatetime.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
          if (!match) return null;
          const [, day, month, year, hour, minute] = match;
          const dateStr = `${year}-${month}-${day}T${hour}:${minute}:00`;
          const localDate = new Date(dateStr);
          if (userTimezone) {
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: userTimezone,
              timeZoneName: "longOffset"
            });
            const parts = formatter.formatToParts(localDate);
            const tzPart = parts.find((p) => p.type === "timeZoneName");
            if (tzPart) {
              const offsetMatch = tzPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);
              if (offsetMatch) {
                const [, sign, hours, minutes] = offsetMatch;
                const offsetMinutes = (parseInt(hours) * 60 + parseInt(minutes)) * (sign === "+" ? 1 : -1);
                const utcDate = new Date(localDate.getTime() - offsetMinutes * 60 * 1e3);
                return utcDate.toISOString();
              }
            }
          }
          return localDate.toISOString();
        } catch (e) {
          console.error("DateFormatter.toUtcForApi error:", e);
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
      static formatDateTimeWithTz(date, userTimezone = null) {
        if (!date) return "";
        try {
          const d = typeof date === "string" ? new Date(date) : date;
          if (isNaN(d.getTime())) return "";
          const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const options = {
            timeZone: tz,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZoneName: "short"
          };
          const formatter = new Intl.DateTimeFormat("ru-RU", options);
          const parts = formatter.formatToParts(d);
          let day = "", month = "", year = "", hour = "", minute = "", tzName = "";
          for (const part of parts) {
            if (part.type === "day") day = part.value;
            else if (part.type === "month") month = part.value;
            else if (part.type === "year") year = part.value;
            else if (part.type === "hour") hour = part.value;
            else if (part.type === "minute") minute = part.value;
            else if (part.type === "timeZoneName") tzName = part.value;
          }
          return `${day}.${month}.${year} ${hour}:${minute} (${tzName})`;
        } catch (e) {
          console.error("DateFormatter.formatDateTimeWithTz error:", e);
          return "";
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
      static getBrowserTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
    };
    _DateFormatter.RUSSIAN_MONTHS = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря"
    ];
    let DateFormatter = _DateFormatter;
    const _CalendarWidget = class _CalendarWidget {
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
      constructor(options) {
        this.mode = options.mode || "single";
        this.triggerContainer = options.triggerContainer || null;
        this.onSelect = options.onSelect || (() => {
        });
        this.minDate = options.minDate || null;
        this.maxDate = options.maxDate || null;
        if (this.mode === "single") {
          this.inputElement = options.inputElement;
          if (!this.inputElement) {
            throw new Error("CalendarWidget: inputElement is required for single mode");
          }
          this.selectedDate = options.defaultDate || null;
        }
        if (this.mode === "range") {
          this.startInputElement = options.startInputElement;
          this.endInputElement = options.endInputElement;
          if (!this.startInputElement || !this.endInputElement) {
            throw new Error("CalendarWidget: startInputElement and endInputElement are required for range mode");
          }
          this.startDate = null;
          this.endDate = null;
          this.selectingEnd = false;
        }
        this.currentMonth = (/* @__PURE__ */ new Date()).getMonth();
        this.currentYear = (/* @__PURE__ */ new Date()).getFullYear();
        this.isOpen = false;
        this.calendarElement = null;
        this.triggerButton = null;
        this.triggerButtons = [];
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
        if (this.mode === "single" && this.inputElement?.value) {
          const parsed = DateFormatter.parse(this.inputElement.value);
          if (parsed) {
            this.selectedDate = parsed;
            this.currentMonth = parsed.getMonth();
            this.currentYear = parsed.getFullYear();
          }
        }
        if (this.mode === "range") {
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
        if (this.mode === "single") {
          this._createSingleButton(this.inputElement);
        } else {
          if (this.triggerContainer) {
            this._createCustomTriggerButton();
          } else {
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
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost";
        button.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `;
        button.setAttribute("aria-label", "Открыть календарь");
        this.triggerButton = button;
        this.triggerButtons.push(button);
        container.appendChild(button);
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.open();
        });
      }
      /**
       * Create a single calendar button for an input element
       * @private
       */
      _createSingleButton(targetInput) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost btn-sm absolute right-2 top-1/2 -translate-y-1/2";
        button.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `;
        button.setAttribute("aria-label", "Открыть календарь");
        if (!this.triggerButton) {
          this.triggerButton = button;
        }
        this.triggerButtons.push(button);
        if (!targetInput) return;
        const parent = targetInput.parentElement;
        if (!parent) return;
        if (!parent.classList.contains("relative")) {
          const wrapper = document.createElement("div");
          wrapper.className = "relative flex-1";
          if (targetInput.classList.contains("flex-1")) {
            targetInput.classList.remove("flex-1");
            targetInput.classList.add("w-full");
          }
          parent.insertBefore(wrapper, targetInput);
          wrapper.appendChild(targetInput);
          wrapper.appendChild(button);
        } else {
          parent.appendChild(button);
        }
        button.addEventListener("click", (e) => {
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
        this.calendarElement = document.createElement("div");
        this.calendarElement.className = "calendar-widget fixed shadow-lg rounded-lg bg-base-100 border border-base-300";
        this.calendarElement.style.width = "320px";
        this.calendarElement.style.position = "fixed";
        this.calendarElement.style.zIndex = "9999";
        this.calendarElement.style.visibility = "hidden";
        this.calendarElement.style.opacity = "0";
        this.calendarElement.style.transition = "opacity 0.15s ease-out";
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
              ${_CalendarWidget.MONTH_NAMES.map(
          (name, i) => `<option value="${i}" ${i === this.currentMonth ? "selected" : ""}>${name}</option>`
        ).join("")}
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
          ${_CalendarWidget.DAY_NAMES.map(
          (day) => `<div class="text-center text-xs font-medium text-base-content/60 py-1">${day}</div>`
        ).join("")}
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
          ${this.mode === "range" ? `
            <button type="button" class="btn btn-sm btn-ghost flex-1" data-action="clear-range">
              Очистить
            </button>
          ` : ""}
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
        const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
        const startYear = currentYear - 10;
        const endYear = currentYear + 10;
        let options = "";
        for (let year = startYear; year <= endYear; year++) {
          options += `<option value="${year}" ${year === this.currentYear ? "selected" : ""}>${year}</option>`;
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
        let firstDayOfWeek = firstDay.getDay();
        firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const daysInMonth = lastDay.getDate();
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        let html = "";
        for (let i = 0; i < firstDayOfWeek; i++) {
          html += '<div class="aspect-square"></div>';
        }
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(this.currentYear, this.currentMonth, day);
          date.setHours(0, 0, 0, 0);
          const isToday = date.getTime() === today.getTime();
          const isDisabled = this._isDateDisabled(date);
          const isSelected = this._isDateSelected(date);
          const isInRange = this._isDateInRange(date);
          const isRangeBoundary = this._isRangeBoundary(date);
          let btnClass = "btn btn-sm btn-ghost w-full aspect-square p-0";
          if (isToday) btnClass += " border border-primary";
          if (isSelected) btnClass += " btn-primary";
          if (isRangeBoundary) btnClass += " border-2 border-error";
          if (isInRange && !isSelected) btnClass += " bg-range-highlight";
          if (isDisabled) btnClass += " btn-disabled opacity-30";
          html += `
        <button
          type="button"
          class="${btnClass}"
          data-date="${this._formatDateISO(date)}"
          ${isDisabled ? "disabled" : ""}
          aria-label="${day} ${_CalendarWidget.MONTH_NAMES[this.currentMonth]} ${this.currentYear}"
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
        if (this.mode === "single") {
          return !!(this.selectedDate && date.getTime() === this.selectedDate.getTime());
        }
        if (this.mode === "range") {
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
      _isDateInRange(date) {
        if (this.mode !== "range" || !this.startDate || !this.endDate) return false;
        return date > this.startDate && date < this.endDate;
      }
      /**
       * Check if date is a range boundary (start or end date)
       * @private
       */
      _isRangeBoundary(date) {
        if (this.mode !== "range") return false;
        const startMatch = !!(this.startDate && date.getTime() === this.startDate.getTime());
        const endMatch = !!(this.endDate && date.getTime() === this.endDate.getTime());
        return startMatch || endMatch;
      }
      /**
       * Format date to ISO string (YYYY-MM-DD)
       * @private
       */
      _formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      /**
       * Attach event listeners
       * @private
       */
      _attachEventListeners() {
        this.calendarElement?.addEventListener("click", (e) => {
          e.stopPropagation();
          const target = e.target?.closest("[data-action]");
          if (!target) return;
          const action = target.dataset.action;
          switch (action) {
            case "prev-month":
              this.previousMonth();
              break;
            case "next-month":
              this.nextMonth();
              break;
            case "today":
              this.selectToday();
              break;
            case "clear-range":
              this.clearRange();
              break;
            case "close":
              this.applyAndClose();
              break;
          }
        });
        this.calendarElement?.addEventListener("change", (e) => {
          const target = e.target;
          if (target?.dataset.action === "select-month") {
            this.currentMonth = parseInt(target.value);
            this._render();
          }
          if (target?.dataset.action === "select-year") {
            this.currentYear = parseInt(target.value);
            this._render();
          }
        });
        this.calendarElement?.addEventListener("click", (e) => {
          e.stopPropagation();
          const dateButton = e.target?.closest("[data-date]");
          if (!dateButton || dateButton.disabled) return;
          const dateStr = dateButton.dataset.date;
          const date = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
          this._handleDateSelection(date);
        });
        document.addEventListener("click", (e) => {
          if (!this.isOpen) return;
          if (this.calendarElement?.contains(e.target)) return;
          const clickedButton = this.triggerButtons.some((btn) => btn.contains(e.target));
          if (clickedButton) return;
          if (this.mode === "range") return;
          this.close();
        });
        document.addEventListener("keydown", (e) => {
          if (!this.isOpen) return;
          if (e.key === "Escape") {
            this.close();
            e.preventDefault();
          }
        });
        if (this.mode === "single" && this.inputElement) {
          this.inputElement.addEventListener("blur", () => {
            const value = this.inputElement?.value || "";
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
      _handleDateSelection(date) {
        if (this.mode === "single") {
          this.selectedDate = date;
          const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
          if (this.inputElement) {
            this.inputElement.value = displayDate;
          }
          this.onSelect(displayDate);
          this.close();
        }
        if (this.mode === "range") {
          if (!this.startDate || this.startDate && this.endDate) {
            this.startDate = date;
            this.endDate = null;
            this.selectingEnd = true;
            const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
            if (this.startInputElement) {
              this.startInputElement.value = displayDate;
            }
            if (this.endInputElement) {
              this.endInputElement.value = "";
            }
            this._render();
          } else {
            if (date < this.startDate) {
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
            this._render();
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
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        this._handleDateSelection(today);
      }
      /**
       * Clear range selection
       */
      clearRange() {
        if (this.mode !== "range") return;
        this.startDate = null;
        this.endDate = null;
        if (this.startInputElement) {
          this.startInputElement.value = "";
        }
        if (this.endInputElement) {
          this.endInputElement.value = "";
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
        const targetInput = this.mode === "single" ? this.inputElement : this.startInputElement;
        if (!targetInput) return;
        const dialogElement = targetInput?.closest("dialog[open]");
        if (dialogElement) {
          const modalBox = dialogElement.querySelector(".modal-box");
          if (modalBox && this.calendarElement && this.calendarElement.parentElement !== modalBox) {
            this._originalParent = this.calendarElement.parentElement;
            if (this.calendarElement) {
              modalBox.appendChild(this.calendarElement);
            }
            this.calendarElement?.classList.remove("fixed");
            this.calendarElement?.classList.add("absolute");
            if (this.calendarElement) {
              this.calendarElement.style.position = "absolute";
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
          this._originalParent.appendChild(this.calendarElement);
          this.calendarElement.classList.remove("absolute");
          this.calendarElement.classList.add("fixed");
          this.calendarElement.style.position = "fixed";
          this._isInsideDialog = false;
          this._originalParent = null;
        }
      }
      /**
       * Open calendar
       */
      open() {
        this.isOpen = true;
        this._moveToDialog();
        if (this.calendarElement) {
          this.calendarElement.style.visibility = "visible";
          this.calendarElement.style.opacity = "0";
        }
        this._positionCalendar();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (this.calendarElement) {
              this.calendarElement.style.opacity = "1";
            }
            this._render();
          });
        });
      }
      /**
       * Position calendar relative to input element
       * Uses fixed positioning for non-dialog, absolute positioning for dialog
       * @private
       */
      _positionCalendar() {
        const targetInput = this.mode === "single" ? this.inputElement : this.startInputElement;
        if (!targetInput) return;
        const inputRect = targetInput.getBoundingClientRect();
        const calendarWidth = 320;
        const calendarRect = this.calendarElement?.getBoundingClientRect();
        const calendarHeight = calendarRect?.height || 400;
        const viewportWidth = document.documentElement.clientWidth || window2.innerWidth;
        const viewportHeight = window2.innerHeight;
        const isDesktop = viewportWidth >= 768;
        const spacing = isDesktop ? 4 : 8;
        let scrollTop = 0;
        let scrollLeft = 0;
        let modalBox = null;
        if (this._isInsideDialog) {
          modalBox = this.calendarElement?.parentElement || null;
          if (modalBox) {
            scrollTop = modalBox.scrollTop;
            scrollLeft = modalBox.scrollLeft;
          }
        }
        let top, left;
        if (this._isInsideDialog && modalBox) {
          const modalRect = modalBox.getBoundingClientRect();
          const inputOffsetTop = inputRect.top - modalRect.top + scrollTop;
          const inputOffsetLeft = inputRect.left - modalRect.left + scrollLeft;
          top = inputOffsetTop + inputRect.height + spacing;
          left = inputOffsetLeft;
        } else {
          top = inputRect.bottom + spacing;
          left = inputRect.left;
        }
        if (isDesktop && !this._isInsideDialog) {
          left = inputRect.right - calendarWidth;
        } else if (isDesktop && this._isInsideDialog && modalBox) {
          const modalRect = modalBox.getBoundingClientRect();
          left = inputRect.right - modalRect.left + scrollLeft - calendarWidth;
        }
        if (!isDesktop && left + calendarWidth > viewportWidth) {
          left = viewportWidth - calendarWidth - spacing;
        }
        if (left < spacing) {
          left = spacing;
        }
        let spaceBelow, spaceAbove;
        if (this._isInsideDialog && modalBox) {
          const modalHeight = modalBox.clientHeight;
          const inputOffsetTop = inputRect.top - modalBox.getBoundingClientRect().top + scrollTop;
          spaceBelow = modalHeight - (inputOffsetTop + inputRect.height);
          spaceAbove = inputOffsetTop;
          if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
            top = inputOffsetTop - calendarHeight - spacing;
          }
        } else {
          spaceBelow = viewportHeight - inputRect.bottom;
          spaceAbove = inputRect.top;
          if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
            top = inputRect.top - calendarHeight - spacing;
          }
        }
        if (viewportWidth < 768) {
          const parent = this.calendarElement?.parentElement;
          const isInsideModalBox = parent && parent.classList && parent.classList.contains("modal-box");
          if (isInsideModalBox) {
            const modalWidth = parent.clientWidth;
            left = (modalWidth - calendarWidth) / 2;
            if (left < spacing) left = spacing;
          } else {
            left = Math.round((viewportWidth - calendarWidth) / 2);
            const minOffset = spacing;
            const maxOffset = viewportWidth - calendarWidth - spacing;
            left = Math.max(minOffset, Math.min(left, maxOffset));
            top = (viewportHeight - calendarHeight) / 2;
            if (top < spacing) top = spacing;
          }
        }
        if (isDesktop) {
          const parent = this.calendarElement?.parentElement;
          const isInsideModalBox = parent && parent.classList && parent.classList.contains("modal-box");
          if (isInsideModalBox) {
            const modalWidth = parent.clientWidth;
            left = (modalWidth - calendarWidth) / 2;
          }
        }
        if (this.calendarElement) {
          this.calendarElement.style.top = `${top}px`;
          this.calendarElement.style.left = `${left}px`;
        }
      }
      /**
       * Apply selection and close calendar (called by "Закрыть" button)
       */
      applyAndClose() {
        if (this.mode === "range" && this.startDate && this.endDate) {
          const startDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.startDate));
          const endDisplay = DateFormatter.formatForDisplay(this._formatDateISO(this.endDate));
          this.onSelect(startDisplay, endDisplay);
        }
        this.close();
      }
      /**
       * Close calendar
       */
      close() {
        this.isOpen = false;
        if (this.calendarElement) {
          this.calendarElement.style.visibility = "hidden";
          this.calendarElement.style.opacity = "0";
        }
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
        if (this.isOpen) {
          this.close();
        }
        if (this.calendarElement) {
          this.calendarElement.remove();
        }
        this.triggerButtons.forEach((btn) => {
          if (btn && btn.parentNode) {
            btn.remove();
          }
        });
        this.triggerButtons = [];
        this.triggerButton = null;
        this.calendarElement = null;
      }
    };
    _CalendarWidget.MONTH_NAMES = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь"
    ];
    _CalendarWidget.DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    let CalendarWidget = _CalendarWidget;
    const _ChoicesCategoryTree = class _ChoicesCategoryTree {
      /**
       * Initialize Web Worker for category hierarchy processing.
       * Called automatically on first use, or can be preloaded.
       */
      static initializeWorker() {
        if (!this._workerWrapper && typeof window2.WorkerWrapper !== "undefined") {
          try {
            this._workerWrapper = new window2.WorkerWrapper("/static/js/workers/hierarchyWorker.min.js", {
              idleTimeout: 3e4,
              // 30s for category tree (less aggressive than default)
              debugMode: window2.DEBUG_MODE || false
            });
          } catch (error) {
            console.warn("[ChoicesCategoryTree] Failed to initialize worker:", error);
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
      static async preloadCategories(options = {}) {
        const apiBaseUrl = options.apiBaseUrl || "/api/v1";
        const showInactive = options.showInactive || false;
        const types = ["expense", "income", "debit", "credit"];
        const preloadPromises = types.map(async (type) => {
          const cacheKey = `${type}:${showInactive}:all`;
          if (_ChoicesCategoryTree._cache.has(cacheKey)) {
            if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] ${type} categories already cached, skipping preload`);
            return;
          }
          if (_ChoicesCategoryTree._pendingRequests.has(cacheKey)) {
            if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] ${type} categories request already in progress, waiting`);
            return _ChoicesCategoryTree._pendingRequests.get(cacheKey);
          }
          const url = `${apiBaseUrl}/articles?type=${type}&sort_by=usage_count&limit=1000&include_inactive=${showInactive}`;
          try {
            const response = await fetch(url, {
              credentials: "same-origin"
            });
            if (!response.ok) {
              console.warn(`[ChoicesCategoryTree] Failed to preload ${type} categories: HTTP ${response.status}`);
              return;
            }
            const data = await response.json();
            const categories = data.articles || [];
            _ChoicesCategoryTree._cache.set(cacheKey, {
              data: categories,
              timestamp: Date.now()
            });
            if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Preloaded ${categories.length} ${type} categories`);
          } catch (error) {
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
      constructor(selector, options = {}) {
        this.selector = selector;
        this.element = document.querySelector(selector);
        if (!this.element) {
          console.error(`[ChoicesCategoryTree] Element not found: ${selector}`);
          return;
        }
        this.auth = options.auth || null;
        this.options = {
          type: options.type || "expense",
          // Support both callback names for compatibility (onChange for analytics page)
          onCategoryChange: options.onCategoryChange || options.onChange || null,
          apiBaseUrl: options.apiBaseUrl || "/api/v1",
          showLeafOnly: options.showLeafOnly !== false,
          // Default true
          showInactive: options.showInactive || false,
          // Default false - hide archived categories
          financialCenterId: options.financialCenterId || null,
          // Filter by FC (null = all)
          // Multi-select support (for analytics page category filter)
          multiple: options.multiple || false,
          showPath: options.showPath !== false,
          // Default true - show breadcrumb path
          showClearButton: options.showClearButton !== false,
          // Default true - show clear-all button for multiple mode
          mode: options.mode || "edit"
          // NEW: 'create' | 'edit' - controls selection preservation in updateFinancialCenter()
        };
        console.log(`[ChoicesCategoryTree] Constructor initialized with mode: ${this.options.mode}`);
        this.choices = null;
        this.categories = [];
        this.categoryMap = /* @__PURE__ */ new Map();
        this.childrenMap = /* @__PURE__ */ new Map();
        this._initPromise = null;
        this.init();
      }
      /**
       * Initialize component.
       */
      async init() {
        try {
          await this.loadCategories();
          this.buildHierarchyMaps();
          const displayCategories = this.options.showLeafOnly ? this.getLeafCategories() : this.categories;
          this.initChoices(displayCategories);
        } catch (error) {
          console.error("[ChoicesCategoryTree] Initialization error:", error);
          this.showError("Ошибка загрузки категорий");
        }
      }
      /**
       * Load categories from API.
       * Uses Bearer token (WebApp) or cookie-based auth (web interface).
       */
      async loadCategories() {
        const fcPart = this.options.financialCenterId || "all";
        const cacheKey = `${this.options.type}:${this.options.showInactive}:${fcPart}`;
        const cached = _ChoicesCategoryTree._cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 3e4) {
          this.categories = cached.data;
          return;
        }
        const pendingRequest = _ChoicesCategoryTree._pendingRequests.get(cacheKey);
        if (pendingRequest) {
          this.categories = await pendingRequest;
          return;
        }
        if (!navigator.onLine) {
          if (typeof window2.debugLog === "function") window2.debugLog("[ChoicesCategoryTree] Offline mode - skipping API call, using cache");
          const fallbackKey = `${this.options.type}:${this.options.showInactive}:all`;
          const fallback = _ChoicesCategoryTree._cache.get(fallbackKey);
          if (fallback) {
            this.categories = fallback.data;
            return;
          }
          this.categories = [];
          return;
        }
        let url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}&sort_by=usage_count&limit=1000&include_inactive=${this.options.showInactive}`;
        if (this.options.financialCenterId) {
          url += `&financial_center_id=${this.options.financialCenterId}`;
        }
        const headers = {};
        if (this.auth && typeof this.auth.getToken === "function") {
          const token = this.auth.getToken();
          if (!token) {
            throw new Error("No authentication token available");
          }
          headers["Authorization"] = `Bearer ${token}`;
        }
        const requestPromise = fetch(url, {
          headers,
          credentials: "same-origin"
          // Include cookies
        }).then(async (response) => {
          if (!response.ok) {
            if (response.status === 401) {
              if (typeof window2.debugLog === "function") window2.debugLog("[ChoicesCategoryTree] User not authenticated - categories not loaded (this is expected for unauthenticated users)");
              return [];
            }
            throw new Error(`Failed to load categories: HTTP ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          const categories = data.articles || [];
          _ChoicesCategoryTree._cache.set(cacheKey, {
            data: categories,
            timestamp: Date.now()
          });
          return categories;
        }).catch((error) => {
          console.warn("[ChoicesCategoryTree] Network error loading categories (offline?):", error.message);
          const staleCache = _ChoicesCategoryTree._cache.get(cacheKey);
          if (staleCache && staleCache.data && staleCache.data.length > 0) {
            if (typeof window2.debugLog === "function") window2.debugLog("[ChoicesCategoryTree] Using stale cache for offline mode");
            return staleCache.data;
          }
          if (this.options.financialCenterId) {
            const allCacheKey = `${this.options.type}:${this.options.showInactive}:all`;
            const allCache = _ChoicesCategoryTree._cache.get(allCacheKey);
            if (allCache && allCache.data && allCache.data.length > 0) {
              if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Offline: No cache for FC ${this.options.financialCenterId}, using all categories`);
              return allCache.data;
            }
          }
          console.warn("[ChoicesCategoryTree] No cached categories available for offline mode");
          return [];
        }).finally(() => {
          _ChoicesCategoryTree._pendingRequests.delete(cacheKey);
        });
        _ChoicesCategoryTree._pendingRequests.set(cacheKey, requestPromise);
        this.categories = await requestPromise;
      }
      /**
       * Build hierarchy maps for efficient lookups.
       * Uses Web Worker for performance (with automatic fallback to sync processing).
       */
      async buildHierarchyMaps() {
        const startTime = performance.now();
        if (_ChoicesCategoryTree._workerWrapper && this.categories.length > 0) {
          try {
            _ChoicesCategoryTree.initializeWorker();
            const result = await _ChoicesCategoryTree._workerWrapper.execute({
              action: "buildMaps",
              data: { categories: this.categories }
            });
            this.categoryMap = new Map(Object.entries(result.categoryMap));
            this.childrenMap = new Map(
              Object.entries(result.childrenMap).map(([key, val]) => [parseInt(key), val])
            );
            const duration2 = Math.round(performance.now() - startTime);
            if (window2.DEBUG_MODE) {
              console.log(`[ChoicesCategoryTree] Worker buildMaps: ${duration2}ms (${this.categories.length} categories)`);
            }
            if (this._initPromise) {
              this._initPromise();
              this._initPromise = null;
            }
            return;
          } catch (error) {
            console.warn("[ChoicesCategoryTree] Worker buildMaps failed, using synchronous:", error);
          }
        }
        this.categoryMap.clear();
        this.childrenMap.clear();
        for (const category of this.categories) {
          this.categoryMap.set(category.id, category);
          if (category.parent_id) {
            if (!this.childrenMap.has(category.parent_id)) {
              this.childrenMap.set(category.parent_id, []);
            }
            this.childrenMap.get(category.parent_id).push(category.id);
          }
        }
        const duration = Math.round(performance.now() - startTime);
        if (window2.DEBUG_MODE) {
          console.log(`[ChoicesCategoryTree] Synchronous buildMaps: ${duration}ms (${this.categories.length} categories)`);
        }
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
      async waitForReady() {
        if (this.categoryMap && this.categoryMap.size > 0 && this.choices && this.choices._store?.choices.length > 0) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          this._initPromise = resolve;
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
        return this.categories.filter((cat) => {
          if (typeof cat.is_leaf === "boolean") {
            return cat.is_leaf;
          }
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
      getParentChain(categoryId) {
        const category = this.categoryMap.get(categoryId);
        if (!category || !category.parent_id) {
          return [];
        }
        if (this.categories.length > 100 && _ChoicesCategoryTree._workerWrapper) {
          return this._getParentChainWorker(categoryId);
        }
        return this._getParentChainSync(categoryId);
      }
      /**
       * Synchronous parent chain (original implementation).
       * @private
       */
      _getParentChainSync(categoryId) {
        const chain = [];
        const category = this.categoryMap.get(categoryId);
        if (!category || !category.parent_id) {
          return chain;
        }
        let currentParentId = category.parent_id;
        while (currentParentId) {
          const parent = this.categoryMap.get(currentParentId);
          if (!parent) break;
          chain.unshift(parent);
          currentParentId = parent.parent_id;
        }
        return chain;
      }
      /**
       * Worker-based parent chain for large datasets.
       * @private
       */
      async _getParentChainWorker(categoryId) {
        try {
          _ChoicesCategoryTree.initializeWorker();
          const categoryMap = Object.fromEntries(this.categoryMap);
          const result = await _ChoicesCategoryTree._workerWrapper?.execute({
            action: "getParentChain",
            data: { categoryId, categoryMap }
          });
          return result;
        } catch (error) {
          console.warn("[ChoicesCategoryTree] Worker getParentChain failed, using synchronous:", error);
          return this._getParentChainSync(categoryId);
        }
      }
      /**
       * Initialize Choices.js with categories.
       *
       * @param {Array} categories - Categories to display
       */
      initChoices(categories) {
        if (this.element) {
          this.element.innerHTML = "";
        }
        const choices = categories.map((cat) => {
          const parentChain = this.getParentChain(cat.id);
          const parentText = Array.isArray(parentChain) && parentChain.length > 0 ? parentChain.map((p) => p.name).join(" › ") : "";
          return {
            value: cat.id,
            label: cat.name,
            customProperties: {
              usage_count: cat.usage_count || 0,
              parent_id: cat.parent_id,
              parent_text: parentText
              // Store formatted parent chain
            }
          };
        });
        this.choices = new Choices(this.element, {
          searchEnabled: true,
          searchPlaceholderValue: "Поиск категории...",
          placeholder: true,
          // Different placeholder for single/multiple modes
          placeholderValue: this.options.multiple ? "" : "— Выберите категорию —",
          noResultsText: "Не найдено",
          noChoicesText: "Нет доступных категорий",
          itemSelectText: "",
          shouldSort: false,
          // Keep our API sorting (by usage_count)
          // Enable/disable individual remove buttons based on showClearButton option
          // If showClearButton=true: use clear-all button, disable individual remove
          // If showClearButton=false: enable individual remove buttons
          removeItemButton: this.options.multiple && !this.options.showClearButton,
          // Fuzzy search configuration (built-in Fuse.js)
          fuseOptions: {
            threshold: 0.3,
            // Match threshold (0.0 = perfect, 1.0 = anything)
            distance: 100,
            // Character distance for matches
            ignoreLocation: true,
            // Don't care where in string match occurs
            keys: ["label"]
            // Search in label field
          },
          // Custom templates for dropdown items (show parent chain)
          callbackOnCreateTemplates: (template) => {
            return this.options.multiple ? this._createMultipleTemplates(template) : this._createSingleTemplates(template);
          },
          // Styling
          classNames: {
            containerOuter: ["choices", "choices-tailwind", this.options.multiple ? "is-multiple" : ""].filter(Boolean),
            containerInner: ["choices__inner"],
            input: ["choices__input"],
            inputCloned: ["choices__input--cloned"],
            list: ["choices__list"],
            listItems: ["choices__list--multiple"],
            listSingle: ["choices__list--single"],
            listDropdown: ["choices__list--dropdown"],
            item: ["choices__item"],
            itemSelectable: ["choices__item--selectable"],
            itemDisabled: ["choices__item--disabled"],
            itemChoice: ["choices__item--choice"],
            placeholder: ["choices__placeholder"],
            group: ["choices__group"],
            groupHeading: ["choices__heading"],
            button: ["choices__button"]
          }
        });
        if (this.choices) {
          this.choices.setChoices(choices, "value", "label", false);
        }
        if (this.element) {
          this.element.addEventListener("change", (event) => {
            console.log("[ChoicesCategoryTree] Change event:", {
              elementId: this.element?.id,
              value: event.target?.value,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
            this.handleCategoryChange(event);
          });
        }
        if (this.choices && this.element) {
          this.element.addEventListener("showDropdown", () => {
            console.log("[ChoicesCategoryTree] Dropdown opened:", {
              elementId: this.element?.id,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          });
          this.element.addEventListener("hideDropdown", () => {
            console.log("[ChoicesCategoryTree] Dropdown closed:", {
              elementId: this.element?.id,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          });
          this.element.addEventListener("choice", (event) => {
            const customEvent = event;
            console.log("[ChoicesCategoryTree] Item selected:", {
              elementId: this.element?.id,
              choiceId: customEvent.detail?.choice?.value,
              choiceLabel: customEvent.detail?.choice?.label,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          });
        }
        if (this.options.multiple && this.options.showClearButton) {
          this._addClearAllButton();
        }
      }
      /**
       * Create templates for single-select mode (existing behavior).
       * @private
       */
      _createSingleTemplates(template) {
        return {
          // Dropdown item template (shown in dropdown list)
          choice: (classNames, data) => {
            const parentText = data.customProperties?.parent_text || "";
            const label = data.label;
            return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : "data-choice-selectable"}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.groupId > 0 ? 'role="treeitem"' : 'role="option"'}
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ""}
                    </div>
                `);
          },
          // Selected item template (shown after selection)
          item: (classNames, data) => {
            return template(`
                    <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}"
                         data-item
                         data-id="${data.id}"
                         data-value="${data.value}"
                         ${data.active ? 'aria-selected="true"' : ""}
                         ${data.disabled ? 'aria-disabled="true"' : ""}>
                        ${data.label}
                    </div>
                `);
          }
        };
      }
      /**
       * Create templates for multi-select mode.
       * When showClearButton=false: badges with individual remove buttons
       * When showClearButton=true: comma-separated text (use clear-all button)
       * @private
       */
      _createMultipleTemplates(template) {
        const showRemoveButtons = !this.options.showClearButton;
        return {
          // Dropdown item template (same as single - shows parent chain)
          choice: (classNames, data) => {
            const parentText = data.customProperties?.parent_text || "";
            const label = data.label;
            return template(`
                    <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
                         data-select-text=""
                         data-choice
                         ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : "data-choice-selectable"}
                         data-id="${data.id}"
                         data-value="${data.value}"
                         role="option"
                         style="padding-left: 0.75rem;">
                        <span style="font-weight: 500;">${label}</span>
                        ${parentText ? `<span style="font-size: 0.85em; color: #999; margin-left: 0.5em;">(${parentText})</span>` : ""}
                    </div>
                `);
          },
          // Selected item template
          item: (classNames, data) => {
            if (showRemoveButtons) {
              return template(`
                        <div class="${classNames.item} choices__item--badge"
                             data-item
                             data-id="${data.id}"
                             data-value="${data.value}"
                             ${data.active ? 'aria-selected="true"' : ""}
                             ${data.disabled ? 'aria-disabled="true"' : ""}>
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
              return template(`
                        <span class="${classNames.item} choices__item--comma"
                              data-item
                              data-id="${data.id}"
                              data-value="${data.value}"
                              ${data.active ? 'aria-selected="true"' : ""}
                              ${data.disabled ? 'aria-disabled="true"' : ""}>
                            ${data.label}
                        </span>
                    `);
            }
          }
        };
      }
      /**
       * Add "Clear All" button under the form (for multiple mode).
       * @private
       */
      _addClearAllButton() {
        const choicesContainer = this.element?.closest(".choices");
        if (!choicesContainer) return;
        const wrapper = document.createElement("div");
        wrapper.className = "choices__clear-wrapper";
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "choices__clear-all";
        clearBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        `;
        clearBtn.title = "Очистить все";
        clearBtn.style.display = "none";
        wrapper.appendChild(clearBtn);
        if (choicesContainer.parentElement) {
          choicesContainer.parentElement.insertBefore(wrapper, choicesContainer.nextSibling);
        }
        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.clearSelection();
        });
        this._clearAllBtn = clearBtn;
      }
      /**
       * Update clear-all button visibility based on selection.
       * @private
       */
      _updateClearAllVisibility() {
        if (!this._clearAllBtn) return;
        const hasItems = this.choices?.getValue()?.length > 0;
        this._clearAllBtn.style.display = hasItems ? "flex" : "none";
      }
      /**
       * Handle category change event.
       * Supports both single and multiple selection modes.
       *
       * @param {Event} event - Change event
       */
      async handleCategoryChange(event) {
        if (!this.options.onCategoryChange) return;
        if (this.options.multiple) {
          const selectedItems = this.choices?.getValue() || [];
          const selectedCategories = selectedItems.map((item) => {
            const categoryId = parseInt(item.value);
            return this.categoryMap.get(categoryId);
          }).filter(Boolean);
          this.options.onCategoryChange(selectedCategories);
          this._updateClearAllVisibility();
        } else {
          const categoryId = parseInt(event.target.value);
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
      showError(message) {
        if (window2.Telegram && window2.Telegram.WebApp) {
          window2.Telegram.WebApp.showAlert(message);
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
        if (this.element) {
          this.element.value = "";
          this.element.classList.remove("choices__input", "choices__input--cloned");
          this.element.removeAttribute("data-choice");
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
        this.options.type = newType;
        if (this.options.multiple && this.choices) {
          this.choices.removeActiveItems();
          this._updateClearAllVisibility();
        }
        if (this.element) {
          this.element.value = "";
        }
        try {
          await this.loadCategories();
          this.buildHierarchyMaps();
          const displayCategories = this.options.showLeafOnly ? this.getLeafCategories() : this.categories;
          if (this.choices) {
            this.choices.clearStore();
            const choices = displayCategories.map((cat) => {
              const parentChain = this.getParentChain(cat.id);
              const parentText = Array.isArray(parentChain) && parentChain.length > 0 ? parentChain.map((p) => p.name).join(" › ") : "";
              return {
                value: cat.id,
                label: cat.name,
                customProperties: {
                  usage_count: cat.usage_count || 0,
                  parent_id: cat.parent_id,
                  parent_text: parentText
                }
              };
            });
            this.choices.setChoices(choices, "value", "label", false);
            this.choices.removeActiveItems();
            if (this.element) {
              this.element.value = "";
            }
            if (choices.length === 0) {
              console.warn(`[ChoicesCategoryTree] No ${newType} categories available - user may be offline without cached data`);
            }
          }
        } catch (error) {
          console.error("[ChoicesCategoryTree] Error updating type:", error);
        }
      }
      /**
       * Refresh categories (reload from API).
       */
      async refresh() {
        if (this.choices) {
          this.choices.destroy();
          this.choices = null;
        }
        await this.init();
      }
      /**
       * Update financial center ID for category filtering.
       * Invalidates specific FC cache and reloads categories.
       * In offline mode, falls back to "all" categories cache.
       *
       * @param {number|null} financialCenterId - Financial center ID (null = show all)
       */
      async updateFinancialCenter(financialCenterId) {
        console.log(`[ChoicesCategoryTree] ========== updateFinancialCenter START ==========`);
        console.log(`[ChoicesCategoryTree] Input: financialCenterId=${financialCenterId}`);
        console.log(`[ChoicesCategoryTree] Current options:`, {
          type: this.options.type,
          showLeafOnly: this.options.showLeafOnly,
          previousFinancialCenterId: this.options.financialCenterId
        });
        const previousFcId = this.options.financialCenterId;
        const isInitialFiltering = previousFcId === null && financialCenterId !== null;
        console.log(`[ChoicesCategoryTree] Filter change type:`, {
          previousFcId,
          newFcId: financialCenterId,
          isInitialFiltering,
          note: isInitialFiltering ? "Initial filter - do NOT preserve selection" : "FC changed - preserve if valid"
        });
        this.options.financialCenterId = financialCenterId;
        if (financialCenterId) {
          const specificCacheKey = `${this.options.type}:${this.options.showInactive}:${financialCenterId}`;
          _ChoicesCategoryTree._cache.delete(specificCacheKey);
          console.log(`[ChoicesCategoryTree] Invalidated cache for key: ${specificCacheKey}`);
        }
        const elementValue = this.element ? this.element.value : null;
        const previousSelectionId = elementValue ? parseInt(elementValue) : null;
        const activeItems = this.choices ? this.choices.getValue(true) : null;
        const hasActiveSelection = activeItems && Array.isArray(activeItems) && activeItems.length > 0;
        console.log(`[ChoicesCategoryTree] Current selection state:`, {
          elementValue,
          previousSelectionId,
          activeItems,
          hasActiveSelection,
          note: elementValue && !hasActiveSelection ? "Element has value but Choices.js not synced yet" : "OK"
        });
        try {
          await this.loadCategories();
          console.log(`[ChoicesCategoryTree] Loaded categories:`, {
            totalCount: this.categories.length,
            categoryMapSize: this.categoryMap.size,
            sampleCategories: this.categories.slice(0, 3).map((c) => ({ id: c.id, name: c.name }))
          });
          this.buildHierarchyMaps();
          const displayCategories = this.options.showLeafOnly ? this.getLeafCategories() : this.categories;
          console.log(`[ChoicesCategoryTree] Display categories after leaf filter:`, {
            displayCount: displayCategories.length,
            showLeafOnly: this.options.showLeafOnly
          });
          if (this.choices) {
            this.choices.clearStore();
            const choices = displayCategories.map((cat) => {
              const parentChain = this.getParentChain(cat.id);
              const parentText = Array.isArray(parentChain) && parentChain.length > 0 ? parentChain.map((p) => p.name).join(" › ") : "";
              return {
                value: cat.id,
                label: cat.name,
                customProperties: {
                  usage_count: cat.usage_count || 0,
                  parent_id: cat.parent_id,
                  parent_text: parentText
                }
              };
            });
            console.log(`[ChoicesCategoryTree] Prepared choices for Choices.js:`, {
              choicesCount: choices.length,
              sampleChoices: choices.slice(0, 3).map((c) => ({ value: c.value, label: c.label }))
            });
            this.choices.setChoices(choices, "value", "label", false);
            const categoryStillAvailable = previousSelectionId && this.categoryMap.has(previousSelectionId);
            console.log(`[ChoicesCategoryTree] Checking if category still available:`, {
              previousSelectionId,
              categoryMapHasIt: previousSelectionId ? this.categoryMap.has(previousSelectionId) : "N/A",
              categoryStillAvailable,
              isInitialFiltering,
              willPreserve: categoryStillAvailable,
              // Always preserve if available (isInitialFiltering check removed)
              categoryMapKeys: Array.from(this.categoryMap.keys()).slice(0, 10)
            });
            const shouldPreserve = this.options.mode === "edit" && categoryStillAvailable;
            console.log(`[ChoicesCategoryTree] Selection preservation decision:`, {
              mode: this.options.mode,
              categoryStillAvailable,
              shouldPreserve,
              previousSelectionId
            });
            if (shouldPreserve) {
              console.log(`[ChoicesCategoryTree] ✅ PRESERVING selection (edit mode): ${previousSelectionId} (available in FC ${financialCenterId})`);
              await this.setSelectedCategory(previousSelectionId);
              if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Preserved selection: ${previousSelectionId}`);
            } else {
              this.choices.removeActiveItems();
              if (this.element) {
                this.element.value = "";
              }
              if (this.options.mode === "create") {
                console.log(`[ChoicesCategoryTree] ❌ CLEARING selection (create mode) - previousSelectionId: ${previousSelectionId}`);
                if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Cleared selection (create mode)`);
              } else if (!categoryStillAvailable && previousSelectionId) {
                console.log(`[ChoicesCategoryTree] ❌ CLEARING selection: category ${previousSelectionId} not available for FC ${financialCenterId}`);
                if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Cleared selection (category not available)`);
              } else {
                console.log(`[ChoicesCategoryTree] ℹ️ No previous selection - keeping empty`);
                if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] No previous selection - keeping empty`);
              }
            }
            if (financialCenterId) {
              if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Filtered to FC ${financialCenterId}: ${choices.length} categories`);
            } else {
              if (typeof window2.debugLog === "function") window2.debugLog(`[ChoicesCategoryTree] Showing all categories: ${choices.length}`);
            }
            if (choices.length === 0 && !navigator.onLine) {
              console.warn(`[ChoicesCategoryTree] Offline: No categories available for FC ${financialCenterId}`);
            }
          }
          console.log(`[ChoicesCategoryTree] ========== updateFinancialCenter END ==========`);
          console.log(`[ChoicesCategoryTree] Final state:`, {
            financialCenterId: this.options.financialCenterId,
            categoriesCount: this.categories.length,
            finalElementValue: this.element ? this.element.value : null,
            finalActiveItems: this.choices ? this.choices.getValue(true) : null
          });
        } catch (error) {
          console.error("[ChoicesCategoryTree] ❌ ERROR in updateFinancialCenter:", error);
          console.log(`[ChoicesCategoryTree] ========== updateFinancialCenter END (ERROR) ==========`);
        }
      }
      /**
       * Get selected category.
       *
       * @returns {Object|null} Selected category or null
       */
      getSelectedCategory() {
        const categoryId = this.element ? parseInt(this.element.value) : NaN;
        return categoryId ? this.categoryMap.get(categoryId) : null;
      }
      /**
       * Clear category selection.
       * Used in create modals to reset selection state.
       */
      clearSelection() {
        console.log("[ChoicesCategoryTree] clearSelection() called");
        if (this.choices) {
          this.choices.removeActiveItems();
          console.log("[ChoicesCategoryTree] Choices.js active items removed");
        }
        if (this.element) {
          this.element.value = "";
          console.log("[ChoicesCategoryTree] Element value cleared");
        }
        console.log("[ChoicesCategoryTree] ✅ Selection cleared successfully");
      }
      /**
       * Get all selected categories (for multiple mode).
       *
       * @returns {Array} Array of selected category objects
       */
      getSelectedCategories() {
        if (!this.choices || !this.options.multiple) {
          const cat = this.getSelectedCategory();
          return cat ? [cat] : [];
        }
        const selectedItems = this.choices.getValue() || [];
        return selectedItems.map((item) => {
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
        this.choices.removeActiveItems();
        this._updateClearAllVisibility();
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
      async setSelectedCategory(categoryId, maxRetries = 3, retryDelay = 100) {
        if (!this.choices) {
          console.error("[ChoicesCategoryTree] setSelectedCategory failed - no choices instance");
          return;
        }
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const availableChoices = this.choices._store?.choices || [];
          const targetChoice = availableChoices.find((c) => c.value == categoryId || c.value === categoryId.toString());
          if (targetChoice) {
            const valueToSet = targetChoice.value;
            this.choices.setChoiceByValue(valueToSet);
            return;
          }
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
        console.debug(
          "[ChoicesCategoryTree] Category not found in available choices:",
          categoryId,
          "(may be deleted, wrong type, or filtered out)"
        );
      }
    };
    _ChoicesCategoryTree._cache = /* @__PURE__ */ new Map();
    _ChoicesCategoryTree._pendingRequests = /* @__PURE__ */ new Map();
    _ChoicesCategoryTree._workerWrapper = null;
    let ChoicesCategoryTree = _ChoicesCategoryTree;
    window2.BudgetShared = {
      DateFormatter,
      CalendarWidget,
      ChoicesCategoryTree
    };
    window2.DateFormatter = DateFormatter;
    window2.CalendarWidget = CalendarWidget;
    window2.ChoicesCategoryTree = ChoicesCategoryTree;
  })(window);
})();
//# sourceMappingURL=budgetShared.bundle.js.map
