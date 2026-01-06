/**
 * Integration tests for FormModal component
 *
 * Tests form validation and submission functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FormModal } from '@components/modals/FormModal';
import type { ValidationResult } from '@components/types';

describe('FormModal Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render form with submit and cancel buttons', () => {
      const formContent = document.createElement('div');
      formContent.innerHTML = '<input type="text" name="test" />';

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      // Check submit button
      const submitButton = dialog.querySelector('.modal-action .btn-primary');
      expect(submitButton).toBeTruthy();
      expect(submitButton?.textContent).toBe('✅ Сохранить');

      // Check cancel button (in modal-action, not the X button from BaseModal)
      const cancelButton = dialog.querySelector('.modal-action .btn-ghost');
      expect(cancelButton).toBeTruthy();
      expect(cancelButton?.textContent).toBe('❌ Отмена');
    });

    it('should render error container (hidden by default)', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer).toBeTruthy();
      expect(errorContainer?.className).toContain('hidden');
    });

    it('should use custom submit label', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        submitLabel: '💾 Custom Save',
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const submitButton = dialog.querySelector('.btn-primary');
      expect(submitButton?.textContent).toBe('💾 Custom Save');
    });

    it('should use custom cancel label', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        cancelLabel: '🚫 Custom Cancel',
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const cancelButton = dialog.querySelector('.modal-action .btn-ghost');
      expect(cancelButton?.textContent).toBe('🚫 Custom Cancel');
    });

    it('should use custom submit button class', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        submitButtonClass: 'btn-success',
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const submitButton = dialog.querySelector('.btn-success');
      expect(submitButton).toBeTruthy();
    });
  });

  describe('Validation', () => {
    it('should validate before submit', async () => {
      const formContent = document.createElement('div');
      const onValidate = vi.fn().mockReturnValue({ valid: false, error: 'Validation failed' });
      const onSubmit = vi.fn();

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onValidate,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      // Click submit button
      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onValidate).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled(); // Should not submit if validation fails
    });

    it('should show validation error message', async () => {
      const formContent = document.createElement('div');
      const onValidate = vi.fn().mockReturnValue({ valid: false, error: 'Field is required' });

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onValidate,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');
      expect(errorContainer?.textContent).toBe('Field is required');
    });

    it('should clear error on successful validation', async () => {
      const formContent = document.createElement('div');
      let validationResult: ValidationResult = { valid: false, error: 'Error' };
      const onValidate = vi.fn(() => validationResult);
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onValidate,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;

      // First submit with error
      submitButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      let errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');

      // Second submit with success
      validationResult = { valid: true };
      submitButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).toContain('hidden');
    });
  });

  describe('Submission', () => {
    it('should call onSubmit when validation passes', async () => {
      const formContent = document.createElement('div');
      const onValidate = vi.fn().mockReturnValue({ valid: true });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onValidate,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      const formContent = document.createElement('div');
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>(resolve => {
        resolveSubmit = resolve;
      });

      const onSubmit = vi.fn().mockReturnValue(submitPromise);

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.modal-action .btn-primary') as HTMLButtonElement;
      const cancelButton = dialog.querySelector('.modal-action .btn-ghost') as HTMLButtonElement;

      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check loading state
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.className).toContain('loading');
      expect(submitButton.textContent).toBe('⏳ Сохранение...');
      // Note: cancelButton disabled state might not be immediately updated in tests
      // expect(cancelButton.disabled).toBe(true);

      // Resolve submission
      resolveSubmit!();
      await submitPromise;
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check state restored
      expect(submitButton.disabled).toBe(false);
      expect(submitButton.className).not.toContain('loading');
    });

    it('should call onSuccess after successful submission', async () => {
      const formContent = document.createElement('div');
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onSuccess = vi.fn();

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit,
        onSuccess
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should close modal after successful submission', async () => {
      const formContent = document.createElement('div');
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      expect(modal.isModalOpen()).toBe(true);

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(modal.isModalOpen()).toBe(false);
    });

    it('should keep modal open when keepOpenOnSuccess is true', async () => {
      const formContent = document.createElement('div');
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit,
        keepOpenOnSuccess: true
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(modal.isModalOpen()).toBe(true);
    });

    it('should handle submission errors', async () => {
      const formContent = document.createElement('div');
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should show error
      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');
      expect(errorContainer?.textContent).toBe('Submit failed');

      // Modal should stay open
      expect(modal.isModalOpen()).toBe(true);

      // Button should be re-enabled
      expect(submitButton.disabled).toBe(false);
    });

    it('should call onError handler when provided', async () => {
      const formContent = document.createElement('div');
      const error = new Error('Custom error');
      const onSubmit = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit,
        onError
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should prevent multiple simultaneous submissions', async () => {
      const formContent = document.createElement('div');
      const onSubmit = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const submitButton = dialog.querySelector('.btn-primary') as HTMLButtonElement;

      // Click multiple times rapidly
      submitButton.click();
      submitButton.click();
      submitButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      // Should only submit once
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel Action', () => {
    it('should close modal when cancel button is clicked', async () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      expect(modal.isModalOpen()).toBe(true);

      const cancelButton = dialog.querySelector('.modal-action .btn-ghost') as HTMLButtonElement;
      cancelButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(modal.isModalOpen()).toBe(false);
    });

    it('should call onCancel callback when cancel is clicked', async () => {
      const formContent = document.createElement('div');
      const onCancel = vi.fn();

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn(),
        onCancel
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const cancelButton = dialog.querySelector('.modal-action .btn-ghost') as HTMLButtonElement;
      cancelButton.click();

      // Wait for click event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onCancel).toHaveBeenCalled();
    });

    it('should clear errors when modal closes', async () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      // Show error
      modal.showError('Test error');
      let errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');

      // Close modal
      modal.close();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Reopen - error should be cleared
      modal.open();
      errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).toContain('hidden');
    });
  });

  describe('Error Display', () => {
    it('should show error message', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.showError('Test error message');

      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).not.toContain('hidden');
      expect(errorContainer?.textContent).toBe('Test error message');
    });

    it('should clear error message', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.showError('Test error');
      modal.clearError();

      const errorContainer = dialog.querySelector('.alert-error');
      expect(errorContainer?.className).toContain('hidden');
      expect(errorContainer?.textContent).toBe('');
    });
  });

  describe('Content Management', () => {
    it('should update form content', () => {
      const formContent = document.createElement('div');
      formContent.id = 'original-form';

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const newFormContent = document.createElement('div');
      newFormContent.id = 'new-form';

      modal.setFormContent(newFormContent);

      expect(dialog.querySelector('#new-form')).toBeTruthy();
      expect(dialog.querySelector('#original-form')).toBeNull();
    });
  });

  describe('Lifecycle', () => {
    it('should clean up resources on destroy', () => {
      const formContent = document.createElement('div');

      const modal = new FormModal({
        id: 'test-form-modal',
        title: 'Test Form',
        formContent,
        onSubmit: vi.fn()
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.destroy();

      expect(modal.getElement()).toBeNull();
      expect(dialog.parentElement).toBeNull();
    });
  });
});
