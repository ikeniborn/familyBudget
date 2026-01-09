/**
 * TextInput - Simple text input component
 *
 * Wrapper for native <input> element with DaisyUI styling.
 *
 * @example
 * ```typescript
 * const input = new TextInput({
 *   name: 'email',
 *   type: 'email',
 *   placeholder: 'user@example.com',
 *   required: true,
 *   onChange: (value) => {
 *     // Handle input change
 *   }
 * });
 *
 * const element = input.render();
 * ```
 *
 * @category Base Components
 */

import type { TextInputProps, ValidationResult } from '../types';

export class TextInput {
  private element: HTMLInputElement | null = null;

  constructor(private props: TextInputProps) {}

  /**
   * Render the input element
   */
  render(): HTMLInputElement {
    if (this.element) {
      return this.element;
    }

    this.element = document.createElement('input');
    this.element.type = this.props.type || 'text';
    this.element.name = this.props.name;
    this.element.className = `input input-bordered w-full ${this.props.className || ''}`.trim();

    // Set attributes
    if (this.props.value !== undefined) {
      this.element.value = String(this.props.value);
    }
    if (this.props.placeholder) {
      this.element.placeholder = this.props.placeholder;
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
    if (this.props.pattern) {
      this.element.pattern = this.props.pattern;
    }
    if (this.props.autocomplete) {
      this.element.setAttribute('autocomplete', this.props.autocomplete);
    }

    // Attach event listeners
    if (this.props.onChange) {
      this.element.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.props.onChange?.(target.value);
      });
    }

    return this.element;
  }

  /**
   * Validate the input
   */
  validate(): ValidationResult {
    if (!this.element) {
      return { valid: false, error: 'Input not rendered' };
    }

    const value = this.element.value.trim();

    // Required validation
    if (this.props.required && !value) {
      return { valid: false, error: 'Это поле обязательно' };
    }

    // Pattern validation
    if (this.props.pattern && value) {
      const regex = new RegExp(this.props.pattern);
      if (!regex.test(value)) {
        return { valid: false, error: 'Неверный формат' };
      }
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
   * Focus the input
   */
  focus(): void {
    this.element?.focus();
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLInputElement | null {
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
