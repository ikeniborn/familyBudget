/**
 * RecurringPlanSettings - Complex UI for recurring payment configuration
 *
 * Handles frequency type, frequency value, and end date settings for recurring plans.
 * Supports weekly, monthly, and yearly frequencies with MMDD encoding.
 *
 * @example
 * ```typescript
 * const settings = new RecurringPlanSettings({
 *   name: 'recurring_settings',
 *   onChange: (data) => {
 *     // Handle recurring settings change
 *   }
 * });
 *
 * const element = settings.render();
 * document.getElementById('container').appendChild(element);
 *
 * // Get current settings
 * const config = settings.getValue();
 * // { frequencyType: 'monthly', frequencyValue: 15, endDate: null }
 * ```
 *
 * @category Composite Components
 */
import { SelectDropdown } from '../core/SelectDropdown';
import { AmountInput } from '../core/AmountInput';
import { DateInput } from '../core/DateInput';
export class RecurringPlanSettings {
    constructor(props) {
        this.props = props;
        this.container = null;
        this.helpText = null;
        // Initialize frequency type selector
        this.frequencyTypeSelect = new SelectDropdown({
            name: `${props.name}_frequency_type`,
            value: props.frequencyType || 'monthly',
            options: [
                { value: 'weekly', label: 'Еженедельно' },
                { value: 'monthly', label: 'Ежемесячно' },
                { value: 'yearly', label: 'Ежегодно' }
            ],
            onChange: (value) => this.handleFrequencyTypeChange(value)
        });
        // Initialize frequency value input
        this.frequencyValueInput = new AmountInput({
            name: `${props.name}_frequency_value`,
            value: props.frequencyValue || 1,
            min: 1,
            max: this.getMaxFrequencyValue(props.frequencyType || 'monthly'),
            step: 1,
            onChange: () => this.handleChange()
        });
        // Initialize end date input
        this.endDateInput = new DateInput({
            name: `${props.name}_end_date`,
            value: props.endDate || '',
            required: false,
            onChange: () => this.handleChange()
        });
    }
    /**
     * Get maximum frequency value based on frequency type
     */
    getMaxFrequencyValue(type) {
        switch (type) {
            case 'weekly':
                return 7; // Days of week (1-7)
            case 'monthly':
                return 31; // Days of month (1-31)
            case 'yearly':
                return 1231; // MMDD encoding (0101-1231)
            default:
                return 31;
        }
    }
    /**
     * Handle frequency type change
     */
    handleFrequencyTypeChange(type) {
        const maxValue = this.getMaxFrequencyValue(type);
        // Update frequency value input max constraint
        this.frequencyValueInput.setMax(maxValue);
        // Update frequency value if it exceeds new max
        const currentValue = this.frequencyValueInput.getValue();
        if (currentValue > maxValue) {
            this.frequencyValueInput.setValue(1);
        }
        // Update help text
        this.updateHelpText(type);
        this.handleChange();
    }
    /**
     * Update help text based on frequency type
     */
    updateHelpText(type) {
        if (!this.helpText)
            return;
        let text = '';
        switch (type) {
            case 'weekly':
                text = 'Укажите день недели (1 = Понедельник, 7 = Воскресенье)';
                break;
            case 'monthly':
                text = 'Укажите день месяца (1-31)';
                break;
            case 'yearly':
                text = 'Укажите дату в формате ММДД (например, 315 = 15 марта)';
                break;
        }
        this.helpText.textContent = text;
    }
    /**
     * Notify parent of changes
     */
    handleChange() {
        if (this.props.onChange) {
            this.props.onChange(this.getValue());
        }
    }
    /**
     * Render the settings UI
     */
    render() {
        if (this.container) {
            return this.container;
        }
        this.container = document.createElement('div');
        this.container.className = `recurring-plan-settings ${this.props.className || ''}`.trim();
        // Frequency type section
        const typeSection = document.createElement('div');
        typeSection.className = 'form-control mb-4';
        const typeLabel = document.createElement('label');
        typeLabel.className = 'label';
        typeLabel.innerHTML = '<span class="label-text">Периодичность</span>';
        typeSection.appendChild(typeLabel);
        typeSection.appendChild(this.frequencyTypeSelect.render());
        this.container.appendChild(typeSection);
        // Frequency value section
        const valueSection = document.createElement('div');
        valueSection.className = 'form-control mb-4';
        const valueLabel = document.createElement('label');
        valueLabel.className = 'label';
        valueLabel.innerHTML = '<span class="label-text">Значение</span>';
        this.helpText = document.createElement('div');
        this.helpText.className = 'label-text-alt text-base-content/70 text-xs mt-1';
        this.updateHelpText(this.props.frequencyType || 'monthly');
        valueSection.appendChild(valueLabel);
        valueSection.appendChild(this.frequencyValueInput.render());
        valueSection.appendChild(this.helpText);
        this.container.appendChild(valueSection);
        // End date section
        const endDateSection = document.createElement('div');
        endDateSection.className = 'form-control';
        const endDateLabel = document.createElement('label');
        endDateLabel.className = 'label';
        endDateLabel.innerHTML = '<span class="label-text">Дата окончания (опционально)</span>';
        const endDateHelp = document.createElement('div');
        endDateHelp.className = 'label-text-alt text-base-content/70 text-xs mt-1';
        endDateHelp.textContent = 'Оставьте пустым для бессрочного плана';
        endDateSection.appendChild(endDateLabel);
        endDateSection.appendChild(this.endDateInput.render());
        endDateSection.appendChild(endDateHelp);
        this.container.appendChild(endDateSection);
        return this.container;
    }
    /**
     * Validate all settings
     */
    validate() {
        const typeValidation = this.frequencyTypeSelect.validate();
        if (!typeValidation.valid) {
            return typeValidation;
        }
        const valueValidation = this.frequencyValueInput.validate();
        if (!valueValidation.valid) {
            return valueValidation;
        }
        const endDateValidation = this.endDateInput.validate();
        if (!endDateValidation.valid) {
            return endDateValidation;
        }
        // Validate frequency value range based on type
        const type = this.frequencyTypeSelect.getValue();
        const value = this.frequencyValueInput.getValue();
        const maxValue = this.getMaxFrequencyValue(type);
        if (value < 1 || value > maxValue) {
            return {
                valid: false,
                error: `Значение должно быть от 1 до ${maxValue}`
            };
        }
        // For yearly, validate MMDD format
        if (type === 'yearly') {
            const mm = Math.floor(value / 100);
            const dd = value % 100;
            if (mm < 1 || mm > 12) {
                return {
                    valid: false,
                    error: 'Неверный месяц в формате ММДД (месяц должен быть от 01 до 12)'
                };
            }
            if (dd < 1 || dd > 31) {
                return {
                    valid: false,
                    error: 'Неверный день в формате ММДД (день должен быть от 01 до 31)'
                };
            }
        }
        return { valid: true };
    }
    /**
     * Get current settings
     */
    getValue() {
        const endDateValue = this.endDateInput.getValue();
        return {
            frequencyType: this.frequencyTypeSelect.getValue(),
            frequencyValue: this.frequencyValueInput.getValue(),
            endDate: (typeof endDateValue === 'string' ? endDateValue : null) || null
        };
    }
    /**
     * Set settings programmatically
     */
    setValue(data) {
        if (data.frequencyType) {
            this.frequencyTypeSelect.setValue(data.frequencyType);
            this.updateHelpText(data.frequencyType);
        }
        if (data.frequencyValue !== undefined) {
            this.frequencyValueInput.setValue(data.frequencyValue);
        }
        if (data.endDate !== undefined) {
            this.endDateInput.setValue(data.endDate || '');
        }
    }
    /**
     * Get the rendered element
     */
    getElement() {
        return this.container;
    }
    /**
     * Destroy the component
     */
    destroy() {
        this.frequencyTypeSelect.destroy();
        this.frequencyValueInput.destroy();
        this.endDateInput.destroy();
        if (this.container) {
            this.container.remove();
            this.container = null;
            this.helpText = null;
        }
    }
}
//# sourceMappingURL=RecurringPlanSettings.js.map