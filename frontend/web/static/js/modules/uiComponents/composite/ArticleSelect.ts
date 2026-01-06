/**
 * ArticleSelect - Category selector with type filtering
 *
 * Wraps HierarchySelect<Article> and provides convenience methods
 * for updating article type (expense/income) and financial center filter.
 *
 * Delegates to ChoicesCategoryTree (1337 lines, ZERO refactoring).
 *
 * @example
 * ```typescript
 * const articleSelect = new ArticleSelect({
 *   name: 'article_id',
 *   articleType: 'expense',
 *   financialCenterId: 1,
 *   required: true,
 *   onChange: (article) => {
 *     // Handle article selection
 *   }
 * });
 *
 * const element = articleSelect.render();
 *
 * // Update filters dynamically
 * articleSelect.updateType('income');
 * articleSelect.updateFinancialCenter(2);
 * ```
 *
 * @category Composite Components
 */

import { HierarchySelect } from '../core/HierarchySelect';
import type { Article, ValidationResult } from '../types';

export interface ArticleSelectProps {
  name: string;
  articleType: 'expense' | 'income';
  financialCenterId?: number | null;
  value?: number;
  required?: boolean;
  multiple?: boolean;
  onChange?: (article: Article | Article[]) => void;
}

export class ArticleSelect {
  private hierarchySelect: HierarchySelect<Article>;

  constructor(private props: ArticleSelectProps) {
    // Delegate to HierarchySelect
    this.hierarchySelect = new HierarchySelect<Article>({
      name: props.name,
      type: 'category',
      articleType: props.articleType,
      financialCenterId: props.financialCenterId,
      value: props.value,
      multiple: props.multiple,
      onChange: props.onChange
    });
  }

  /**
   * Render the select element
   */
  render(): HTMLSelectElement {
    return this.hierarchySelect.render();
  }

  /**
   * Update article type (expense/income)
   * Triggers re-filtering of categories in ChoicesCategoryTree
   */
  updateType(type: 'expense' | 'income'): void {
    this.hierarchySelect.updateType(type);
    this.props.articleType = type;
  }

  /**
   * Update financial center filter
   * Triggers re-filtering of categories based on whitelist
   */
  updateFinancialCenter(fcId: number | null): void {
    this.hierarchySelect.updateFinancialCenter(fcId);
    this.props.financialCenterId = fcId;
  }

  /**
   * Validate the select
   */
  validate(): ValidationResult {
    return this.hierarchySelect.validate();
  }

  /**
   * Get current value
   */
  getValue(): number | number[] | null {
    return this.hierarchySelect.getValue();
  }

  /**
   * Set value programmatically
   */
  setValue(value: number | number[]): void {
    this.hierarchySelect.setValue(value);
  }

  /**
   * Focus the select
   */
  focus(): void {
    this.hierarchySelect.focus();
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLSelectElement | null {
    return this.hierarchySelect.getElement();
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.hierarchySelect.destroy();
  }
}
