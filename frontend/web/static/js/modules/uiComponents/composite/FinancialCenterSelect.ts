/**
 * FinancialCenterSelect - Financial center (account) selector with API integration
 *
 * Loads financial centers from API and provides a dropdown selector.
 * Reuses SelectDropdown base component.
 *
 * @example
 * ```typescript
 * const fcSelect = new FinancialCenterSelect({
 *   name: 'financial_center_id',
 *   required: true,
 *   onChange: (fcId) => {
 *     // Handle financial center selection
 *     // Update article filter
 *   }
 * });
 *
 * await fcSelect.loadOptions();
 * const element = fcSelect.render();
 * ```
 *
 * @category Composite Components
 */

import { SelectDropdown } from '../core/SelectDropdown';
import type { SelectOption, ValidationResult } from '../types';

export interface FinancialCenterSelectProps {
  name: string;
  value?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (fcId: number | null) => void;
}

interface FinancialCenter {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export class FinancialCenterSelect {
  private select: SelectDropdown;
  private options: SelectOption[] = [];
  private loaded: boolean = false;

  constructor(private props: FinancialCenterSelectProps) {
    // Initialize with placeholder option
    this.options = [
      { value: '', label: props.placeholder || '-- Выберите счет --' }
    ];

    this.select = new SelectDropdown({
      name: props.name,
      value: props.value?.toString(),
      options: this.options,
      required: props.required,
      disabled: props.disabled,
      className: props.className,
      onChange: (value) => {
        const fcId = value ? parseInt(value as string) : null;
        this.props.onChange?.(fcId);
      }
    });
  }

  /**
   * Load financial centers from API
   */
  async loadOptions(): Promise<void> {
    try {
      const response = await fetch('/api/v1/financial-centers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load financial centers: ${response.statusText}`);
      }

      const data = await response.json();
      const centers: FinancialCenter[] = data.data || data;

      // Convert to SelectOption format
      this.options = [
        { value: '', label: this.props.placeholder || '-- Выберите счет --' },
        ...centers
          .filter(fc => fc.is_active)
          .map(fc => ({
            value: fc.id,
            label: fc.name
          }))
      ];

      // Update select options
      this.select.updateOptions(this.options);
      this.loaded = true;

      // Restore value if was set before loading
      if (this.props.value !== undefined) {
        this.setValue(this.props.value);
      }
    } catch (error) {
      console.error('[FinancialCenterSelect] Failed to load options:', error);
      throw error;
    }
  }

  /**
   * Render the select element
   */
  render(): HTMLSelectElement {
    return this.select.render();
  }

  /**
   * Validate the select
   */
  validate(): ValidationResult {
    return this.select.validate();
  }

  /**
   * Get current value
   */
  getValue(): number | null {
    const value = this.select.getValue() as string;
    return value ? parseInt(value) : null;
  }

  /**
   * Set value programmatically
   */
  setValue(fcId: number | null): void {
    this.select.setValue(fcId?.toString() || '');
  }

  /**
   * Focus the select
   */
  focus(): void {
    this.select.focus();
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLSelectElement | null {
    return this.select.getElement();
  }

  /**
   * Check if options are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.select.destroy();
  }
}
