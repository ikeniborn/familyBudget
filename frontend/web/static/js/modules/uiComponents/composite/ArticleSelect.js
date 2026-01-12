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
export class ArticleSelect {
    constructor(props) {
        this.props = props;
        // Delegate to HierarchySelect
        this.hierarchySelect = new HierarchySelect({
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
    render() {
        return this.hierarchySelect.render();
    }
    /**
     * Update article type (expense/income)
     * Triggers re-filtering of categories in ChoicesCategoryTree
     */
    updateType(type) {
        this.hierarchySelect.updateType(type);
        this.props.articleType = type;
    }
    /**
     * Update financial center filter
     * Triggers re-filtering of categories based on whitelist
     */
    updateFinancialCenter(fcId) {
        this.hierarchySelect.updateFinancialCenter(fcId);
        this.props.financialCenterId = fcId;
    }
    /**
     * Validate the select
     */
    validate() {
        return this.hierarchySelect.validate();
    }
    /**
     * Get current value
     */
    getValue() {
        return this.hierarchySelect.getValue();
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
        this.hierarchySelect.setValue(value);
    }
    /**
     * Focus the select
     */
    focus() {
        this.hierarchySelect.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
        return this.hierarchySelect.getElement();
    }
    /**
     * Destroy the component
     */
    destroy() {
        this.hierarchySelect.destroy();
    }
}
//# sourceMappingURL=ArticleSelect.js.map