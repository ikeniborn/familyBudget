/**
 * ReminderSettings - Reminder configuration UI with datetime picker
 *
 * Handles reminder enabled/disabled state, datetime selection, and optional message.
 * Integrates with DateInput for calendar functionality.
 *
 * @example
 * ```typescript
 * const reminder = new ReminderSettings({
 *   name: 'reminder_settings',
 *   onChange: (data) => {
 *     // Handle reminder settings change
 *   }
 * });
 *
 * const element = reminder.render();
 * document.getElementById('container').appendChild(element);
 *
 * // Get current settings
 * const config = reminder.getValue();
 * // { enabled: true, datetime: '2026-01-15', message: 'Payment due' }
 * ```
 *
 * @category Composite Components
 */
import { DateInput } from '../core/DateInput';
import { TextareaInput } from '../core/TextareaInput';
export class ReminderSettings {
    constructor(props) {
        this.props = props;
        this.container = null;
        this.enabledCheckbox = null;
        this.datetimeContainer = null;
        this.messageContainer = null;
        // Initialize datetime input
        this.datetimeInput = new DateInput({
            name: `${props.name}_datetime`,
            value: props.datetime || '',
            required: false,
            onChange: () => this.handleChange()
        });
        // Initialize message input (textarea for longer text)
        this.messageInput = new TextareaInput({
            name: `${props.name}_message`,
            value: props.message || '',
            placeholder: 'Текст напоминания (опционально)',
            maxLength: 200,
            rows: 2,
            onChange: () => this.handleChange()
        });
    }
    /**
     * Handle enabled checkbox change
     */
    handleEnabledChange() {
        const enabled = this.enabledCheckbox?.checked || false;
        // Show/hide datetime and message inputs
        if (this.datetimeContainer && this.messageContainer) {
            if (enabled) {
                this.datetimeContainer.classList.remove('hidden');
                this.messageContainer.classList.remove('hidden');
            }
            else {
                this.datetimeContainer.classList.add('hidden');
                this.messageContainer.classList.add('hidden');
            }
        }
        this.handleChange();
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
        this.container.className = `reminder-settings ${this.props.className || ''}`.trim();
        // Enabled checkbox section
        const enabledSection = document.createElement('div');
        enabledSection.className = 'form-control mb-4';
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'label cursor-pointer justify-start gap-3';
        this.enabledCheckbox = document.createElement('input');
        this.enabledCheckbox.type = 'checkbox';
        this.enabledCheckbox.name = `${this.props.name}_enabled`;
        this.enabledCheckbox.className = 'checkbox';
        this.enabledCheckbox.checked = this.props.enabled || false;
        this.enabledCheckbox.addEventListener('change', () => this.handleEnabledChange());
        const checkboxText = document.createElement('span');
        checkboxText.className = 'label-text';
        checkboxText.textContent = 'Включить напоминание';
        checkboxLabel.appendChild(this.enabledCheckbox);
        checkboxLabel.appendChild(checkboxText);
        enabledSection.appendChild(checkboxLabel);
        this.container.appendChild(enabledSection);
        // Datetime section
        this.datetimeContainer = document.createElement('div');
        this.datetimeContainer.className = `form-control mb-4 ${this.props.enabled ? '' : 'hidden'}`.trim();
        const datetimeLabel = document.createElement('label');
        datetimeLabel.className = 'label';
        datetimeLabel.innerHTML = '<span class="label-text">Дата и время напоминания</span>';
        const datetimeHelp = document.createElement('div');
        datetimeHelp.className = 'label-text-alt text-base-content/70 text-xs mt-1';
        datetimeHelp.textContent = 'Вы получите уведомление в указанную дату';
        this.datetimeContainer.appendChild(datetimeLabel);
        this.datetimeContainer.appendChild(this.datetimeInput.render());
        this.datetimeContainer.appendChild(datetimeHelp);
        this.container.appendChild(this.datetimeContainer);
        // Message section
        this.messageContainer = document.createElement('div');
        this.messageContainer.className = `form-control ${this.props.enabled ? '' : 'hidden'}`.trim();
        const messageLabel = document.createElement('label');
        messageLabel.className = 'label';
        messageLabel.innerHTML = '<span class="label-text">Текст напоминания (опционально)</span>';
        const messageHelp = document.createElement('div');
        messageHelp.className = 'label-text-alt text-base-content/70 text-xs mt-1';
        messageHelp.textContent = 'Максимум 200 символов';
        this.messageContainer.appendChild(messageLabel);
        this.messageContainer.appendChild(this.messageInput.render());
        this.messageContainer.appendChild(messageHelp);
        this.container.appendChild(this.messageContainer);
        return this.container;
    }
    /**
     * Validate settings
     */
    validate() {
        const enabled = this.enabledCheckbox?.checked || false;
        // If reminder is disabled, no validation needed
        if (!enabled) {
            return { valid: true };
        }
        // If enabled, datetime is required
        const datetimeValidation = this.datetimeInput.validate();
        if (!datetimeValidation.valid) {
            return datetimeValidation;
        }
        const datetime = this.datetimeInput.getValue();
        if (!datetime) {
            return {
                valid: false,
                error: 'Укажите дату напоминания'
            };
        }
        // Message is optional, but validate if provided
        const messageValidation = this.messageInput.validate();
        if (!messageValidation.valid) {
            return messageValidation;
        }
        return { valid: true };
    }
    /**
     * Get current settings
     */
    getValue() {
        const enabled = this.enabledCheckbox?.checked || false;
        if (!enabled) {
            return {
                enabled: false,
                datetime: null,
                message: null
            };
        }
        const datetimeValue = this.datetimeInput.getValue();
        return {
            enabled: true,
            datetime: (typeof datetimeValue === 'string' ? datetimeValue : null) || null,
            message: this.messageInput.getValue() || null
        };
    }
    /**
     * Set settings programmatically
     */
    setValue(data) {
        if (data.enabled !== undefined && this.enabledCheckbox) {
            this.enabledCheckbox.checked = data.enabled;
            this.handleEnabledChange();
        }
        if (data.datetime !== undefined) {
            this.datetimeInput.setValue(data.datetime || '');
        }
        if (data.message !== undefined) {
            this.messageInput.setValue(data.message || '');
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
        this.datetimeInput.destroy();
        this.messageInput.destroy();
        if (this.container) {
            this.container.remove();
            this.container = null;
            this.enabledCheckbox = null;
            this.datetimeContainer = null;
            this.messageContainer = null;
        }
    }
}
//# sourceMappingURL=ReminderSettings.js.map