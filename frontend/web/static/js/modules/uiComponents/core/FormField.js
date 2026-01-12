/**
 * FormField - Universal wrapper for form inputs
 *
 * Provides consistent label, error display, and help text for all form fields.
 * Uses DaisyUI form-control styling.
 *
 * @example
 * ```typescript
 * const input = document.createElement('input');
 * input.className = 'input input-bordered';
 *
 * const field = new FormField({
 *   label: 'Email Address',
 *   name: 'email',
 *   required: true,
 *   helpText: 'We will never share your email',
 *   children: input
 * });
 *
 * container.appendChild(field.render());
 * ```
 *
 * @category Base Components
 */
export class FormField {
    constructor(props) {
        this.props = props;
        this.element = null;
        this.labelElement = null;
        this.errorElement = null;
        this.helpElement = null;
    }
    /**
     * Render the form field wrapper
     */
    render() {
        if (this.element) {
            return this.element;
        }
        // Create form-control container
        this.element = document.createElement('div');
        this.element.className = `form-control ${this.props.className || ''}`.trim();
        // Create label
        this.labelElement = document.createElement('label');
        this.labelElement.className = 'label py-1';
        this.labelElement.htmlFor = this.props.name;
        const labelText = document.createElement('span');
        labelText.className = 'label-text';
        labelText.textContent = this.props.label + (this.props.required ? ' *' : '');
        this.labelElement.appendChild(labelText);
        this.element.appendChild(this.labelElement);
        // Add input element
        this.props.children.id = this.props.name;
        this.element.appendChild(this.props.children);
        // Add help text if provided
        if (this.props.helpText) {
            this.helpElement = document.createElement('span');
            this.helpElement.className = 'label-text-alt text-base-content/70 text-xs mt-1';
            this.helpElement.textContent = this.props.helpText;
            this.element.appendChild(this.helpElement);
        }
        // Add error message if provided
        if (this.props.error) {
            this.showError(this.props.error);
        }
        return this.element;
    }
    /**
     * Show error message
     */
    showError(message) {
        if (!this.element) {
            throw new Error('FormField must be rendered before showing errors');
        }
        // Remove existing error if any
        this.clearError();
        // Create error element
        this.errorElement = document.createElement('span');
        this.errorElement.className = 'label-text-alt text-error text-xs mt-1';
        this.errorElement.textContent = message;
        // Add error-border to input
        this.props.children.classList.add('input-error');
        this.element.appendChild(this.errorElement);
    }
    /**
     * Clear error message
     */
    clearError() {
        if (this.errorElement) {
            this.errorElement.remove();
            this.errorElement = null;
        }
        // Remove error-border from input
        this.props.children.classList.remove('input-error');
    }
    /**
     * Update label text
     */
    updateLabel(label) {
        if (this.labelElement) {
            const labelText = this.labelElement.querySelector('.label-text');
            if (labelText) {
                labelText.textContent = label + (this.props.required ? ' *' : '');
            }
        }
        this.props.label = label;
    }
    /**
     * Update help text
     */
    updateHelpText(helpText) {
        if (helpText) {
            if (!this.helpElement) {
                this.helpElement = document.createElement('span');
                this.helpElement.className = 'label-text-alt text-base-content/70 text-xs mt-1';
                this.element?.appendChild(this.helpElement);
            }
            this.helpElement.textContent = helpText;
        }
        else if (this.helpElement) {
            this.helpElement.remove();
            this.helpElement = null;
        }
        this.props.helpText = helpText || undefined;
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
            this.labelElement = null;
            this.errorElement = null;
            this.helpElement = null;
        }
    }
}
//# sourceMappingURL=FormField.js.map