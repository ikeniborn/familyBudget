/**
 * AdminCrudForm - Generic CRUD form for admin panels
 *
 * Universal form component for admin CRUD operations. Supports dynamic field
 * definitions with various input types. Saves ~1,200 lines of duplicated code
 * across admin panels (articles, financial centers, cost centers, etc.).
 *
 * @example
 * ```typescript
 * interface Article {
 *   id?: number;
 *   name: string;
 *   type: 'expense' | 'income';
 *   parent_id: number | null;
 *   is_active: boolean;
 * }
 *
 * const form = new AdminCrudForm<Article>({
 *   entity: 'article',
 *   mode: 'create',
 *   fields: [
 *     { name: 'name', type: 'text', label: 'Название', required: true },
 *     { name: 'type', type: 'select', label: 'Тип', required: true, options: [
 *       { value: 'expense', label: 'Расход' },
 *       { value: 'income', label: 'Доход' }
 *     ]},
 *     { name: 'parent_id', type: 'select', label: 'Родитель', options: [] },
 *     { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
 *   ],
 *   onSubmit: async (data) => {
 *     const response = await fetch('/api/v1/admin/articles', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   }
 * });
 *
 * form.render(document.getElementById('form-container')!);
 * ```
 *
 * @category Form Components
 */

import { TextInput } from '../core/TextInput';
import { TextareaInput } from '../core/TextareaInput';
import { AmountInput } from '../core/AmountInput';
import { SelectDropdown } from '../core/SelectDropdown';
import { FormField } from '../core/FormField';
import type { ValidationResult, SelectOption } from '../types';

export interface AdminCrudFormProps<T> {
  entity: string;                    // Entity name (for logging)
  mode: 'create' | 'edit';
  fields: FieldDefinition[];
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<any>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multi-select' | 'checkbox';
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  options?: SelectOption[];          // For select/multi-select
  maxLength?: number;                // For text/textarea
  min?: number;                      // For number
  max?: number;                      // For number
  step?: number;                     // For number
  rows?: number;                     // For textarea
  disabled?: boolean;
  asyncOptions?: () => Promise<SelectOption[]>; // For dynamic options
}

interface FieldComponent {
  component: TextInput | TextareaInput | AmountInput | SelectDropdown | HTMLDivElement;
  definition: FieldDefinition;
  fieldWrapper: FormField | null;
}

export class AdminCrudForm<T extends Record<string, any>> {
  private container: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private fields: Map<string, FieldComponent> = new Map();
  private submitButton: HTMLButtonElement | null = null;
  private isSubmitting: boolean = false;

  constructor(private props: AdminCrudFormProps<T>) {}

  /**
   * Initialize and render the form
   */
  async render(container: HTMLElement): Promise<void> {
    this.container = container;

    // Load async options for fields
    await this.loadAsyncOptions();

    // Create form element
    this.form = document.createElement('form');
    this.form.className = 'space-y-2 sm:space-y-4';
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Create fields
    for (const fieldDef of this.props.fields) {
      const fieldComponent = this.createField(fieldDef);
      if (fieldComponent) {
        this.fields.set(fieldDef.name, fieldComponent);

        if (fieldComponent.fieldWrapper) {
          this.form.appendChild(fieldComponent.fieldWrapper.render());
        } else if (fieldComponent.component instanceof HTMLElement) {
          // Checkbox without wrapper
          this.form.appendChild(fieldComponent.component);
        }
      }
    }

    // Submit button
    const actions = document.createElement('div');
    actions.className = 'modal-action';

    this.submitButton = document.createElement('button');
    this.submitButton.type = 'submit';
    this.submitButton.className = 'btn btn-sm sm:btn-md btn-primary flex-1 sm:flex-initial';
    this.submitButton.textContent = this.props.mode === 'create' ? '✅ Создать' : '✅ Сохранить';

    actions.appendChild(this.submitButton);
    this.form.appendChild(actions);

    // Add to container
    this.container.appendChild(this.form);
  }

  /**
   * Load async options for select fields
   */
  private async loadAsyncOptions(): Promise<void> {
    const fieldsWithAsync = this.props.fields.filter(field => field.asyncOptions);

    const promises = fieldsWithAsync.map(async (field: FieldDefinition) => {
      if (field.asyncOptions) {
        field.options = await field.asyncOptions();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Create a field component based on definition
   */
  private createField(def: FieldDefinition): FieldComponent | null {
    let component: any = null;
    let fieldWrapper: FormField | null = null;

    switch (def.type) {
      case 'text':
        component = new TextInput({
          name: def.name,
          value: this.props.initialData?.[def.name],
          placeholder: def.placeholder,
          required: def.required,
          maxLength: def.maxLength,
          disabled: def.disabled
        });

        fieldWrapper = new FormField({
          label: def.label,
          name: def.name,
          required: def.required,
          helpText: def.helpText,
          children: component.render()
        });
        break;

      case 'textarea':
        component = new TextareaInput({
          name: def.name,
          value: this.props.initialData?.[def.name],
          placeholder: def.placeholder,
          required: def.required,
          maxLength: def.maxLength,
          rows: def.rows,
          disabled: def.disabled
        });

        fieldWrapper = new FormField({
          label: def.label,
          name: def.name,
          required: def.required,
          helpText: def.helpText,
          children: component.render()
        });
        break;

      case 'number':
        component = new AmountInput({
          name: def.name,
          value: this.props.initialData?.[def.name],
          min: def.min,
          max: def.max,
          step: def.step,
          required: def.required,
          placeholder: def.placeholder,
          disabled: def.disabled
        });

        fieldWrapper = new FormField({
          label: def.label,
          name: def.name,
          required: def.required,
          helpText: def.helpText,
          children: component.render()
        });
        break;

      case 'select':
        component = new SelectDropdown({
          name: def.name,
          value: this.props.initialData?.[def.name]?.toString(),
          options: def.options || [],
          required: def.required,
          disabled: def.disabled
        });

        fieldWrapper = new FormField({
          label: def.label,
          name: def.name,
          required: def.required,
          helpText: def.helpText,
          children: component.render()
        });
        break;

      case 'multi-select':
        component = new SelectDropdown({
          name: def.name,
          value: this.props.initialData?.[def.name],
          options: def.options || [],
          multiple: true,
          size: 5,
          required: def.required,
          disabled: def.disabled
        });

        fieldWrapper = new FormField({
          label: def.label,
          name: def.name,
          required: def.required,
          helpText: def.helpText,
          children: component.render()
        });
        break;

      case 'checkbox':
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'form-control';

        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'label cursor-pointer';

        const labelText = document.createElement('span');
        labelText.className = 'label-text';
        labelText.textContent = def.label;

        component = document.createElement('input');
        component.type = 'checkbox';
        component.name = def.name;
        component.className = 'checkbox';
        component.checked = this.props.initialData?.[def.name] ?? def.defaultValue ?? false;
        component.disabled = def.disabled || false;

        checkboxLabel.appendChild(labelText);
        checkboxLabel.appendChild(component);
        checkboxContainer.appendChild(checkboxLabel);

        // Return component directly for checkbox (no wrapper)
        return {
          component: checkboxContainer,
          definition: def,
          fieldWrapper: null
        };

      default:
        console.warn(`[AdminCrudForm] Unknown field type: ${def.type}`);
        return null;
    }

    return { component, definition: def, fieldWrapper };
  }

  /**
   * Validate all fields
   */
  validate(): ValidationResult {
    for (const [_, fieldComponent] of this.fields) {
      const { component, definition } = fieldComponent;

      // Skip validation for checkboxes
      if (definition.type === 'checkbox') {
        continue;
      }

      // Validate using component's validate method
      if ('validate' in component && typeof component.validate === 'function') {
        const validation = component.validate();
        if (!validation.valid) {
          return validation;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Collect form data
   */
  private collectFormData(): T {
    const data: any = {};

    // Add ID for edit mode
    if (this.props.mode === 'edit' && this.props.initialData?.id) {
      data.id = this.props.initialData.id;
    }

    // Collect values from all fields
    for (const [fieldName, fieldComponent] of this.fields) {
      const { component, definition } = fieldComponent;

      if (definition.type === 'checkbox') {
        // Checkbox is HTMLDivElement containing input
        const checkbox = (component as HTMLDivElement).querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        data[fieldName] = checkbox?.checked ?? false;
      } else if (definition.type === 'multi-select') {
        // Multi-select returns array
        const value = (component as SelectDropdown).getValue();
        data[fieldName] = Array.isArray(value) ? value.filter(v => v !== '') : [];
      } else if (definition.type === 'number') {
        // Number returns number
        data[fieldName] = (component as AmountInput).getValue();
      } else if (definition.type === 'select') {
        // Select returns string or number
        const value = (component as SelectDropdown).getValue();
        data[fieldName] = value === '' || value === null ? null : value;
      } else {
        // Text/textarea return string
        const value = (component as TextInput | TextareaInput).getValue();
        data[fieldName] = value || undefined;
      }
    }

    return data as T;
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
      console.error(`[AdminCrudForm] Submit error for ${this.props.entity}:`, error);

      if (this.props.onError) {
        this.props.onError(error as Error);
      } else {
        alert(`Ошибка при сохранении ${this.props.entity}`);
      }
    } finally {
      this.isSubmitting = false;
      if (this.submitButton) {
        this.submitButton.disabled = false;
        this.submitButton.textContent = this.props.mode === 'create' ? '✅ Создать' : '✅ Сохранить';
      }
    }
  }

  /**
   * Update field options dynamically
   */
  updateFieldOptions(fieldName: string, options: SelectOption[]): void {
    const fieldComponent = this.fields.get(fieldName);
    if (!fieldComponent) {
      console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
      return;
    }

    if (fieldComponent.definition.type === 'select' || fieldComponent.definition.type === 'multi-select') {
      (fieldComponent.component as SelectDropdown).updateOptions(options);
    }
  }

  /**
   * Set field value programmatically
   */
  setFieldValue(fieldName: string, value: any): void {
    const fieldComponent = this.fields.get(fieldName);
    if (!fieldComponent) {
      console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
      return;
    }

    const { component, definition } = fieldComponent;

    if (definition.type === 'checkbox') {
      const checkbox = (component as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = !!value;
      }
    } else if ('setValue' in component && typeof component.setValue === 'function') {
      (component as any).setValue(value);
    }
  }

  /**
   * Get field value
   */
  getFieldValue(fieldName: string): any {
    const fieldComponent = this.fields.get(fieldName);
    if (!fieldComponent) {
      console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
      return null;
    }

    const { component, definition } = fieldComponent;

    if (definition.type === 'checkbox') {
      const checkbox = (component as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
      return checkbox?.checked ?? false;
    } else if ('getValue' in component && typeof component.getValue === 'function') {
      return component.getValue();
    }

    return null;
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
    for (const [_, fieldComponent] of this.fields) {
      if (fieldComponent.fieldWrapper) {
        fieldComponent.fieldWrapper.destroy();
      }

      if ('destroy' in fieldComponent.component && typeof fieldComponent.component.destroy === 'function') {
        fieldComponent.component.destroy();
      }
    }

    if (this.form) {
      this.form.remove();
      this.form = null;
    }

    this.fields.clear();
    this.submitButton = null;
  }
}
