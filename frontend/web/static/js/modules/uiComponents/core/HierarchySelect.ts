/**
 * HierarchySelect<T> - Generic hierarchical selector
 *
 * Wraps existing ChoicesCategoryTree (1337 lines, ZERO refactoring).
 * Generic implementation consolidates category and product group selectors.
 *
 * @example
 * ```typescript
 * // Category selector
 * const categorySelect = new HierarchySelect<Article>({
 *   name: 'article_id',
 *   type: 'category',
 *   articleType: 'expense',
 *   financialCenterId: 1,
 *   onChange: (article) => {
 *     // Handle article selection
 *   }
 * });
 *
 * // Product group selector
 * const groupSelect = new HierarchySelect<ProductGroup>({
 *   name: 'product_group_id',
 *   type: 'productGroup',
 *   onChange: (group) => {
 *     // Handle group selection
 *   }
 * });
 * ```
 *
 * @category Base Components
 */

import type { HierarchySelectProps, Article, ProductGroup, ValidationResult } from '../types';

// Declare global BudgetShared (loaded from budgetShared.bundle.js)
declare const BudgetShared: {
  ChoicesCategoryTree: any;
  ChoicesProductGroupTree?: any;
};

export class HierarchySelect<T extends Article | ProductGroup> {
  private select: HTMLSelectElement | null = null;
  private choicesInstance: any = null; // ChoicesCategoryTree or ChoicesProductGroupTree

  constructor(private props: HierarchySelectProps<T>) {}

  /**
   * Render the select element
   */
  render(): HTMLSelectElement {
    if (this.select) {
      return this.select;
    }

    this.select = document.createElement('select');
    this.select.name = this.props.name;
    this.select.id = this.props.name; // ID for Choices.js selector
    this.select.className = 'select select-bordered w-full';

    if (this.props.multiple) {
      this.select.multiple = true;
    }

    // Initialize hierarchy widget (ZERO refactoring)
    this.initHierarchyWidget();

    return this.select;
  }

  /**
   * Initialize ChoicesCategoryTree or ChoicesProductGroupTree (existing widgets, ZERO refactoring)
   */
  private initHierarchyWidget(): void {
    if (!this.select) return;

    if (typeof BudgetShared === 'undefined' || !BudgetShared.ChoicesCategoryTree) {
      console.error('[HierarchySelect] BudgetShared.ChoicesCategoryTree not loaded. Include budgetShared.bundle.js first.');
      return;
    }

    if (this.props.type === 'category') {
      // Reuse existing ChoicesCategoryTree (1337 lines, ZERO modifications)
      this.choicesInstance = new BudgetShared.ChoicesCategoryTree(`#${this.props.name}`, {
        type: this.props.articleType || 'expense',
        financialCenterId: this.props.financialCenterId || null,
        onChange: (category: any) => {
          this.props.onChange?.(category as T);
        }
      });
    } else if (this.props.type === 'productGroup') {
      // Reuse existing ChoicesProductGroupTree (if available)
      if (BudgetShared.ChoicesProductGroupTree) {
        this.choicesInstance = new BudgetShared.ChoicesProductGroupTree(`#${this.props.name}`, {
          onChange: (group: any) => {
            this.props.onChange?.(group as T);
          }
        });
      } else {
        console.error('[HierarchySelect] ChoicesProductGroupTree not available in BudgetShared');
      }
    }

    // Set initial value if provided
    if (this.props.value !== undefined && this.choicesInstance) {
      setTimeout(() => {
        this.setValue(this.props.value as number);
      }, 100); // Allow Choices.js to initialize
    }
  }

  /**
   * Update article type (for category selector)
   */
  updateType(type: 'expense' | 'income'): void {
    if (this.props.type !== 'category' || !this.choicesInstance) {
      return;
    }

    if (typeof this.choicesInstance.updateType === 'function') {
      this.choicesInstance.updateType(type);
      this.props.articleType = type;
    }
  }

  /**
   * Update financial center filter (for category selector)
   */
  updateFinancialCenter(fcId: number | null): void {
    if (this.props.type !== 'category' || !this.choicesInstance) {
      return;
    }

    if (typeof this.choicesInstance.updateFinancialCenter === 'function') {
      this.choicesInstance.updateFinancialCenter(fcId);
      this.props.financialCenterId = fcId;
    }
  }

  /**
   * Validate the select
   */
  validate(): ValidationResult {
    if (!this.select) {
      return { valid: false, error: 'Select not rendered' };
    }

    const value = this.select.value;

    // For Choices.js, check if a value is selected
    if (!value || value === '' || value === 'null') {
      return { valid: false, error: 'Выберите значение из списка' };
    }

    return { valid: true };
  }

  /**
   * Get current value
   */
  getValue(): number | number[] | null {
    if (!this.select) return null;

    if (this.props.multiple) {
      const values = Array.from(this.select.selectedOptions).map(opt => parseInt(opt.value));
      return values.filter(v => !isNaN(v));
    } else {
      const value = parseInt(this.select.value);
      return isNaN(value) ? null : value;
    }
  }

  /**
   * Set value programmatically
   */
  setValue(value: number | number[]): void {
    if (!this.choicesInstance) return;

    if (Array.isArray(value)) {
      // Multiple selection
      if (typeof this.choicesInstance.setChoiceByValue === 'function') {
        value.forEach(v => {
          this.choicesInstance.setChoiceByValue(String(v));
        });
      }
    } else {
      // Single selection
      if (typeof this.choicesInstance.setChoiceByValue === 'function') {
        this.choicesInstance.setChoiceByValue(String(value));
      }
    }
  }

  /**
   * Focus the select
   */
  focus(): void {
    this.select?.focus();
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLSelectElement | null {
    return this.select;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.choicesInstance && typeof this.choicesInstance.destroy === 'function') {
      this.choicesInstance.destroy();
    }
    if (this.select) {
      this.select.remove();
      this.select = null;
      this.choicesInstance = null;
    }
  }
}
