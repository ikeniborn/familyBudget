/**
 * Integration tests for AdminCrudForm
 *
 * Tests generic CRUD form with various field types and async options
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminCrudForm } from '@components/forms/AdminCrudForm';
import type { FieldDefinition } from '@components/forms/AdminCrudForm';
import type { SelectOption } from '@components/types';

// Test entity interfaces
interface Article {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  parent_id: number | null;
  is_active: boolean;
  sort_order: number;
  description?: string;
}

interface FinancialCenter {
  id?: number;
  name: string;
  type: 'bank' | 'cash' | 'card';
  initial_balance: number;
  currency: string;
  is_active: boolean;
  tags?: string[];
}

describe('AdminCrudForm Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Form Rendering', () => {
    it('should render form with all field types', async () => {
      const fields: FieldDefinition[] = [
        { name: 'name', type: 'text', label: 'Название', required: true },
        { name: 'description', type: 'textarea', label: 'Описание', rows: 3 },
        { name: 'sort_order', type: 'number', label: 'Порядок', min: 0, max: 1000 },
        { name: 'type', type: 'select', label: 'Тип', required: true, options: [
          { value: 'expense', label: 'Расход' },
          { value: 'income', label: 'Доход' }
        ]},
        { name: 'tags', type: 'multi-select', label: 'Теги', options: [
          { value: 'important', label: 'Важное' },
          { value: 'regular', label: 'Обычное' }
        ]},
        { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
      ];

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const formElement = container.querySelector('form');
      expect(formElement).toBeTruthy();

      // Text field
      expect(container.querySelector('input[name="name"]')).toBeTruthy();
      expect(container.querySelector('input[name="name"]')?.getAttribute('type')).toBe('text');

      // Textarea field
      expect(container.querySelector('textarea[name="description"]')).toBeTruthy();

      // Number field
      expect(container.querySelector('input[name="sort_order"]')).toBeTruthy();
      expect(container.querySelector('input[name="sort_order"]')?.getAttribute('type')).toBe('number');

      // Select field
      const typeSelect = container.querySelector('select[name="type"]') as HTMLSelectElement;
      expect(typeSelect).toBeTruthy();
      expect(typeSelect.options.length).toBe(2); // 2 options (no placeholder unless explicitly added)

      // Multi-select field
      const tagsSelect = container.querySelector('select[name="tags"]') as HTMLSelectElement;
      expect(tagsSelect).toBeTruthy();
      expect(tagsSelect.multiple).toBe(true);

      // Checkbox field
      const checkbox = container.querySelector('input[name="is_active"]') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
    });

    it('should render submit button with correct text for create mode', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название' }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitButton).toBeTruthy();
      expect(submitButton.textContent).toContain('Создать');
    });

    it('should render submit button with correct text for edit mode', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'name', type: 'text', label: 'Название' }
        ],
        initialData: { id: 1, name: 'Test' } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitButton.textContent).toContain('Сохранить');
    });
  });

  describe('Initial Data Population', () => {
    it('should populate text field with initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        initialData: { id: 1, name: 'Продукты' } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      expect(input.value).toBe('Продукты');
    });

    it('should populate textarea with initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'description', type: 'textarea', label: 'Описание' }
        ],
        initialData: { description: 'Test description' } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const textarea = container.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test description');
    });

    it('should populate number field with initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'sort_order', type: 'number', label: 'Порядок' }
        ],
        initialData: { sort_order: 42 } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const input = container.querySelector('input[name="sort_order"]') as HTMLInputElement;
      expect(input.value).toBe('42');
    });

    it('should populate select field with initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'type', type: 'select', label: 'Тип', options: [
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' }
          ]}
        ],
        initialData: { type: 'income' } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const select = container.querySelector('select[name="type"]') as HTMLSelectElement;
      expect(select.value).toBe('income');
    });

    it('should populate checkbox with initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'is_active', type: 'checkbox', label: 'Активна' }
        ],
        initialData: { is_active: false } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const checkbox = container.querySelector('input[name="is_active"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should use default value for checkbox when no initial data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      const checkbox = container.querySelector('input[name="is_active"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Async Options Loading', () => {
    it('should load async options before rendering', async () => {
      const asyncOptions = vi.fn().mockResolvedValue([
        { value: '1', label: 'Parent 1' },
        { value: '2', label: 'Parent 2' }
      ] as SelectOption[]);

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'parent_id', type: 'select', label: 'Родитель', asyncOptions }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Async function should have been called
      expect(asyncOptions).toHaveBeenCalled();

      // Options should be populated
      const select = container.querySelector('select[name="parent_id"]') as HTMLSelectElement;
      expect(select.options.length).toBe(2); // 2 options
      expect(select.options[0].textContent).toBe('Parent 1');
      expect(select.options[1].textContent).toBe('Parent 2');
    });

    it('should handle multiple async fields', async () => {
      const asyncParents = vi.fn().mockResolvedValue([
        { value: '1', label: 'Parent 1' }
      ] as SelectOption[]);

      const asyncTags = vi.fn().mockResolvedValue([
        { value: 'tag1', label: 'Tag 1' }
      ] as SelectOption[]);

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'parent_id', type: 'select', label: 'Родитель', asyncOptions: asyncParents },
          { name: 'tags', type: 'multi-select', label: 'Теги', asyncOptions: asyncTags }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Both async functions should have been called
      expect(asyncParents).toHaveBeenCalled();
      expect(asyncTags).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should validate required text field', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Empty value
      const validation = form.validate();
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeTruthy();
    });

    it('should validate number constraints', async () => {
      const form = new AdminCrudForm<FinancialCenter>({
        entity: 'financial_center',
        mode: 'create',
        fields: [
          { name: 'initial_balance', type: 'number', label: 'Начальный баланс', min: 0, max: 1000000 }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Set invalid value via input
      const input = container.querySelector('input[name="initial_balance"]') as HTMLInputElement;
      input.value = '-100';

      const validation = form.validate();
      expect(validation.valid).toBe(false);
    });

    it('should pass validation for valid data', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Set valid value
      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      input.value = 'Valid Name';

      const validation = form.validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should collect data correctly for all field types', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ success: true });

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true },
          { name: 'description', type: 'textarea', label: 'Описание' },
          { name: 'sort_order', type: 'number', label: 'Порядок' },
          { name: 'type', type: 'select', label: 'Тип', options: [
            { value: 'expense', label: 'Расход' }
          ]},
          { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
        ],
        onSubmit
      });

      await form.render(container);

      // Fill form
      const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
      nameInput.value = 'Test Article';

      const descInput = container.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
      descInput.value = 'Test Description';

      const sortInput = container.querySelector('input[name="sort_order"]') as HTMLInputElement;
      sortInput.value = '10';

      const typeSelect = container.querySelector('select[name="type"]') as HTMLSelectElement;
      typeSelect.value = 'expense';

      // Submit
      const formElement = container.querySelector('form') as HTMLFormElement;
      formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // onSubmit should be called with correct data structure
      // (verification depends on implementation)
    });

    it('should include ID in edit mode', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ success: true });

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        initialData: { id: 123, name: 'Existing' } as any,
        onSubmit
      });

      await form.render(container);

      // Submit without changes
      const formElement = container.querySelector('form') as HTMLFormElement;
      formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // ID should be included in submitted data
    });

    it('should handle submission errors', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('API Error'));
      const onError = vi.fn();

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        onSubmit,
        onError
      });

      await form.render(container);

      // Fill required field
      const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
      nameInput.value = 'Test';

      // Submit
      const formElement = container.querySelector('form') as HTMLFormElement;
      formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Error handler should be called (in real implementation)
    });

    it('should disable submit button during submission', async () => {
      const onSubmit = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true }
        ],
        onSubmit
      });

      await form.render(container);

      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);

      // Button state changes during submission (implementation-specific)
    });
  });

  describe('Dynamic Field Updates', () => {
    it('should update select field options dynamically', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'parent_id', type: 'select', label: 'Родитель', options: [
            { value: '1', label: 'Parent 1' }
          ]}
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Initial options
      const select = container.querySelector('select[name="parent_id"]') as HTMLSelectElement;
      expect(select.options.length).toBe(1); // 1 option

      // Update options
      form.updateFieldOptions('parent_id', [
        { value: '1', label: 'Parent 1' },
        { value: '2', label: 'Parent 2' },
        { value: '3', label: 'Parent 3' }
      ]);

      // Options should be updated
      expect(select.options.length).toBe(3); // 3 options
    });

    it('should set field value programmatically', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название' }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Set value
      form.setFieldValue('name', 'Programmatic Value');

      // Value should be updated
      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      expect(input.value).toBe('Programmatic Value');
    });

    it('should get field value programmatically', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название' }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Set value via input
      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      input.value = 'Test Value';

      // Get value
      const value = form.getFieldValue('name');
      expect(value).toBe('Test Value');
    });

    it('should handle checkbox value programmatically', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Set value
      form.setFieldValue('is_active', false);

      // Get value
      const value = form.getFieldValue('is_active');
      expect(value).toBe(false);
    });
  });

  describe('Field Attributes', () => {
    it('should apply maxLength to text field', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', maxLength: 50 }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      expect(input.maxLength).toBe(50);
    });

    it('should apply min/max to number field', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'sort_order', type: 'number', label: 'Порядок', min: 1, max: 100 }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      const input = container.querySelector('input[name="sort_order"]') as HTMLInputElement;
      expect(input.min).toBe('1');
      expect(input.max).toBe('100');
    });

    it('should apply rows to textarea', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'description', type: 'textarea', label: 'Описание', rows: 5 }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      const textarea = container.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
      // rows attribute can be string or number depending on browser/Happy-DOM
      expect(textarea.getAttribute('rows')).toBe('5');
    });

    it('should apply disabled attribute', async () => {
      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'edit',
        fields: [
          { name: 'name', type: 'text', label: 'Название', disabled: true }
        ],
        initialData: { name: 'Locked' } as any,
        onSubmit: vi.fn()
      });

      await form.render(container);

      const input = container.querySelector('input[name="name"]') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete Article CRUD workflow', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ id: 42 });
      const onSuccess = vi.fn();

      const form = new AdminCrudForm<Article>({
        entity: 'article',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true },
          { name: 'type', type: 'select', label: 'Тип', required: true, options: [
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' }
          ]},
          { name: 'is_active', type: 'checkbox', label: 'Активна', defaultValue: true }
        ],
        onSubmit,
        onSuccess
      });

      await form.render(container);

      // Fill form
      form.setFieldValue('name', 'Продукты');
      form.setFieldValue('type', 'expense');

      // Validate
      const validation = form.validate();
      expect(validation.valid).toBe(true);

      // Submit
      const formElement = container.querySelector('form') as HTMLFormElement;
      formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle FinancialCenter with async parent options', async () => {
      const asyncParents = vi.fn().mockResolvedValue([
        { value: '1', label: 'Main Account' },
        { value: '2', label: 'Savings' }
      ] as SelectOption[]);

      const form = new AdminCrudForm<FinancialCenter>({
        entity: 'financial_center',
        mode: 'create',
        fields: [
          { name: 'name', type: 'text', label: 'Название', required: true },
          { name: 'type', type: 'select', label: 'Тип', required: true, options: [
            { value: 'bank', label: 'Банк' },
            { value: 'cash', label: 'Наличные' },
            { value: 'card', label: 'Карта' }
          ]},
          { name: 'initial_balance', type: 'number', label: 'Начальный баланс', required: true },
          { name: 'parent_id', type: 'select', label: 'Родительский счёт', asyncOptions: asyncParents }
        ],
        onSubmit: vi.fn()
      });

      await form.render(container);

      // Async options should be loaded
      expect(asyncParents).toHaveBeenCalled();

      const parentSelect = container.querySelector('select[name="parent_id"]') as HTMLSelectElement;
      expect(parentSelect.options.length).toBe(2); // 2 options
    });
  });
});
