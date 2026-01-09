/**
 * DateInput - Calendar widget integration component
 *
 * Wraps the existing CalendarWidget (969 lines, ZERO refactoring).
 * Adds quick date buttons and consistent styling.
 *
 * @example
 * ```typescript
 * const dateInput = new DateInput({
 *   name: 'fact_date',
 *   mode: 'single',
 *   quickButtons: [
 *     { label: 'Сегодня', offset: 0 },
 *     { label: 'Вчера', offset: -1 },
 *     { label: 'Позавчера', offset: -2 }
 *   ],
 *   onChange: (date) => {
 *     // Handle date change
 *   }
 * });
 *
 * const element = dateInput.render();
 * ```
 *
 * @category Base Components
 */

import type { DateInputProps, ValidationResult } from '../types';

// Declare global BudgetShared (loaded from budgetShared.bundle.js)
declare const BudgetShared: {
  CalendarWidget: any;
  DateFormatter: any;
};

export class DateInput {
  private container: HTMLDivElement | null = null;
  private input: HTMLInputElement | null = null;
  private calendar: any = null; // CalendarWidget instance
  private quickButtonsContainer: HTMLDivElement | null = null;

  constructor(private props: DateInputProps) {}

  /**
   * Render the date input component
   */
  render(): HTMLDivElement {
    if (this.container) {
      return this.container;
    }

    this.container = document.createElement('div');
    this.container.className = 'date-input-wrapper';

    // Create quick buttons if provided
    if (this.props.quickButtons && this.props.quickButtons.length > 0) {
      this.quickButtonsContainer = this.createQuickButtons();
      this.container.appendChild(this.quickButtonsContainer);
    }

    // Create text input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.name = this.props.name;
    this.input.className = `input input-bordered w-full ${this.props.className || ''}`.trim();
    this.input.placeholder = 'ДД.ММ.ГГГГ';
    this.input.maxLength = 10;
    this.input.autocomplete = 'off';

    if (this.props.value) {
      this.input.value = String(this.props.value);
    }
    if (this.props.required) {
      this.input.required = true;
    }
    if (this.props.disabled) {
      this.input.disabled = true;
    }
    if (this.props.readonly) {
      this.input.readOnly = true;
    }

    this.container.appendChild(this.input);

    // Initialize CalendarWidget (ZERO refactoring)
    this.initCalendar();

    return this.container;
  }

  /**
   * Create quick date buttons
   */
  private createQuickButtons(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'flex gap-1 mb-1';

    this.props.quickButtons?.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-xs btn-outline flex-1';
      button.textContent = btn.label;

      button.addEventListener('click', () => {
        this.setDateWithOffset(btn.offset);
      });

      container.appendChild(button);
    });

    return container;
  }

  /**
   * Initialize CalendarWidget (existing widget, ZERO refactoring)
   */
  private initCalendar(): void {
    if (!this.input) return;

    if (typeof BudgetShared === 'undefined' || !BudgetShared.CalendarWidget) {
      console.error('[DateInput] BudgetShared.CalendarWidget not loaded. Include budgetShared.bundle.js first.');
      return;
    }

    // Reuse existing CalendarWidget (969 lines, ZERO modifications)
    this.calendar = new BudgetShared.CalendarWidget({
      inputElement: this.input,
      mode: this.props.mode || 'single',
      onDateSelect: (date: string | [string, string]) => {
        this.props.onChange?.(date);
      }
    });
  }

  /**
   * Set date with offset from today
   */
  private setDateWithOffset(offsetDays: number): void {
    if (!this.input || typeof BudgetShared === 'undefined') return;

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + offsetDays);

    // Format as DD.MM.YYYY
    const formatted = BudgetShared.DateFormatter.formatForDisplay(
      targetDate.toISOString().split('T')[0]
    );

    this.input.value = formatted;

    // Trigger onChange
    if (this.props.mode === 'single') {
      this.props.onChange?.(formatted);
    }
  }

  /**
   * Validate the date input
   */
  validate(): ValidationResult {
    if (!this.input) {
      return { valid: false, error: 'Input not rendered' };
    }

    const value = this.input.value.trim();

    // Required validation
    if (this.props.required && !value) {
      return { valid: false, error: 'Дата обязательна' };
    }

    // If empty and not required, it's valid
    if (!value && !this.props.required) {
      return { valid: true };
    }

    // Date format validation
    if (typeof BudgetShared !== 'undefined' && BudgetShared.DateFormatter) {
      const isValid = BudgetShared.DateFormatter.isValidDisplayFormat(value);
      if (!isValid) {
        return { valid: false, error: 'Неверный формат даты (ДД.ММ.ГГГГ)' };
      }
    }

    return { valid: true };
  }

  /**
   * Get current value
   */
  getValue(): string | [string, string] {
    if (this.props.mode === 'range') {
      // For range mode, would need to get both dates
      // Implementation depends on CalendarWidget API
      return this.input?.value || '';
    }
    return this.input?.value || '';
  }

  /**
   * Set value programmatically
   */
  setValue(value: string | [string, string]): void {
    if (!this.input) return;

    if (typeof value === 'string') {
      this.input.value = value;
      this.props.onChange?.(value);
    }
  }

  /**
   * Focus the input
   */
  focus(): void {
    this.input?.focus();
  }

  /**
   * Get the rendered container
   */
  getElement(): HTMLDivElement | null {
    return this.container;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.calendar && typeof this.calendar.destroy === 'function') {
      this.calendar.destroy();
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.input = null;
      this.calendar = null;
      this.quickButtonsContainer = null;
    }
  }
}
