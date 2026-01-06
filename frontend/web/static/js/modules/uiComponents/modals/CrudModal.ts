/**
 * CrudModal - Modal for CRUD operations (Create, Read, Update, Delete)
 *
 * Specialized FormModal that handles common CRUD operations with:
 * - Dynamic mode switching (create/edit)
 * - Delete confirmation
 * - API integration helpers
 * - Optimistic updates support
 *
 * @example
 * ```typescript
 * interface Article {
 *   id?: number;
 *   name: string;
 *   type: string;
 * }
 *
 * const modal = new CrudModal<Article>({
 *   id: 'article-modal',
 *   entity: 'article',
 *   createTitle: 'Create Article',
 *   editTitle: 'Edit Article',
 *   formBuilder: (mode, data) => {
 *     return new AdminCrudForm<Article>({
 *       entity: 'article',
 *       mode: mode,
 *       fields: [...],
 *       initialData: data,
 *       onSubmit: async (formData) => {
 *         // Form submit handled by CrudModal
 *       }
 *     });
 *   },
 *   onCreate: async (data) => {
 *     const response = await fetch('/api/v1/articles', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   },
 *   onUpdate: async (id, data) => {
 *     const response = await fetch(`/api/v1/articles/${id}`, {
 *       method: 'PUT',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   },
 *   onDelete: async (id) => {
 *     await fetch(`/api/v1/articles/${id}`, { method: 'DELETE' });
 *   },
 *   onSuccess: () => {
 *     reloadTable();
 *   }
 * });
 *
 * document.body.appendChild(modal.render());
 *
 * // Open for create
 * modal.openForCreate();
 *
 * // Open for edit
 * modal.openForEdit(existingArticle);
 * ```
 *
 * @category Modal Components
 */

import { FormModal } from './FormModal';
import type { ValidationResult } from '../types';

export interface CrudModalProps<T> {
  id: string;
  entity: string;                                    // Entity name (for messages)
  createTitle: string;
  editTitle: string;
  size?: string;
  formBuilder: (mode: 'create' | 'edit', data?: T) => {
    render(container: HTMLElement): void | Promise<void>;
    validate(): ValidationResult;
    getElement(): HTMLElement | null;
    destroy(): void;
    [key: string]: any;  // Allow access to form-specific methods
  };
  onCreate: (data: T) => Promise<any>;
  onUpdate: (id: number | string, data: T) => Promise<any>;
  onDelete?: (id: number | string) => Promise<void>;
  onSuccess?: (mode: 'create' | 'edit' | 'delete', data?: any) => void;
  onError?: (error: Error) => void;
  deleteConfirmMessage?: string;
}

export class CrudModal<T extends { id?: number | string }> {
  private formModal: FormModal | null = null;
  private currentMode: 'create' | 'edit' = 'create';
  private currentData: T | null = null;
  private currentForm: any = null;
  private deleteButton: HTMLButtonElement | null = null;

  constructor(private props: CrudModalProps<T>) {}

  /**
   * Open modal for creating new entity
   */
  async openForCreate(): Promise<void> {
    this.currentMode = 'create';
    this.currentData = null;

    await this.setupModal();
    this.formModal!.open();
  }

  /**
   * Open modal for editing existing entity
   */
  async openForEdit(data: T): Promise<void> {
    this.currentMode = 'edit';
    this.currentData = data;

    await this.setupModal();
    this.formModal!.open();
  }

  /**
   * Setup modal with current mode and data
   */
  private async setupModal(): Promise<void> {
    // Destroy previous form if exists
    if (this.currentForm) {
      this.currentForm.destroy();
      this.currentForm = null;
    }

    // Destroy previous modal if exists
    if (this.formModal) {
      this.formModal.destroy();
      this.formModal = null;
    }

    // Create form
    this.currentForm = this.props.formBuilder(this.currentMode, this.currentData || undefined);

    // Create container for form
    const formContainer = document.createElement('div');
    formContainer.id = `${this.props.id}-form-container`;

    // Render form into container
    if (this.currentForm.render) {
      const result = this.currentForm.render(formContainer);
      if (result instanceof Promise) {
        await result;
      }
    }

    // Create FormModal
    this.formModal = new FormModal({
      id: this.props.id,
      title: this.currentMode === 'create' ? this.props.createTitle : this.props.editTitle,
      size: this.props.size,
      formContent: formContainer,
      submitLabel: this.currentMode === 'create' ? '✅ Создать' : '💾 Обновить',
      onValidate: () => this.handleValidate(),
      onSubmit: () => this.handleSubmit(),
      onSuccess: () => this.handleSuccess(),
      onError: (error: Error) => this.handleError(error),
      onClose: () => this.cleanup()
    });

    // Render and add to DOM (required before open())
    const dialog = this.formModal.render();
    if (!dialog.parentElement) {
      document.body.appendChild(dialog);
    }

    // Add delete button for edit mode
    if (this.currentMode === 'edit' && this.props.onDelete) {
      this.addDeleteButton();
    }
  }

  /**
   * Add delete button to modal
   */
  private addDeleteButton(): void {
    if (!this.formModal) return;

    const container = this.formModal.getContentContainer();
    if (!container) return;

    // Find modal-action div
    const actions = container.querySelector('.modal-action');
    if (!actions) return;

    // Create delete button
    this.deleteButton = document.createElement('button');
    this.deleteButton.type = 'button';
    this.deleteButton.className = 'btn btn-sm btn-error mr-auto';
    this.deleteButton.textContent = '🗑️ Удалить';
    this.deleteButton.addEventListener('click', () => this.handleDelete());

    // Insert as first button
    actions.insertBefore(this.deleteButton, actions.firstChild);
  }

  /**
   * Handle form validation
   */
  private handleValidate(): ValidationResult {
    if (!this.currentForm || !this.currentForm.validate) {
      return { valid: true };
    }

    return this.currentForm.validate();
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    // Collect form data
    let data: T;

    if (this.currentForm.collectFormData) {
      data = this.currentForm.collectFormData();
    } else if (this.currentForm.getValue) {
      data = this.currentForm.getValue();
    } else {
      throw new Error('[CrudModal] Form must have collectFormData() or getValue() method');
    }

    // Call appropriate handler
    if (this.currentMode === 'create') {
      await this.props.onCreate(data);
    } else {
      const id = this.currentData?.id;
      if (!id) {
        throw new Error('[CrudModal] Entity ID is required for update');
      }
      await this.props.onUpdate(id, data);
    }
  }

  /**
   * Handle delete action
   */
  private async handleDelete(): Promise<void> {
    if (!this.props.onDelete || !this.currentData?.id) {
      return;
    }

    // Confirm deletion
    const message = this.props.deleteConfirmMessage ||
                   `Вы уверены, что хотите удалить ${this.props.entity}?`;

    if (!confirm(message)) {
      return;
    }

    // Disable delete button
    if (this.deleteButton) {
      this.deleteButton.disabled = true;
      this.deleteButton.textContent = '⏳ Удаление...';
    }

    try {
      await this.props.onDelete(this.currentData.id);

      // Call success handler
      if (this.props.onSuccess) {
        this.props.onSuccess('delete', this.currentData);
      }

      // Close modal
      if (this.formModal) {
        this.formModal.close();
      }
    } catch (error) {
      console.error('[CrudModal] Delete error:', error);

      // Call error handler or show alert
      if (this.props.onError) {
        this.props.onError(error as Error);
      } else {
        alert((error as Error).message || 'Ошибка при удалении');
      }

      // Re-enable delete button
      if (this.deleteButton) {
        this.deleteButton.disabled = false;
        this.deleteButton.textContent = '🗑️ Удалить';
      }
    }
  }

  /**
   * Handle successful submission
   */
  private handleSuccess(): void {
    if (this.props.onSuccess) {
      this.props.onSuccess(this.currentMode, this.currentData);
    }
  }

  /**
   * Handle submission error
   */
  private handleError(error: Error): void {
    if (this.props.onError) {
      this.props.onError(error);
    } else {
      // Show error in modal UI if no custom handler provided
      if (this.formModal) {
        this.formModal.showError(error.message || 'Ошибка при выполнении операции');
      }
      console.error('[CrudModal] Error:', error);
    }
  }

  /**
   * Cleanup on modal close
   */
  private cleanup(): void {
    // Form will be destroyed when modal is recreated
    // No need to destroy here to avoid double-destruction
  }

  /**
   * Render the modal
   */
  render(): HTMLDialogElement {
    if (!this.formModal) {
      throw new Error('[CrudModal] Modal not initialized. Call openForCreate() or openForEdit() first.');
    }

    return this.formModal.render();
  }

  /**
   * Get the current form instance
   */
  getForm(): any {
    return this.currentForm;
  }

  /**
   * Get the current mode
   */
  getMode(): 'create' | 'edit' {
    return this.currentMode;
  }

  /**
   * Destroy the modal
   */
  destroy(): void {
    if (this.currentForm && this.currentForm.destroy) {
      this.currentForm.destroy();
    }

    if (this.formModal) {
      this.formModal.destroy();
    }

    this.currentForm = null;
    this.formModal = null;
    this.deleteButton = null;
  }
}
