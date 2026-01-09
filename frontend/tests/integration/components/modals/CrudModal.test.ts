/**
 * Integration tests for CrudModal component
 *
 * Tests CRUD operations (Create, Read, Update, Delete) functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrudModal } from '@components/modals/CrudModal';
import type { ValidationResult } from '@components/types';

// Mock entity interface
interface TestEntity {
  id?: number;
  name: string;
  value: number;
}

// Mock form class
class MockForm {
  private data: Partial<TestEntity>;
  private container: HTMLElement | null = null;

  constructor(private mode: 'create' | 'edit', initialData?: TestEntity) {
    this.data = initialData || { name: '', value: 0 };
  }

  render(container: HTMLElement): void {
    this.container = container;

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'name';
    input.value = this.data.name || '';
    container.appendChild(input);

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.name = 'value';
    numberInput.value = String(this.data.value || 0);
    container.appendChild(numberInput);
  }

  validate(): ValidationResult {
    const nameInput = this.container?.querySelector('input[name="name"]') as HTMLInputElement;
    if (!nameInput || !nameInput.value) {
      return { valid: false, error: 'Name is required' };
    }
    return { valid: true };
  }

  collectFormData(): TestEntity {
    const nameInput = this.container?.querySelector('input[name="name"]') as HTMLInputElement;
    const valueInput = this.container?.querySelector('input[name="value"]') as HTMLInputElement;

    return {
      id: this.data.id,
      name: nameInput.value,
      value: parseInt(valueInput.value)
    };
  }

  getElement(): HTMLElement | null {
    return this.container;
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}

describe('CrudModal Integration', () => {
  let container: HTMLDivElement;
  let formBuilder: (mode: 'create' | 'edit', data?: TestEntity) => MockForm;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    formBuilder = vi.fn((mode, data) => new MockForm(mode, data));
  });

  afterEach(() => {
    container.remove();
  });

  describe('Create Mode', () => {
    it('should open modal in create mode', async () => {
      const onCreate = vi.fn().mockResolvedValue({ id: 1 });

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate,
        onUpdate: vi.fn()
      });

      await modal.openForCreate();

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Check title
      const title = dialog.querySelector('h3');
      expect(title?.textContent).toBe('Create Entity');

      // Check submit button label
      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      expect(submitButton.textContent).toBe('✅ Создать');

      // Should not have delete button in create mode
      const deleteButton = dialog.querySelector('.btn-error');
      expect(deleteButton).toBeNull();

      expect(modal.getMode()).toBe('create');
    });

    it('should call onCreate when submitting new entity', async () => {
      const onCreate = vi.fn().mockResolvedValue({ id: 1 });
      const onSuccess = vi.fn();

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate,
        onUpdate: vi.fn(),
        onSuccess
      });

      await modal.openForCreate();

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Fill form
      const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
      nameInput.value = 'Test Name';

      const valueInput = dialog.querySelector('input[name="value"]') as HTMLInputElement;
      valueInput.value = '42';

      // Submit
      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onCreate).toHaveBeenCalledWith({
        name: 'Test Name',
        value: 42
      });
      expect(onSuccess).toHaveBeenCalledWith('create', null);
    });

    it('should validate before creating', async () => {
      const onCreate = vi.fn();

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate,
        onUpdate: vi.fn()
      });

      await modal.openForCreate();

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Leave name empty (validation should fail)
      const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
      nameInput.value = '';

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call onCreate
      expect(onCreate).not.toHaveBeenCalled();

      // Should show error
      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');
      expect(errorContainer?.textContent).toBe('Name is required');
    });
  });

  describe('Edit Mode', () => {
    it('should open modal in edit mode with existing data', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      const onUpdate = vi.fn().mockResolvedValue({ id: 1 });

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Check title
      const title = dialog.querySelector('h3');
      expect(title?.textContent).toBe('Edit Entity');

      // Check submit button label
      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      expect(submitButton.textContent).toBe('💾 Обновить');

      // Check form is populated
      const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
      expect(nameInput.value).toBe('Existing');

      const valueInput = dialog.querySelector('input[name="value"]') as HTMLInputElement;
      expect(valueInput.value).toBe('100');

      expect(modal.getMode()).toBe('edit');
    });

    it('should call onUpdate when submitting edited entity', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      const onUpdate = vi.fn().mockResolvedValue({ id: 1 });
      const onSuccess = vi.fn();

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate,
        onSuccess
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Update form
      const nameInput = dialog.querySelector('input[name="name"]') as HTMLInputElement;
      nameInput.value = 'Updated Name';

      // Submit
      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onUpdate).toHaveBeenCalledWith(1, {
        id: 1,
        name: 'Updated Name',
        value: 100
      });
      expect(onSuccess).toHaveBeenCalledWith('edit', existingData);
    });

    it('should show delete button in edit mode', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn().mockResolvedValue({}),
        onDelete: vi.fn().mockResolvedValue(undefined)
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error');
      expect(deleteButton).toBeTruthy();
      expect(deleteButton?.textContent).toBe('🗑️ Удалить');
    });

    it('should not show delete button if onDelete not provided', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn().mockResolvedValue({})
        // No onDelete
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error');
      expect(deleteButton).toBeNull();
    });
  });

  describe('Delete Functionality', () => {
    it('should call onDelete when delete button is clicked and confirmed', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onSuccess = vi.fn();

      // Mock confirm dialog
      const originalConfirm = global.confirm;
      global.confirm = vi.fn().mockReturnValue(true);

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete,
        onSuccess
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error') as HTMLButtonElement;
      deleteButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(global.confirm).toHaveBeenCalledWith('Вы уверены, что хотите удалить test entity?');
      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onSuccess).toHaveBeenCalledWith('delete', existingData);

      // Restore original confirm
      global.confirm = originalConfirm;
    });

    it('should not delete if user cancels confirmation', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      const onDelete = vi.fn();

      // Mock confirm dialog to return false
      const originalConfirm = global.confirm;
      global.confirm = vi.fn().mockReturnValue(false);

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error') as HTMLButtonElement;
      deleteButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onDelete).not.toHaveBeenCalled();

      // Restore original confirm
      global.confirm = originalConfirm;
    });

    it('should use custom delete confirmation message', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };

      const originalConfirm = global.confirm;
      global.confirm = vi.fn().mockReturnValue(true);

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn().mockResolvedValue(undefined),
        deleteConfirmMessage: 'Are you sure you want to delete this item?'
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error') as HTMLButtonElement;
      deleteButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this item?');

      global.confirm = originalConfirm;
    });

    it('should handle delete errors', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      const error = new Error('Delete failed');
      const onDelete = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      const originalConfirm = global.confirm;
      global.confirm = vi.fn().mockReturnValue(true);

      const originalAlert = global.alert;
      global.alert = vi.fn();

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete,
        onError
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error') as HTMLButtonElement;
      deleteButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onError).toHaveBeenCalledWith(error);

      // Button should be re-enabled
      expect(deleteButton.disabled).toBe(false);
      expect(deleteButton.textContent).toBe('🗑️ Удалить');

      global.confirm = originalConfirm;
      global.alert = originalAlert;
    });

    it('should show loading state during delete', async () => {
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>(resolve => {
        resolveDelete = resolve;
      });

      const onDelete = vi.fn().mockReturnValue(deletePromise);

      const originalConfirm = global.confirm;
      global.confirm = vi.fn().mockReturnValue(true);

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const deleteButton = dialog.querySelector('.btn-error') as HTMLButtonElement;
      deleteButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check loading state
      expect(deleteButton.disabled).toBe(true);
      expect(deleteButton.textContent).toBe('⏳ Удаление...');

      // Resolve deletion
      resolveDelete!();
      await deletePromise;
      await new Promise(resolve => setTimeout(resolve, 10));

      global.confirm = originalConfirm;
    });
  });

  describe('Mode Switching', () => {
    it('should switch from create to edit mode', async () => {
      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn().mockResolvedValue({}),
        onUpdate: vi.fn().mockResolvedValue({}),
        onDelete: vi.fn().mockResolvedValue(undefined)
      });

      // Start in create mode
      await modal.openForCreate();
      expect(modal.getMode()).toBe('create');

      let dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      // Check no delete button
      expect(dialog.querySelector('.btn-error')).toBeNull();

      // Switch to edit mode
      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      await modal.openForEdit(existingData);

      dialog = modal.render()!;
      // Dialog is recreated and automatically added to document.body by CrudModal

      expect(modal.getMode()).toBe('edit');

      // Check delete button now exists
      expect(dialog.querySelector('.btn-error')).toBeTruthy();

      // Check title changed
      const title = dialog.querySelector('h3');
      expect(title?.textContent).toBe('Edit Entity');
    });

    it('should create new form instance when switching modes', async () => {
      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn().mockResolvedValue({}),
        onUpdate: vi.fn().mockResolvedValue({})
      });

      await modal.openForCreate();
      expect(formBuilder).toHaveBeenCalledWith('create', undefined);

      const existingData: TestEntity = { id: 1, name: 'Existing', value: 100 };
      await modal.openForEdit(existingData);

      expect(formBuilder).toHaveBeenCalledWith('edit', existingData);
      expect(formBuilder).toHaveBeenCalledTimes(2);
    });
  });

  describe('Form Access', () => {
    it('should provide access to current form via getForm()', async () => {
      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn().mockResolvedValue({}),
        onUpdate: vi.fn()
      });

      await modal.openForCreate();

      const form = modal.getForm();
      expect(form).toBeInstanceOf(MockForm);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when rendering before opening', () => {
      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate: vi.fn()
      });

      expect(() => modal.render()).toThrow('[CrudModal] Modal not initialized');
    });

    it('should throw error when updating without ID', async () => {
      const existingData: TestEntity = { name: 'No ID', value: 100 }; // Missing ID
      const onUpdate = vi.fn();

      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn(),
        onUpdate
      });

      await modal.openForEdit(existingData);

      const dialog = modal.render()!;
      // Dialog is now automatically added to document.body by CrudModal

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onUpdate).not.toHaveBeenCalled();

      // Should show error
      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');
      expect(errorContainer?.textContent).toContain('Entity ID is required for update');
    });
  });

  describe('Lifecycle', () => {
    it('should clean up resources on destroy', async () => {
      const modal = new CrudModal<TestEntity>({
        id: 'test-crud-modal',
        entity: 'test entity',
        createTitle: 'Create Entity',
        editTitle: 'Edit Entity',
        formBuilder,
        onCreate: vi.fn().mockResolvedValue({}),
        onUpdate: vi.fn()
      });

      await modal.openForCreate();

      const form = modal.getForm();
      expect(form).toBeTruthy();

      modal.destroy();

      expect(modal.getForm()).toBeNull();
    });
  });
});
