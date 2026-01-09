/**
 * RecurringPlanForm - Recurring payment plan form
 *
 * Complete form for creating/editing recurring payment plans with reminders.
 * Integrates RecurringPlanSettings and ReminderSettings components.
 *
 * @example
 * ```typescript
 * const form = new RecurringPlanForm({
 *   container: '#plan-form-container',
 *   mode: 'create',
 *   onSubmit: async (data) => {
 *     const response = await fetch('/api/v1/recurring-plans', {
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
import { RecurringPlanSettings } from '../composite/RecurringPlanSettings';
import { ReminderSettings } from '../composite/ReminderSettings';
import type { ValidationResult } from '../types';
import type { RecurringSettings } from '../composite/RecurringPlanSettings';
import type { ReminderConfig } from '../composite/ReminderSettings';

export interface RecurringPlanFormProps {
  container: string | HTMLElement;
  mode: 'create' | 'edit';
  initialData?: RecurringPlanData;
  onSubmit: (data: RecurringPlanData) => Promise<any>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface RecurringPlanData {
  id?: number;
  start_date: string;
  financial_center_id: number;
  record_type: 'expense' | 'income';
  article_id: number;
  cost_center_id?: number | null;
  amount: number;
  description?: string;
  frequency_type: 'weekly' | 'monthly' | 'yearly';
  frequency_value: number;
  end_date?: string | null;
  reminder_enabled: boolean;
  reminder_datetime?: string | null;
  reminder_message?: string | null;
}

export class RecurringPlanForm {
  private container: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;

  // Components
  private startDateInput: DateInput;
  private financialCenterSelect: FinancialCenterSelect;
  private recordTypeButtons: Map<string, HTMLLabelElement> = new Map();
  private articleSelect: ArticleSelect;
  private costCenterSelect: CostCenterSelect;
  private amountInput: AmountInput;
  private descriptionInput: TextareaInput;
  private recurringSettings: RecurringPlanSettings;
  private reminderSettings: ReminderSettings;

  private submitButton: HTMLButtonElement | null = null;
  private isSubmitting: boolean = false;

  constructor(private props: RecurringPlanFormProps) {
    // Start date
    this.startDateInput = new DateInput({
      name: 'start_date',
      value: props.initialData?.start_date,
      required: true,
      quickButtons: [
        { label: 'Сегодня', offset: 0 },
        { label: 'Завтра', offset: 1 },
        { label: 'Послезавтра', offset: 2 }
      ]
    });

    // Financial center
    this.financialCenterSelect = new FinancialCenterSelect({
      name: 'financial_center_id',
      value: props.initialData?.financial_center_id,
      required: true,
      onChange: (fcId) => this.articleSelect.updateFinancialCenter(fcId)
    });

    // Article
    this.articleSelect = new ArticleSelect({
      name: 'article_id',
      articleType: props.initialData?.record_type || 'expense',
      financialCenterId: props.initialData?.financial_center_id,
      value: props.initialData?.article_id,
      required: true
    });

    // Cost center
    this.costCenterSelect = new CostCenterSelect({
      name: 'cost_center_id',
      value: props.initialData?.cost_center_id || undefined,
      required: false
    });

    // Amount
    this.amountInput = new AmountInput({
      name: 'amount',
      value: props.initialData?.amount,
      min: 1,
      step: 1,
      required: true,
      placeholder: '0'
    });

    // Description
    this.descriptionInput = new TextareaInput({
      name: 'description',
      value: props.initialData?.description,
      placeholder: 'Описание платежа',
      rows: 2
    });

    // Recurring settings
    this.recurringSettings = new RecurringPlanSettings({
      name: 'recurring',
      frequencyType: props.initialData?.frequency_type,
      frequencyValue: props.initialData?.frequency_value,
      endDate: props.initialData?.end_date || null
    });

    // Reminder settings
    this.reminderSettings = new ReminderSettings({
      name: 'reminder',
      enabled: props.initialData?.reminder_enabled || false,
      datetime: props.initialData?.reminder_datetime || undefined,
      message: props.initialData?.reminder_message || undefined
    });
  }

  /**
   * Initialize the form
   */
  async initialize(): Promise<void> {
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
  private render(): void {
    // Get container
    if (typeof this.props.container === 'string') {
      this.container = document.querySelector(this.props.container);
    } else {
      this.container = this.props.container;
    }

    if (!this.container) {
      throw new Error(`Container not found: ${this.props.container}`);
    }

    // Create form element
    this.form = document.createElement('form');
    this.form.className = 'space-y-2';
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Start date field
    const startDateField = new FormField({
      label: 'Дата начала',
      name: 'start_date',
      required: true,
      children: this.startDateInput.render()
    });
    this.form.appendChild(startDateField.render());

    // Financial center field
    const fcField = new FormField({
      label: 'Счет',
      name: 'financial_center_id',
      required: true,
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

    // Recurring settings section
    const recurringSection = document.createElement('div');
    recurringSection.className = 'border border-primary/20 rounded-lg p-3 bg-primary/5';

    const recurringHeader = document.createElement('h4');
    recurringHeader.className = 'font-semibold text-primary text-sm mb-3';
    recurringHeader.textContent = '🔄 Настройки повторения';
    recurringSection.appendChild(recurringHeader);

    recurringSection.appendChild(this.recurringSettings.render());
    this.form.appendChild(recurringSection);

    // Reminder settings section
    const reminderSection = document.createElement('div');
    reminderSection.className = 'border border-warning/20 rounded-lg p-3 bg-warning/5';

    const reminderHeader = document.createElement('h4');
    reminderHeader.className = 'font-semibold text-warning text-sm mb-3';
    reminderHeader.textContent = '🔔 Напоминание';
    reminderSection.appendChild(reminderHeader);

    reminderSection.appendChild(this.reminderSettings.render());
    this.form.appendChild(reminderSection);

    // Submit button
    const actions = document.createElement('div');
    actions.className = 'modal-action mt-3';

    this.submitButton = document.createElement('button');
    this.submitButton.type = 'submit';
    this.submitButton.className = 'btn btn-sm btn-primary';
    this.submitButton.textContent = this.props.mode === 'create' ? '✅ Создать план' : '💾 Обновить план';

    actions.appendChild(this.submitButton);
    this.form.appendChild(actions);

    // Add to container
    this.container.appendChild(this.form);
  }

  /**
   * Create record type radio buttons
   */
  private createRecordTypeField(): HTMLDivElement {
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
    expenseLabel.className = `btn btn-sm btn-outline btn-error ${
      this.props.initialData?.record_type === 'expense' || !this.props.initialData ? 'btn-active' : ''
    }`;

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
    incomeLabel.className = `btn btn-sm btn-outline btn-success ${
      this.props.initialData?.record_type === 'income' ? 'btn-active' : ''
    }`;

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
   * Handle record type change
   */
  private handleRecordTypeChange(type: 'expense' | 'income'): void {
    // Update button states
    this.recordTypeButtons.forEach((button, buttonType) => {
      if (buttonType === type) {
        button.classList.add('btn-active');
      } else {
        button.classList.remove('btn-active');
      }
    });

    // Update article filter
    this.articleSelect.updateType(type);
  }

  /**
   * Validate the entire form
   */
  validate(): ValidationResult {
    const validations = [
      this.startDateInput.validate(),
      this.financialCenterSelect.validate(),
      this.articleSelect.validate(),
      this.amountInput.validate(),
      this.descriptionInput.validate(),
      this.recurringSettings.validate(),
      this.reminderSettings.validate()
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
  private collectFormData(): RecurringPlanData {
    const recordTypeInput = this.form?.querySelector('input[name="record_type"]:checked') as HTMLInputElement;
    const recurringData: RecurringSettings = this.recurringSettings.getValue();
    const reminderData: ReminderConfig = this.reminderSettings.getValue();

    return {
      id: this.props.initialData?.id,
      start_date: this.startDateInput.getValue() as string,
      financial_center_id: this.financialCenterSelect.getValue()!,
      record_type: (recordTypeInput?.value || 'expense') as 'expense' | 'income',
      article_id: this.articleSelect.getValue() as number,
      cost_center_id: this.costCenterSelect.getValue(),
      amount: this.amountInput.getValue(),
      description: this.descriptionInput.getValue() || undefined,
      frequency_type: recurringData.frequencyType,
      frequency_value: recurringData.frequencyValue,
      end_date: recurringData.endDate,
      reminder_enabled: reminderData.enabled,
      reminder_datetime: reminderData.datetime,
      reminder_message: reminderData.message
    };
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(event: Event): Promise<void> {
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
    } catch (error) {
      console.error('[RecurringPlanForm] Submit error:', error);

      if (this.props.onError) {
        this.props.onError(error as Error);
      } else {
        alert('Ошибка при сохранении плана');
      }
    } finally {
      this.isSubmitting = false;
      if (this.submitButton) {
        this.submitButton.disabled = false;
        this.submitButton.textContent = this.props.mode === 'create' ? '✅ Создать план' : '💾 Обновить план';
      }
    }
  }

  /**
   * Get the rendered form element
   */
  getElement(): HTMLFormElement | null {
    return this.form;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.startDateInput.destroy();
    this.financialCenterSelect.destroy();
    this.articleSelect.destroy();
    this.costCenterSelect.destroy();
    this.amountInput.destroy();
    this.descriptionInput.destroy();
    this.recurringSettings.destroy();
    this.reminderSettings.destroy();

    if (this.form) {
      this.form.remove();
      this.form = null;
    }

    this.recordTypeButtons.clear();
    this.submitButton = null;
  }
}
