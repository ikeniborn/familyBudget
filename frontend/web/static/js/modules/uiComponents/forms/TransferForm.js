/**
 * TransferForm - Transfer between financial centers form
 *
 * Handles transfer creation between two financial centers (accounts).
 * Supports both fact (actual) and plan (budget) transfers.
 *
 * @example
 * ```typescript
 * const form = new TransferForm({
 *   container: '#transfer-form-container',
 *   transferType: 'fact',
 *   onSubmit: async (data) => {
 *     const response = await fetch('/api/v1/transfers', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   }
 * });
 *
 * await form.initialize();
 * ```
 *
 * @category Form Components
 */
import { DateInput } from '../core/DateInput';
import { AmountInput } from '../core/AmountInput';
import { TextareaInput } from '../core/TextareaInput';
import { FormField } from '../core/FormField';
import { FinancialCenterSelect } from '../composite/FinancialCenterSelect';
import { ArticleSelect } from '../composite/ArticleSelect';
import { CostCenterSelect } from '../composite/CostCenterSelect';
export class TransferForm {
    constructor(props) {
        this.props = props;
        this.container = null;
        this.form = null;
        // Components
        this.dateInput = null;
        this.submitButton = null;
        this.isSubmitting = false;
        // Date input (for fact transfers only)
        if (props.transferType === 'fact') {
            this.dateInput = new DateInput({
                name: 'transfer_date',
                value: props.initialData?.transfer_date,
                required: true,
                quickButtons: [
                    { label: 'Сегодня', offset: 0 },
                    { label: 'Вчера', offset: -1 },
                    { label: 'Позавчера', offset: -2 }
                ]
            });
        }
        // FROM section components
        this.fromFcSelect = new FinancialCenterSelect({
            name: 'from_financial_center_id',
            value: props.initialData?.from_financial_center_id,
            required: true,
            onChange: (fcId) => this.fromArticleSelect.updateFinancialCenter(fcId)
        });
        this.fromArticleSelect = new ArticleSelect({
            name: 'from_article_id',
            articleType: 'expense', // debit article
            financialCenterId: props.initialData?.from_financial_center_id,
            value: props.initialData?.from_article_id,
            required: true
        });
        this.fromCcSelect = new CostCenterSelect({
            name: 'from_cost_center_id',
            value: props.initialData?.from_cost_center_id || undefined,
            required: false
        });
        // TO section components
        this.toFcSelect = new FinancialCenterSelect({
            name: 'to_financial_center_id',
            value: props.initialData?.to_financial_center_id,
            required: true,
            onChange: (fcId) => this.toArticleSelect.updateFinancialCenter(fcId)
        });
        this.toArticleSelect = new ArticleSelect({
            name: 'to_article_id',
            articleType: 'income', // credit article
            financialCenterId: props.initialData?.to_financial_center_id,
            value: props.initialData?.to_article_id,
            required: true
        });
        this.toCcSelect = new CostCenterSelect({
            name: 'to_cost_center_id',
            value: props.initialData?.to_cost_center_id || undefined,
            required: false
        });
        // Amount and description
        this.amountInput = new AmountInput({
            name: 'amount',
            value: props.initialData?.amount,
            min: 1,
            step: 1,
            required: true,
            placeholder: '0'
        });
        this.descriptionInput = new TextareaInput({
            name: 'description',
            value: props.initialData?.description,
            placeholder: 'Комментарий к переводу',
            rows: 2
        });
    }
    /**
     * Initialize the form
     */
    async initialize() {
        // Render form first (creates DOM elements)
        this.render();
        // Load options for all selects
        await Promise.all([
            this.fromFcSelect.loadOptions(),
            this.fromCcSelect.loadOptions(),
            this.toFcSelect.loadOptions(),
            this.toCcSelect.loadOptions()
        ]);
    }
    /**
     * Render the complete form
     */
    render() {
        // Get container
        if (typeof this.props.container === 'string') {
            this.container = document.querySelector(this.props.container);
        }
        else {
            this.container = this.props.container;
        }
        if (!this.container) {
            throw new Error(`Container not found: ${this.props.container}`);
        }
        // Create form element
        this.form = document.createElement('form');
        this.form.className = 'space-y-2';
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        // Date field (fact transfers only)
        if (this.props.transferType === 'fact' && this.dateInput) {
            const dateField = new FormField({
                label: 'Дата перевода',
                name: 'transfer_date',
                required: true,
                children: this.dateInput.render()
            });
            this.form.appendChild(dateField.render());
        }
        // FROM section
        const fromSection = document.createElement('div');
        fromSection.className = 'border border-error/20 rounded-lg p-3 bg-error/5 space-y-2';
        const fromHeader = document.createElement('h4');
        fromHeader.className = 'font-semibold text-error text-sm mb-2';
        fromHeader.textContent = '📤 Откуда (списание)';
        fromSection.appendChild(fromHeader);
        // From financial center
        const fromFcField = new FormField({
            label: 'Счет',
            name: 'from_financial_center_id',
            required: true,
            children: this.fromFcSelect.render()
        });
        fromSection.appendChild(fromFcField.render());
        // From article
        const fromArticleField = new FormField({
            label: 'Категория',
            name: 'from_article_id',
            required: true,
            children: this.fromArticleSelect.render()
        });
        fromSection.appendChild(fromArticleField.render());
        // From cost center
        const fromCcField = new FormField({
            label: 'Место затрат',
            name: 'from_cost_center_id',
            required: false,
            children: this.fromCcSelect.render()
        });
        fromSection.appendChild(fromCcField.render());
        this.form.appendChild(fromSection);
        // TO section
        const toSection = document.createElement('div');
        toSection.className = 'border border-success/20 rounded-lg p-3 bg-success/5 space-y-2';
        const toHeader = document.createElement('h4');
        toHeader.className = 'font-semibold text-success text-sm mb-2';
        toHeader.textContent = '📥 Куда (пополнение)';
        toSection.appendChild(toHeader);
        // To financial center
        const toFcField = new FormField({
            label: 'Счет',
            name: 'to_financial_center_id',
            required: true,
            children: this.toFcSelect.render()
        });
        toSection.appendChild(toFcField.render());
        // To article
        const toArticleField = new FormField({
            label: 'Категория',
            name: 'to_article_id',
            required: true,
            children: this.toArticleSelect.render()
        });
        toSection.appendChild(toArticleField.render());
        // To cost center
        const toCcField = new FormField({
            label: 'Место затрат',
            name: 'to_cost_center_id',
            required: false,
            children: this.toCcSelect.render()
        });
        toSection.appendChild(toCcField.render());
        this.form.appendChild(toSection);
        // Amount field
        const amountField = new FormField({
            label: 'Сумма',
            name: 'amount',
            required: true,
            children: this.amountInput.render()
        });
        this.form.appendChild(amountField.render());
        // Description field
        const descField = new FormField({
            label: 'Описание',
            name: 'description',
            required: false,
            children: this.descriptionInput.render()
        });
        this.form.appendChild(descField.render());
        // Submit button
        const actions = document.createElement('div');
        actions.className = 'modal-action mt-3';
        this.submitButton = document.createElement('button');
        this.submitButton.type = 'submit';
        this.submitButton.className = 'btn btn-sm btn-primary';
        this.submitButton.textContent = '✅ Создать перевод';
        actions.appendChild(this.submitButton);
        this.form.appendChild(actions);
        // Add to container
        this.container.appendChild(this.form);
    }
    /**
     * Validate the entire form
     */
    validate() {
        const validations = [
            this.fromFcSelect.validate(),
            this.fromArticleSelect.validate(),
            this.toFcSelect.validate(),
            this.toArticleSelect.validate(),
            this.amountInput.validate()
        ];
        // Add date validation for fact transfers
        if (this.props.transferType === 'fact' && this.dateInput) {
            validations.push(this.dateInput.validate());
        }
        // Validate that FROM and TO financial centers are different
        const fromFc = this.fromFcSelect.getValue();
        const toFc = this.toFcSelect.getValue();
        if (fromFc === toFc) {
            return {
                valid: false,
                error: 'Счета "Откуда" и "Куда" должны быть разными'
            };
        }
        for (const validation of validations) {
            if (!validation.valid) {
                return validation;
            }
        }
        return { valid: true };
    }
    /**
     * Collect form data
     */
    collectFormData() {
        const data = {
            transfer_type: this.props.transferType,
            from_financial_center_id: this.fromFcSelect.getValue(),
            from_article_id: this.fromArticleSelect.getValue(),
            from_cost_center_id: this.fromCcSelect.getValue(),
            to_financial_center_id: this.toFcSelect.getValue(),
            to_article_id: this.toArticleSelect.getValue(),
            to_cost_center_id: this.toCcSelect.getValue(),
            amount: this.amountInput.getValue(),
            description: this.descriptionInput.getValue() || undefined
        };
        if (this.props.transferType === 'fact' && this.dateInput) {
            data.transfer_date = this.dateInput.getValue();
        }
        return data;
    }
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
        event.preventDefault();
        if (this.isSubmitting) {
            return;
        }
        // Validate
        const validation = this.validate();
        if (!validation.valid) {
            alert(validation.error || 'Проверьте правильность заполнения полей');
            return;
        }
        this.isSubmitting = true;
        if (this.submitButton) {
            this.submitButton.disabled = true;
            this.submitButton.textContent = '⏳ Создание...';
        }
        try {
            const data = this.collectFormData();
            await this.props.onSubmit(data);
            if (this.props.onSuccess) {
                this.props.onSuccess();
            }
        }
        catch (error) {
            console.error('[TransferForm] Submit error:', error);
            if (this.props.onError) {
                this.props.onError(error);
            }
            else {
                alert('Ошибка при создании перевода');
            }
        }
        finally {
            this.isSubmitting = false;
            if (this.submitButton) {
                this.submitButton.disabled = false;
                this.submitButton.textContent = '✅ Создать перевод';
            }
        }
    }
    /**
     * Get the rendered form element
     */
    getElement() {
        return this.form;
    }
    /**
     * Destroy the component
     */
    destroy() {
        this.dateInput?.destroy();
        this.fromFcSelect.destroy();
        this.fromArticleSelect.destroy();
        this.fromCcSelect.destroy();
        this.toFcSelect.destroy();
        this.toArticleSelect.destroy();
        this.toCcSelect.destroy();
        this.amountInput.destroy();
        this.descriptionInput.destroy();
        if (this.form) {
            this.form.remove();
            this.form = null;
        }
        this.submitButton = null;
    }
}
//# sourceMappingURL=TransferForm.js.map