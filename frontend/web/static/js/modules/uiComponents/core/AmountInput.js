/**
 * AmountInput - Validated number input for amounts
 *
 * Number input with min/max validation and optional currency formatting.
 * Used for transaction amounts, plan amounts, etc.
 *
 * @example
 * ```typescript
 * const input = new AmountInput({
 *   name: 'amount',
 *   min: 1,
 *   step: 1,
 *   placeholder: '0',
 *   required: true,
 *   onChange: (value) => {
 *     // Handle amount change
 *   }
 * });
 *
 * const element = input.render();
 * ```
 *
 * @category Base Components
 */
export class AmountInput {
    constructor(props) {
        this.props = props;
        this.element = null;
    }
    /**
     * Render the input element
     */
    render() {
        if (this.element) {
            return this.element;
        }
        this.element = document.createElement('input');
        this.element.type = 'number';
        this.element.name = this.props.name;
        this.element.className = `input input-bordered w-full ${this.props.className || ''}`.trim();
        // Set attributes
        if (this.props.value !== undefined) {
            this.element.value = String(this.props.value);
        }
        if (this.props.placeholder) {
            this.element.placeholder = this.props.placeholder;
        }
        if (this.props.min !== undefined) {
            this.element.min = String(this.props.min);
        }
        if (this.props.max !== undefined) {
            this.element.max = String(this.props.max);
        }
        if (this.props.step !== undefined) {
            this.element.step = String(this.props.step);
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
        // Attach event listeners
        if (this.props.onChange) {
            this.element.addEventListener('input', (e) => {
                const target = e.target;
                const value = parseFloat(target.value);
                if (!isNaN(value)) {
                    this.props.onChange?.(value);
                }
            });
        }
        if (this.props.onBlur) {
            this.element.addEventListener('blur', (e) => {
                const target = e.target;
                const value = parseFloat(target.value);
                if (!isNaN(value)) {
                    this.props.onBlur?.(value);
                }
            });
        }
        return this.element;
    }
    /**
     * Validate the input
     */
    validate() {
        if (!this.element) {
            return { valid: false, error: 'Input not rendered' };
        }
        const value = this.element.value.trim();
        // Required validation
        if (this.props.required && !value) {
            return { valid: false, error: 'Это поле обязательно' };
        }
        // If empty and not required, it's valid
        if (!value && !this.props.required) {
            return { valid: true };
        }
        // Number validation
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return { valid: false, error: 'Введите корректное число' };
        }
        // Min validation
        if (this.props.min !== undefined && numValue < this.props.min) {
            return {
                valid: false,
                error: `Минимальное значение: ${this.props.min}`
            };
        }
        // Max validation
        if (this.props.max !== undefined && numValue > this.props.max) {
            return {
                valid: false,
                error: `Максимальное значение: ${this.props.max}`
            };
        }
        // Step validation
        if (this.props.step !== undefined && this.props.min !== undefined) {
            const diff = numValue - this.props.min;
            const remainder = diff % this.props.step;
            if (Math.abs(remainder) > 0.001) { // Floating point tolerance
                return {
                    valid: false,
                    error: `Значение должно быть кратно ${this.props.step}`
                };
            }
        }
        return { valid: true };
    }
    /**
     * Get current value as number
     */
    getValue() {
        const value = parseFloat(this.element?.value || '0');
        return isNaN(value) ? 0 : value;
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
        if (this.element) {
            this.element.value = String(value);
            this.props.onChange?.(value);
        }
    }
    /**
     * Update max value dynamically
     */
    setMax(max) {
        this.props.max = max;
        if (this.element) {
            this.element.max = String(max);
        }
    }
    /**
     * Focus the input
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
//# sourceMappingURL=AmountInput.js.map