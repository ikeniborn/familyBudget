/**
 * CostCenterSelect - Cost center (project/department) selector with API integration
 *
 * Loads cost centers from API and provides a dropdown selector.
 * Reuses SelectDropdown base component.
 *
 * @example
 * ```typescript
 * const ccSelect = new CostCenterSelect({
 *   name: 'cost_center_id',
 *   required: false,
 *   onChange: (ccId) => {
 *     // Handle cost center selection
 *   }
 * });
 *
 * await ccSelect.loadOptions();
 * const element = ccSelect.render();
 * ```
 *
 * @category Composite Components
 */

import { SelectDropdown } from '../core/SelectDropdown';
import type { SelectOption, ValidationResult } from '../types';

export interface CostCenterSelectProps {
  name: string;
  value?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (ccId: number | null) => void;
}

interface CostCenter {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export class CostCenterSelect {
  private select: SelectDropdown;
  private options: SelectOption[] = [];
  private loaded: boolean = false;

  constructor(private props: CostCenterSelectProps) {
    // Initialize with placeholder option
    this.options = [
      { value: '', label: props.placeholder || '-- Выберите место затрат --' }
    ];

    this.select = new SelectDropdown({
      name: props.name,
      value: props.value?.toString(),
      options: this.options,
      required: props.required,
      disabled: props.disabled,
      className: props.className,
      onChange: (value) => {
        const ccId = value ? parseInt(value as string) : null;
        this.props.onChange?.(ccId);
      }
    });
  }

  /**
   * Load cost centers from API
   */
  async loadOptions(): Promise<void> {
    try {
      const response = await fetch('/api/v1/cost-centers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load cost centers: ${response.statusText}`);
      }

      const data = await response.json();
      const centers: CostCenter[] = data.data || data;

      // Convert to SelectOption format
      this.options = [
        { value: '', label: this.props.placeholder || '-- Выберите место затрат --' },
        ...centers
          .filter(cc => cc.is_active)
          .map(cc => ({
            value: cc.id,
            label: cc.name
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
      console.error('[CostCenterSelect] Failed to load options:', error);
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
  setValue(ccId: number | null): void {
    this.select.setValue(ccId?.toString() || '');
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
