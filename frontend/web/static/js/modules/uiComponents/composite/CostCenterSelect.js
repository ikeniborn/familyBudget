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
export class CostCenterSelect {
    constructor(props) {
        this.props = props;
        this.options = [];
        this.loaded = false;
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
                const ccId = value ? parseInt(value) : null;
                this.props.onChange?.(ccId);
            }
        });
    }
    /**
     * Load cost centers from API
     */
    async loadOptions() {
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
            const centers = data.data || data;
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
        }
        catch (error) {
            console.error('[CostCenterSelect] Failed to load options:', error);
            throw error;
        }
    }
    /**
     * Render the select element
     */
    render() {
        return this.select.render();
    }
    /**
     * Validate the select
     */
    validate() {
        return this.select.validate();
    }
    /**
     * Get current value
     */
    getValue() {
        const value = this.select.getValue();
        return value ? parseInt(value) : null;
    }
    /**
     * Set value programmatically
     */
    setValue(ccId) {
        this.select.setValue(ccId?.toString() || '');
    }
    /**
     * Focus the select
     */
    focus() {
        this.select.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
        return this.select.getElement();
    }
    /**
     * Check if options are loaded
     */
    isLoaded() {
        return this.loaded;
    }
    /**
     * Destroy the component
     */
    destroy() {
        this.select.destroy();
    }
}
//# sourceMappingURL=CostCenterSelect.js.map