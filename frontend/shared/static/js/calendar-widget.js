/**
 * CalendarWidget - DaisyUI Native Date Picker Component
 *
 * Features:
 * - Single date picker mode (for add/edit forms)
 * - Range picker mode (for date filters)
 * - Integration with DateFormatter.js (DD.MM.YYYY format)
 * - Russian localization (month/day names)
 * - Keyboard navigation (ESC, Enter, Arrow keys)
 * - Touch-friendly for mobile (Telegram WebApp)
 * - DaisyUI styling (Tailwind CSS)
 * - Click outside to close
 *
 * Usage:
 * ```javascript
 * // Single date picker
 * const calendar = new CalendarWidget({
 *   inputElement: document.getElementById('date-input'),
 *   mode: 'single',
 *   onSelect: (date) => console.log(date) // DD.MM.YYYY format
 * });
 *
 * // Range picker
 * const rangePicker = new CalendarWidget({
 *   startInputElement: document.getElementById('date-from'),
 *   endInputElement: document.getElementById('date-to'),
 *   mode: 'range',
 *   onSelect: (startDate, endDate) => console.log(startDate, endDate)
 * });
 * ```
 */

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
      this._createSingleButton(this.startInputElement);
      this._createSingleButton(this.endInputElement);
    }
  }

  /**
   * Create a single calendar button for an input element
   * @private
   */
  _createSingleButton(targetInput) {
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
      this.open();
    });
  }

  /**
   * Create calendar dropdown element
   * @private
   */
  _createCalendarElement() {
    this.calendarElement = document.createElement('div');
    this.calendarElement.className = 'calendar-widget fixed z-50 shadow-lg rounded-lg bg-base-100 border border-base-300 hidden';
    this.calendarElement.style.width = '320px';

    // Append to body for fixed positioning (avoid overflow: hidden in modals)
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
            <select class="select select-sm select-bordered" data-action="select-month" aria-label="Выбрать месяц">
              ${CalendarWidget.MONTH_NAMES.map((name, i) =>
                `<option value="${i}" ${i === this.currentMonth ? 'selected' : ''}>${name}</option>`
              ).join('')}
            </select>

            <select class="select select-sm select-bordered" data-action="select-year" aria-label="Выбрать год">
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
    // Note: Trigger button click listeners are now added in _createSingleButton()
    // to support multiple buttons in range mode

    // Calendar actions (event delegation)
    this.calendarElement.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
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
          this.close();
          break;
      }
    });

    // Month/Year dropdowns
    this.calendarElement.addEventListener('change', (e) => {
      const target = e.target;

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

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      // Check if click is inside calendar
      if (this.calendarElement.contains(e.target)) return;

      // Check if click is on any trigger button
      const clickedButton = this.triggerButtons.some(btn => btn.contains(e.target));
      if (clickedButton) return;

      // Click is outside - close calendar
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
   * Handle date selection
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
      if (!this.startDate || (this.startDate && this.endDate)) {
        // Start new range
        this.startDate = date;
        this.endDate = null;
        this.selectingEnd = true;
        const displayDate = DateFormatter.formatForDisplay(this._formatDateISO(date));
        this.startInputElement.value = displayDate;
        this.endInputElement.value = '';
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
        this.startInputElement.value = startDisplay;
        this.endInputElement.value = endDisplay;
        this.selectingEnd = false;
        this.onSelect(startDisplay, endDisplay);
        this.close();
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
   */
  open() {
    this.isOpen = true;
    this._positionCalendar(); // Position BEFORE showing (prevent visual jump)
    this.calendarElement.classList.remove('hidden');
    this._render(); // Re-render to show current selection
  }

  /**
   * Position calendar relative to input element (fixed positioning)
   * @private
   */
  _positionCalendar() {
    const targetInput = this.mode === 'single'
      ? this.inputElement
      : this.startInputElement;

    if (!targetInput) return;

    const inputRect = targetInput.getBoundingClientRect();
    const calendarWidth = 320; // Match width in _createCalendarElement
    const calendarHeight = 400; // Approximate height (will adjust based on content)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8; // Gap between input and calendar

    // Calculate initial position (below input)
    let top = inputRect.bottom + spacing;
    let left = inputRect.left;

    // Adjust horizontal position if calendar goes off-screen (right edge)
    if (left + calendarWidth > viewportWidth) {
      left = viewportWidth - calendarWidth - spacing;
    }

    // Adjust horizontal position if calendar goes off-screen (left edge)
    if (left < spacing) {
      left = spacing;
    }

    // Check if calendar fits below input
    const spaceBelow = viewportHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;

    // If not enough space below but enough space above, show above input
    if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
      top = inputRect.top - calendarHeight - spacing;
    }

    // Mobile: Center calendar if screen is too small
    if (viewportWidth < 400) {
      left = (viewportWidth - calendarWidth) / 2;
      // Ensure minimum spacing from edges
      if (left < spacing) left = spacing;
    }

    // Apply position
    this.calendarElement.style.top = `${top}px`;
    this.calendarElement.style.left = `${left}px`;
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

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CalendarWidget = CalendarWidget;
}
