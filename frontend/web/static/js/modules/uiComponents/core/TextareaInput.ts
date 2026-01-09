/**
 * TextareaInput - Multi-line text input component
 *
 * Wrapper for native <textarea> element with DaisyUI styling.
 *
 * @example
 * ```typescript
 * const textarea = new TextareaInput({
 *   name: 'description',
 *   rows: 3,
 *   maxLength: 500,
 *   placeholder: 'Введите описание...',
 *   onChange: (value) => {
 *     // Handle textarea change
 *   }
 * });
 *
 * const element = textarea.render();
 * ```
 *
 * @category Base Components
 */

import type { TextareaInputProps, ValidationResult } from '../types';

export class TextareaInput {
  private element: HTMLTextAreaElement | null = null;

  constructor(private props: TextareaInputProps) {}

  /**
   * Render the textarea element
   */
  render(): HTMLTextAreaElement {
    if (this.element) {
      return this.element;
    }

    this.element = document.createElement('textarea');
    this.element.name = this.props.name;
    this.element.className = `textarea textarea-bordered w-full ${this.props.className || ''}`.trim();

    // Set attributes
    if (this.props.value !== undefined) {
      this.element.value = String(this.props.value);
    }
    if (this.props.placeholder) {
      this.element.placeholder = this.props.placeholder;
    }
    if (this.props.rows) {
      this.element.rows = this.props.rows;
    }
    if (this.props.required) {
      this.element.required = true;
    }
    if (this.props.disabled) {
      this.element.disabled = true;
    }
    if (this.props.readonly) {
      this.element.readOnly = true;
    }
    if (this.props.maxLength) {
      this.element.maxLength = this.props.maxLength;
    }

    // Attach event listeners
    if (this.props.onChange) {
      this.element.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        this.props.onChange?.(target.value);
      });
    }

    return this.element;
  }

  /**
   * Validate the textarea
   */
  validate(): ValidationResult {
    if (!this.element) {
      return { valid: false, error: 'Textarea not rendered' };
    }

    const value = this.element.value.trim();

    // Required validation
    if (this.props.required && !value) {
      return { valid: false, error: 'Это поле обязательно' };
    }

    // MaxLength validation (double-check)
    if (this.props.maxLength && value.length > this.props.maxLength) {
      return {
        valid: false,
        error: `Максимальная длина: ${this.props.maxLength} символов`
      };
    }

    return { valid: true };
  }

  /**
   * Get current value
   */
  getValue(): string {
    return this.element?.value || '';
  }

  /**
   * Set value programmatically
   */
  setValue(value: string): void {
    if (this.element) {
      this.element.value = value;
      this.props.onChange?.(value);
    }
  }

  /**
   * Focus the textarea
   */
  focus(): void {
    this.element?.focus();
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLTextAreaElement | null {
    return this.element;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}
