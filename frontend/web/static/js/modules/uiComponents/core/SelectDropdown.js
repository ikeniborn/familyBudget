/**
 * SelectDropdown - Basic select dropdown component
 *
 * Wrapper for native <select> element with DaisyUI styling.
 * For hierarchical selects, use HierarchySelect instead.
 *
 * @example
 * ```typescript
 * const select = new SelectDropdown({
 *   name: 'status',
 *   options: [
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' }
 *   ],
 *   onChange: (value) => {
 *     // Handle selection change
 *   }
 * });
 *
 * const element = select.render();
 * ```
 *
 * @category Base Components
 */
export class SelectDropdown {
    constructor(props) {
        this.props = props;
        this.element = null;
    }
    /**
     * Render the select element
     */
    render() {
        if (this.element) {
            return this.element;
        }
        this.element = document.createElement('select');
        this.element.name = this.props.name;
        this.element.className = `select select-bordered w-full ${this.props.className || ''}`.trim();
        // Set attributes
        if (this.props.required) {
            this.element.required = true;
        }
        if (this.props.disabled) {
            this.element.disabled = true;
        }
        if (this.props.multiple) {
            this.element.multiple = true;
        }
        if (this.props.size) {
            this.element.size = this.props.size;
        }
        // Add options
        this.updateOptions(this.props.options);
        // Set initial value
        if (this.props.value !== undefined) {
            this.element.value = String(this.props.value);
        }
        // Attach event listener
        if (this.props.onChange) {
            this.element.addEventListener('change', (e) => {
                const target = e.target;
                if (this.props.multiple) {
                    const selectedValues = Array.from(target.selectedOptions).map(opt => opt.value);
                    this.props.onChange?.(selectedValues);
                }
                else {
                    this.props.onChange?.(target.value);
                }
            });
        }
        return this.element;
    }
    /**
     * Update options dynamically
     */
    updateOptions(options) {
        if (!this.element) {
            throw new Error('SelectDropdown must be rendered before updating options');
        }
        // Clear existing options
        this.element.innerHTML = '';
        // Add new options
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = String(option.value);
            optElement.textContent = option.label;
            if (option.disabled) {
                optElement.disabled = true;
            }
            if (option.selected) {
                optElement.selected = true;
            }
            this.element.appendChild(optElement);
        });
        this.props.options = options;
    }
    /**
     * Validate the select
     */
    validate() {
        if (!this.element) {
            return { valid: false, error: 'Select not rendered' };
        }
        const value = this.element.value;
        // Required validation
        if (this.props.required && !value) {
            return { valid: false, error: 'Выберите значение из списка' };
        }
        return { valid: true };
    }
    /**
     * Get current value(s)
     */
    getValue() {
        if (!this.element) {
            return this.props.multiple ? [] : '';
        }
        if (this.props.multiple) {
            return Array.from(this.element.selectedOptions).map(opt => opt.value);
        }
        else {
            return this.element.value;
        }
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
        if (!this.element)
            return;
        if (Array.isArray(value)) {
            // Multiple select
            Array.from(this.element.options).forEach(opt => {
                opt.selected = value.includes(opt.value);
            });
            this.props.onChange?.(value);
        }
        else {
            // Single select
            this.element.value = value;
            this.props.onChange?.(value);
        }
    }
    /**
     * Focus the select
     */
    focus() {
        this.element?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
        return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
//# sourceMappingURL=SelectDropdown.js.map