/**
 * TransactionForm - Complete transaction form component
 *
 * Integrates all necessary components for creating/editing budget transactions (facts).
 * Handles dynamic filtering of articles based on record type and financial center.
 *
 * @example
 * ```typescript
 * const form = new TransactionForm({
 *   container: '#transaction-form-container',
 *   mode: 'create',
 *   onSubmit: async (data) => {
 *     const response = await fetch('/api/v1/facts', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   },
 *   onSuccess: () => {
 *     // Handle success (e.g., close modal, reload data)
 *     modal.close();
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
export class TransactionForm {
    constructor(props) {
        this.props = props;
        this.container = null;
        this.form = null;
        this.recordTypeButtons = new Map();
        // UI elements
        this.factHintsContainer = null;
        this.submitButton = null;
        this.isSubmitting = false;
        // Initialize components
        this.dateInput = new DateInput({
            name: 'fact_date',
            value: props.initialData?.fact_date,
            required: true,
            quickButtons: [
                { label: 'Сегодня', offset: 0 },
                { label: 'Вчера', offset: -1 },
                { label: 'Позавчера', offset: -2 }
            ],
            onChange: () => this.handleDateChange()
        });
        this.financialCenterSelect = new FinancialCenterSelect({
            name: 'financial_center_id',
            value: props.initialData?.financial_center_id,
            required: true,
            onChange: (fcId) => this.handleFinancialCenterChange(fcId)
        });
        this.articleSelect = new ArticleSelect({
            name: 'article_id',
            articleType: props.initialData?.record_type || 'expense',
            financialCenterId: props.initialData?.financial_center_id,
            value: props.initialData?.article_id,
            required: true,
            onChange: (article) => this.handleArticleChange(article)
        });
        this.costCenterSelect = new CostCenterSelect({
            name: 'cost_center_id',
            value: props.initialData?.cost_center_id || undefined,
            required: false
        });
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
            placeholder: 'Комментарий',
            rows: 1
        });
    }
    /**
     * Initialize the form (load data, render)
     */
    async initialize() {
        // Render form first (creates DOM elements)
        this.render();
        // Load options for selects
        await Promise.all([
            this.financialCenterSelect.loadOptions(),
            this.costCenterSelect.loadOptions()
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
        // Date field
        const dateField = new FormField({
            label: 'Дата',
            name: 'fact_date',
            required: true,
            children: this.dateInput.render()
        });
        this.form.appendChild(dateField.render());
        // Financial center field
        const fcField = new FormField({
            label: 'Счет',
            name: 'financial_center_id',
            required: true,
            helpText: 'Первым для фильтрации категорий',
            children: this.financialCenterSelect.render()
        });
        this.form.appendChild(fcField.render());
        // Record type field
        this.form.appendChild(this.createRecordTypeField());
        // Article field
        const articleField = new FormField({
            label: 'Категория',
            name: 'article_id',
            required: true,
            children: this.articleSelect.render()
        });
        this.form.appendChild(articleField.render());
        // Cost center field
        const ccField = new FormField({
            label: 'Место затрат',
            name: 'cost_center_id',
            required: false,
            children: this.costCenterSelect.render()
        });
        this.form.appendChild(ccField.render());
        // Fact hints
        this.factHintsContainer = this.createFactHintsContainer();
        this.form.appendChild(this.factHintsContainer);
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
        this.submitButton.textContent = this.props.mode === 'create' ? '✅ Сохранить' : '💾 Обновить';
        actions.appendChild(this.submitButton);
        this.form.appendChild(actions);
        // Add to container
        this.container.appendChild(this.form);
    }
    /**
     * Create record type radio buttons
     */
    createRecordTypeField() {
        const field = document.createElement('div');
        field.className = 'form-control';
        const label = document.createElement('label');
        label.className = 'label py-1';
        label.innerHTML = '<span class="label-text font-semibold">Тип операции *</span>';
        field.appendChild(label);
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';
        // Expense button
        const expenseLabel = document.createElement('label');
        expenseLabel.className = `btn btn-sm btn-outline btn-error transaction-type-btn ${this.props.initialData?.record_type === 'expense' || !this.props.initialData ? 'btn-active' : ''}`;
        expenseLabel.setAttribute('data-type', 'expense');
        const expenseInput = document.createElement('input');
        expenseInput.type = 'radio';
        expenseInput.name = 'record_type';
        expenseInput.value = 'expense';
        expenseInput.className = 'hidden';
        expenseInput.checked = this.props.initialData?.record_type === 'expense' || !this.props.initialData;
        expenseInput.addEventListener('change', () => this.handleRecordTypeChange('expense'));
        expenseLabel.appendChild(expenseInput);
        expenseLabel.appendChild(document.createTextNode('Расход'));
        this.recordTypeButtons.set('expense', expenseLabel);
        grid.appendChild(expenseLabel);
        // Income button
        const incomeLabel = document.createElement('label');
        incomeLabel.className = `btn btn-sm btn-outline btn-success transaction-type-btn ${this.props.initialData?.record_type === 'income' ? 'btn-active' : ''}`;
        incomeLabel.setAttribute('data-type', 'income');
        const incomeInput = document.createElement('input');
        incomeInput.type = 'radio';
        incomeInput.name = 'record_type';
        incomeInput.value = 'income';
        incomeInput.className = 'hidden';
        incomeInput.checked = this.props.initialData?.record_type === 'income';
        incomeInput.addEventListener('change', () => this.handleRecordTypeChange('income'));
        incomeLabel.appendChild(incomeInput);
        incomeLabel.appendChild(document.createTextNode('Доход'));
        this.recordTypeButtons.set('income', incomeLabel);
        grid.appendChild(incomeLabel);
        field.appendChild(grid);
        return field;
    }
    /**
     * Create fact hints container
     */
    createFactHintsContainer() {
        const container = document.createElement('div');
        container.id = 'fact-hints-container';
        container.className = 'grid grid-cols-2 gap-1';
        const planHint = document.createElement('button');
        planHint.type = 'button';
        planHint.className = 'btn btn-xs btn-ghost btn-disabled';
        planHint.id = 'hint-period-plan';
        planHint.disabled = true;
        planHint.textContent = 'План мес: --';
        container.appendChild(planHint);
        const factHint = document.createElement('button');
        factHint.type = 'button';
        factHint.className = 'btn btn-xs btn-ghost btn-disabled';
        factHint.id = 'hint-period-fact';
        factHint.disabled = true;
        factHint.textContent = 'Факт мес: --';
        container.appendChild(factHint);
        return container;
    }
    /**
     * Handle date change
     */
    handleDateChange() {
        this.updateFactHints();
    }
    /**
     * Handle financial center change
     */
    handleFinancialCenterChange(fcId) {
        // Update article filter
        this.articleSelect.updateFinancialCenter(fcId);
        this.updateFactHints();
    }
    /**
     * Handle record type change
     */
    handleRecordTypeChange(type) {
        // Update button states
        this.recordTypeButtons.forEach((button, buttonType) => {
            if (buttonType === type) {
                button.classList.add('btn-active');
            }
            else {
                button.classList.remove('btn-active');
            }
        });
        // Update article filter
        this.articleSelect.updateType(type);
        this.updateFactHints();
    }
    /**
     * Handle article change
     */
    handleArticleChange(_article) {
        this.updateFactHints();
    }
    /**
     * Update fact hints (plan/fact for period)
     */
    async updateFactHints() {
        const date = this.dateInput.getValue();
        const fcId = this.financialCenterSelect.getValue();
        const articleId = this.articleSelect.getValue();
        if (!date || !fcId || !articleId) {
            this.clearFactHints();
            return;
        }
        try {
            // Fetch fact hints from API
            const response = await fetch(`/api/v1/analytics/fact-hints?date=${date}&financial_center_id=${fcId}&article_id=${articleId}`);
            if (!response.ok) {
                this.clearFactHints();
                return;
            }
            const hints = await response.json();
            this.displayFactHints(hints);
        }
        catch (error) {
            console.error('[TransactionForm] Failed to fetch fact hints:', error);
            this.clearFactHints();
        }
    }
    /**
     * Display fact hints
     */
    displayFactHints(hints) {
        if (!this.factHintsContainer)
            return;
        const planButton = this.factHintsContainer.querySelector('#hint-period-plan');
        const factButton = this.factHintsContainer.querySelector('#hint-period-fact');
        if (planButton) {
            planButton.textContent = `План мес: ${hints.period_plan !== null ? hints.period_plan : '--'}`;
        }
        if (factButton) {
            factButton.textContent = `Факт мес: ${hints.period_fact !== null ? hints.period_fact : '--'}`;
        }
    }
    /**
     * Clear fact hints
     */
    clearFactHints() {
        if (!this.factHintsContainer)
            return;
        const planButton = this.factHintsContainer.querySelector('#hint-period-plan');
        const factButton = this.factHintsContainer.querySelector('#hint-period-fact');
        if (planButton) {
            planButton.textContent = 'План мес: --';
        }
        if (factButton) {
            factButton.textContent = 'Факт мес: --';
        }
    }
    /**
     * Validate the entire form
     */
    validate() {
        const validations = [
            this.dateInput.validate(),
            this.financialCenterSelect.validate(),
            this.articleSelect.validate(),
            this.amountInput.validate(),
            this.descriptionInput.validate()
        ];
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
        const recordTypeInput = this.form?.querySelector('input[name="record_type"]:checked');
        return {
            id: this.props.initialData?.id,
            fact_date: this.dateInput.getValue(),
            financial_center_id: this.financialCenterSelect.getValue(),
            record_type: (recordTypeInput?.value || 'expense'),
            article_id: this.articleSelect.getValue(),
            cost_center_id: this.costCenterSelect.getValue(),
            amount: this.amountInput.getValue(),
            description: this.descriptionInput.getValue() || undefined
        };
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
            this.submitButton.textContent = '⏳ Сохранение...';
        }
        try {
            const data = this.collectFormData();
            await this.props.onSubmit(data);
            if (this.props.onSuccess) {
                this.props.onSuccess();
            }
        }
        catch (error) {
            console.error('[TransactionForm] Submit error:', error);
            if (this.props.onError) {
                this.props.onError(error);
            }
            else {
                alert('Ошибка при сохранении транзакции');
            }
        }
        finally {
            this.isSubmitting = false;
            if (this.submitButton) {
                this.submitButton.disabled = false;
                this.submitButton.textContent = this.props.mode === 'create' ? '✅ Сохранить' : '💾 Обновить';
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
        this.dateInput.destroy();
        this.financialCenterSelect.destroy();
        this.articleSelect.destroy();
        this.costCenterSelect.destroy();
        this.amountInput.destroy();
        this.descriptionInput.destroy();
        if (this.form) {
            this.form.remove();
            this.form = null;
        }
        this.recordTypeButtons.clear();
        this.factHintsContainer = null;
        this.submitButton = null;
    }
}
//# sourceMappingURL=TransactionForm.js.map